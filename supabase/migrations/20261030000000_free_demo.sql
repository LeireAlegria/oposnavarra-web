-- Spec 017: isolated public demonstration. No changes to paid-test permissions.
create table private.demo_versions (
  id uuid primary key default gen_random_uuid(),
  convocation_id uuid references public.convocatorias(id) on delete set null,
  convocation_name text not null,
  version bigint generated always as identity unique,
  question_ids uuid[] not null check (cardinality(question_ids)=5),
  snapshot jsonb not null check (jsonb_array_length(snapshot)=5),
  published boolean not null default true,
  invalidated boolean not null default false,
  created_at timestamptz not null default now()
);
create table private.demo_attempts (
  id uuid primary key default gen_random_uuid(),
  credential_hash text not null unique check (credential_hash ~ '^[a-f0-9]{64}$'),
  version_id uuid not null references private.demo_versions(id),
  answers jsonb not null default '[]',
  owner_id uuid references auth.users(id) on delete cascade,
  completion_event_id uuid,
  claim_event_id uuid,
  state text not null default 'started' check (state in ('started','completed','claimed')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '24 hours'
);
create index demo_attempts_expiry_idx on private.demo_attempts(expires_at) where owner_id is null;
create table private.demo_limits (origin_hash text not null, operation text not null, created_at timestamptz not null default clock_timestamp());
create index demo_limits_origin_idx on private.demo_limits(origin_hash,operation,created_at);
create table private.demo_settings (singleton boolean primary key default true check(singleton), starts_per_hour integer not null default 10 check(starts_per_hour between 1 and 1000), answers_per_hour integer not null default 100 check(answers_per_hour between 5 and 10000));
insert into private.demo_settings default values;
alter table private.demo_versions enable row level security;
alter table private.demo_attempts enable row level security;
alter table private.demo_limits enable row level security;
alter table private.demo_settings enable row level security;
revoke all on private.demo_versions,private.demo_attempts,private.demo_limits,private.demo_settings from public,anon,authenticated;

create function private.demo_snapshot(p_convocation uuid,p_questions uuid[]) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if cardinality(p_questions) is distinct from 5 or (select count(distinct x) from unnest(p_questions) x) <> 5
    or not exists(select 1 from public.convocatorias where id=p_convocation and activo) then
    raise exception 'Selecciona cinco preguntas distintas de una convocatoria activa.' using errcode='22023';
  end if;
  select jsonb_agg(jsonb_build_object('id',p.id,'text',p.enunciado,'explanation',p.explicacion,'reference',coalesce(p.referencia_fuente,p.fuente_url),
    'options',(select jsonb_agg(jsonb_build_object('id',r.id,'text',r.texto) order by r.orden) from public.respuestas r where r.pregunta_id=p.id),
    'correctOptionId',(select r.id from public.respuestas r where r.pregunta_id=p.id and r.es_correcta)) order by a.position)
  into result from unnest(p_questions) with ordinality a(id,position) join public.preguntas p on p.id=a.id
  where p.estado='publicada' and p.situacion<>'anulada' and length(btrim(p.enunciado))>0 and length(btrim(p.explicacion))>0
    and (select count(*) from public.respuestas r where r.pregunta_id=p.id)=4
    and (select count(*) from public.respuestas r where r.pregunta_id=p.id and r.es_correcta)=1
    and not exists(select 1 from public.respuestas r where r.pregunta_id=p.id and length(btrim(r.texto))=0)
    and exists(select 1 from public.pregunta_tema pt join public.convocatoria_tema ct on ct.tema_id=pt.tema_id join public.temas t on t.id=ct.tema_id and t.activo where pt.pregunta_id=p.id and ct.convocatoria_id=p_convocation);
  if jsonb_array_length(result) is distinct from 5 then raise exception 'Las cinco preguntas deben estar publicadas, tener cuatro opciones, una solución y explicación.' using errcode='22023'; end if;
  return result;
end $$;
create function private.demo_valid(p_version uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v private.demo_versions%rowtype;
begin
 select * into v from private.demo_versions where id=p_version;
 if not found or v.invalidated then return false; end if;
 perform private.demo_snapshot(v.convocation_id,v.question_ids);
 return true;
exception when sqlstate '22023' then return false;
end $$;

create function public.demo_admin(p_action text,p_convocation uuid default null,p_questions uuid[] default null,p_version uuid default null,p_reviewed jsonb default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare questions uuid[]; snapshot jsonb; version_id uuid;
begin
 perform public.exigir_rol_admin();
 if p_action='preview' then return private.demo_snapshot(p_convocation,p_questions); end if;
 if p_action='publish' then
   snapshot:=private.demo_snapshot(p_convocation,p_questions);
   if snapshot is distinct from p_reviewed then raise exception 'El contenido ha cambiado. Revisa la vista previa antes de publicar.' using errcode='22023'; end if;
   perform pg_advisory_xact_lock(17017);
   update private.demo_versions set published=false where convocation_id=p_convocation;
   insert into private.demo_versions(convocation_id,convocation_name,question_ids,snapshot)
   select id,nombre,p_questions,snapshot from public.convocatorias where id=p_convocation returning id into version_id;
 elsif p_action='invalidate' then
   update private.demo_versions set invalidated=true,published=false where id=p_version;
 elsif p_action='random' then
   select array_agg(id) into questions from (select p.id from public.preguntas p where p.estado='publicada' and p.situacion<>'anulada'
     and length(btrim(p.explicacion))>0 and length(btrim(p.enunciado))>0
     and not exists(select 1 from public.respuestas r where r.pregunta_id=p.id and length(btrim(r.texto))=0)
     and (select count(*) from public.respuestas r where r.pregunta_id=p.id)=4
     and (select count(*) from public.respuestas r where r.pregunta_id=p.id and r.es_correcta)=1
     and exists(select 1 from public.pregunta_tema pt join public.convocatoria_tema ct on ct.tema_id=pt.tema_id join public.temas t on t.id=ct.tema_id and t.activo where pt.pregunta_id=p.id and ct.convocatoria_id=p_convocation)
     order by random() limit 5) candidate;
   return jsonb_build_object('questionIds',questions,'preview',private.demo_snapshot(p_convocation,questions));
 elsif p_action<>'list' then raise exception 'Operación no válida.' using errcode='22023'; end if;
 return jsonb_build_object('versions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'name',convocation_name,'published',published,'invalidated',invalidated,'questionIds',question_ids) order by version desc) from private.demo_versions),'[]'::jsonb));
end $$;

create function public.demo_catalog() returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.nombre,'topics',(
  select coalesce(jsonb_agg(jsonb_build_object('name',t.nombre,'number',ct.numero,'count',(select count(distinct p.id) from public.preguntas p join public.pregunta_tema pt on pt.pregunta_id=p.id where pt.tema_id=t.id and p.estado='publicada' and p.situacion<>'anulada')) order by ct.orden),'[]'::jsonb)
  from public.convocatoria_tema ct join public.temas t on t.id=ct.tema_id and t.activo where ct.convocatoria_id=c.id
  )) order by c.nombre),'[]'::jsonb) from public.convocatorias c where c.activo;
$$;
create function public.demo_available() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v private.demo_versions%rowtype;
begin
 select * into v from private.demo_versions where published and not invalidated order by version desc limit 1;
 if not found or not private.demo_valid(v.id) then return null; end if;
 return jsonb_build_object('version',v.version,'name',v.convocation_name,'question',(v.snapshot->0)-'correctOptionId'-'explanation'-'reference');
end $$;

create function private.demo_payload(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a private.demo_attempts%rowtype; v private.demo_versions%rowtype; results jsonb; score integer;
begin
 select * into a from private.demo_attempts where id=p_id;
 select * into v from private.demo_versions where id=a.version_id;
 select coalesce(jsonb_agg((v.snapshot->i.position)||jsonb_build_object('selectedOptionId',i.answer->>'optionId','correct',i.answer->>'optionId'=v.snapshot->i.position->>'correctOptionId') order by i.position),'[]'::jsonb),
 count(*) filter(where i.answer->>'optionId'=v.snapshot->i.position->>'correctOptionId')::integer into results,score
 from jsonb_array_elements(a.answers) with ordinality as x(answer,n) cross join lateral (select answer,(n-1)::integer as position) i;
 return jsonb_build_object('id',a.id,'version',v.version,'name',v.convocation_name,'state',a.state,'expiresAt',a.expires_at,'answered',jsonb_array_length(a.answers),'score',score,'results',results,'invalidated',v.invalidated,
 'completionEventId',a.completion_event_id,'claimEventId',a.claim_event_id,
 'registeredFromDemo',a.owner_id is not null and exists(select 1 from auth.users u where u.id=a.owner_id and u.created_at>=a.created_at and u.created_at<=a.expires_at),
 'question',case when jsonb_array_length(a.answers)<5 then (v.snapshot->jsonb_array_length(a.answers))-'correctOptionId'-'explanation'-'reference' else null end);
end $$;
create function private.demo_rate(p_origin text,p_operation text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare maximum integer;
begin
 if p_origin is null or p_origin !~ '^[a-f0-9]{64}$' then raise exception 'Origen no válido.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_origin||p_operation,17));
 delete from private.demo_limits where created_at<=clock_timestamp()-interval '1 hour';
 select case when p_operation='start' then starts_per_hour else answers_per_hour end into maximum from private.demo_settings;
 if (select count(*) from private.demo_limits where origin_hash=p_origin and operation=p_operation)>=maximum then raise exception 'Espera antes de volver a intentarlo.' using errcode='P0001'; end if;
 insert into private.demo_limits(origin_hash,operation) values(p_origin,p_operation);
end $$;
create function public.demo_start(p_hash text,p_origin text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a private.demo_attempts%rowtype; v private.demo_versions%rowtype;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Credencial no válida.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_hash,17));
 select * into a from private.demo_attempts where credential_hash=p_hash and expires_at>clock_timestamp() and owner_id is null;
 if found then
   if exists(select 1 from private.demo_versions where id=a.version_id and invalidated) then raise exception 'Esta versión se ha retirado. Inicia una prueba nueva.' using errcode='22023'; end if;
   return private.demo_payload(a.id);
 end if;
 select * into v from private.demo_versions where published and not invalidated order by version desc limit 1;
 if not found or not private.demo_valid(v.id) then raise exception 'La prueba gratuita no está disponible. Consulta el temario o contacta con nosotros.' using errcode='22023'; end if;
 perform private.demo_rate(p_origin,'start');
 insert into private.demo_attempts(credential_hash,version_id) values(p_hash,v.id) returning * into a;
 return private.demo_payload(a.id);
end $$;
create function public.demo_answer(p_hash text,p_origin text,p_position integer,p_option uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a private.demo_attempts%rowtype; v private.demo_versions%rowtype; answered integer;
begin
 select * into a from private.demo_attempts where credential_hash=p_hash and owner_id is null and expires_at>clock_timestamp() for update;
 if not found then raise exception 'La prueba ha caducado o no se puede recuperar. Puedes iniciar otra.' using errcode='22023'; end if;
 select * into v from private.demo_versions where id=a.version_id;
 if v.invalidated then raise exception 'Esta versión se ha retirado. Inicia una prueba nueva.' using errcode='22023'; end if;
 answered:=jsonb_array_length(a.answers);
 if p_position between 0 and answered-1 and a.answers->p_position->>'optionId'=p_option::text then return private.demo_payload(a.id); end if;
 if p_position is distinct from answered or answered>=5 or not exists(select 1 from jsonb_array_elements(v.snapshot->answered->'options') o where o->>'id'=p_option::text) then raise exception 'La respuesta ya está comprobada o no es válida.' using errcode='22023'; end if;
 perform private.demo_rate(p_origin,'answer');
 update private.demo_attempts set answers=answers||jsonb_build_array(jsonb_build_object('optionId',p_option,'at',clock_timestamp())),state=case when answered=4 then 'completed' else 'started' end,
 completion_event_id=case when answered=4 then gen_random_uuid() else completion_event_id end where id=a.id;
 return private.demo_payload(a.id);
end $$;
create function public.demo_restore(p_token text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a private.demo_attempts%rowtype; p_hash text := encode(sha256(convert_to(p_token,'UTF8')),'hex');
begin
 select * into a from private.demo_attempts where credential_hash=p_hash and ((owner_id is null and expires_at>clock_timestamp()) or owner_id=auth.uid());
 if not found then raise exception 'La prueba ha caducado o no se puede recuperar. Puedes iniciar otra.' using errcode='22023'; end if;
 if exists(select 1 from private.demo_versions where id=a.version_id and invalidated) then raise exception 'Esta versión se ha retirado. Inicia una prueba nueva.' using errcode='22023'; end if;
 return private.demo_payload(a.id);
end $$;
create function public.demo_claim(p_token text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a private.demo_attempts%rowtype; p_hash text := encode(sha256(convert_to(p_token,'UTF8')),'hex');
begin
 if auth.uid() is null then raise exception 'Inicia sesión para guardar el resultado.' using errcode='42501'; end if;
 select * into a from private.demo_attempts where credential_hash=p_hash for update;
 if not found or (a.owner_id is not null and a.owner_id<>auth.uid()) or (a.owner_id is null and a.expires_at<=clock_timestamp()) or a.state='started'
 or exists(select 1 from private.demo_versions where id=a.version_id and invalidated) then raise exception 'No se pudo recuperar el resultado. Tu cuenta sigue disponible; puedes repetir la prueba.' using errcode='22023'; end if;
 update private.demo_attempts set owner_id=auth.uid(),state='claimed',claim_event_id=coalesce(claim_event_id,gen_random_uuid()) where id=a.id;
 return private.demo_payload(a.id);
end $$;
create function public.demo_my_results() returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(private.demo_payload(id) order by created_at desc),'[]'::jsonb) from private.demo_attempts where owner_id=auth.uid();
$$;
create function private.demo_cleanup() returns void language sql security definer set search_path=public,pg_temp as $$
 delete from private.demo_attempts where owner_id is null and expires_at<=clock_timestamp();
 delete from private.demo_limits where created_at<=clock_timestamp()-interval '1 hour';
$$;
select cron.schedule('oposnavarra-demo-cleanup','* * * * *','SELECT private.demo_cleanup();');

revoke all on function private.demo_snapshot(uuid,uuid[]),private.demo_valid(uuid),private.demo_payload(uuid),private.demo_rate(text,text),private.demo_cleanup() from public,anon,authenticated;
revoke all on function public.demo_admin(text,uuid,uuid[],uuid,jsonb), public.demo_start(text,text), public.demo_answer(text,text,integer,uuid), public.demo_restore(text),public.demo_claim(text),public.demo_my_results(),public.demo_catalog(),public.demo_available() from public,anon,authenticated;
grant execute on function public.demo_admin(text,uuid,uuid[],uuid,jsonb),public.demo_claim(text),public.demo_my_results() to authenticated;
grant execute on function public.demo_restore(text),public.demo_catalog(),public.demo_available() to anon,authenticated;
grant execute on function public.demo_start(text,text),public.demo_answer(text,text,integer,uuid) to service_role;

-- User-authorized initial random selection, kept fixed for all attempts on this version.
do $$
declare c record; ids uuid[]; content jsonb;
begin
 for c in select id,nombre from public.convocatorias where activo order by nombre loop
  select array_agg(id) into ids from (select p.id from public.preguntas p where p.estado='publicada' and p.situacion<>'anulada' and length(btrim(p.explicacion))>0 and length(btrim(p.enunciado))>0
    and not exists(select 1 from public.respuestas r where r.pregunta_id=p.id and length(btrim(r.texto))=0)
    and (select count(*) from public.respuestas r where r.pregunta_id=p.id)=4 and (select count(*) from public.respuestas r where r.pregunta_id=p.id and r.es_correcta)=1
    and exists(select 1 from public.pregunta_tema pt join public.convocatoria_tema ct on ct.tema_id=pt.tema_id join public.temas t on t.id=ct.tema_id and t.activo where pt.pregunta_id=p.id and ct.convocatoria_id=c.id) order by random() limit 5) q;
  begin
   content:=private.demo_snapshot(c.id,ids);
   insert into private.demo_versions(convocation_id,convocation_name,question_ids,snapshot) values(c.id,c.nombre,ids,content);
   exit;
  exception when sqlstate '22023' then null;
  end;
 end loop;
end $$;
notify pgrst,'reload schema';
create function public.demo_candidates(p_convocation uuid,p_search text default '',p_page integer default 0) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.exigir_rol_admin();
 if p_page<0 or p_page>10000 or length(p_search)>200 then raise exception 'Filtro no válido.' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'text',enunciado) order by created_at desc,id) from (
 select p.id,p.enunciado,p.created_at from public.preguntas p where p.estado='publicada' and p.situacion<>'anulada' and length(btrim(p.explicacion))>0
 and p.enunciado ilike '%'||p_search||'%'
 and exists(select 1 from public.pregunta_tema pt join public.convocatoria_tema ct on ct.tema_id=pt.tema_id where pt.pregunta_id=p.id and ct.convocatoria_id=p_convocation)
 order by p.created_at desc,p.id limit 25 offset p_page*25) q),'[]'::jsonb);
end $$;
revoke all on function public.demo_candidates(uuid,text,integer) from public,anon;
grant execute on function public.demo_candidates(uuid,text,integer) to authenticated;
