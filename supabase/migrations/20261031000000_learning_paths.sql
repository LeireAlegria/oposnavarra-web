-- Spec 016: learning paths reuse the existing test engine and history.
create table public.caminos (
 id uuid primary key default gen_random_uuid(), convocatoria_id uuid not null references public.convocatorias(id) on delete restrict,
 titulo text not null check(length(btrim(titulo)) between 1 and 200), estado text not null default 'borrador' check(estado in ('borrador','publicado','archivado')),
 created_at timestamptz not null default clock_timestamp(), published_at timestamptz
);
create unique index caminos_publicados_convocatoria_key on public.caminos(convocatoria_id) where estado='publicado';
create table public.camino_paradas (
 id uuid primary key default gen_random_uuid(), camino_id uuid not null references public.caminos(id) on delete restrict,
 tipo text not null check(tipo in ('tema','repaso_bloque')), orden integer not null check(orden>0), titulo text not null,
 tema_id uuid references public.temas(id) on delete restrict, bloque_id uuid not null references public.convocatoria_bloques(id) on delete restrict,
 unique(camino_id,orden), check((tipo='tema' and tema_id is not null) or (tipo='repaso_bloque' and tema_id is null))
);
create table public.camino_retos (
 id uuid primary key default gen_random_uuid(), parada_id uuid not null references public.camino_paradas(id) on delete restrict,
 orden integer not null check(orden>0), titulo text not null check(length(btrim(titulo)) between 1 and 200),
 numero_preguntas integer not null check(numero_preguntas>0), criterio_superacion text not null check(criterio_superacion in ('finalizacion','porcentaje')),
 porcentaje_minimo integer not null check(porcentaje_minimo between 0 and 100), xp integer not null check(xp>=0), unique(parada_id,orden)
);
create unique index camino_tema_parada_key on public.camino_paradas(camino_id,tema_id) where tipo='tema';
create unique index camino_repaso_bloque_key on public.camino_paradas(camino_id,bloque_id) where tipo='repaso_bloque';
alter table public.test_intentos add column camino_id uuid references public.caminos(id) on delete restrict,
 add column camino_reto_id uuid references public.camino_retos(id) on delete restrict,
 add column origen text not null default 'test' check(origen in ('test','camino')),
 add column camino_version integer not null default 0,
 add column camino_evaluacion jsonb, add column camino_resultado jsonb,
 add column camino_superado boolean, add column camino_xp_obtenida integer;
alter table public.test_intentos add constraint test_intento_origen_camino_check check(
 (origen='camino' and camino_id is not null and camino_reto_id is not null and reto_id is null and examen_id is null and tiempo_limite_segundos is null and expira_en is null and camino_evaluacion is not null)
 or (origen='test' and camino_id is null and camino_reto_id is null));
-- Extend the actual existing state constraints without assuming generated constraint names.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.test_intentos'::regclass and contype='c' and pg_get_constraintdef(oid) like '%estado%' loop
  execute format('alter table public.test_intentos drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.test_intentos add constraint test_intentos_estado_check check(estado in ('en_curso','finalizado','abandonado','invalidado')),
 add constraint test_intentos_cierre_check check(estado<>'finalizado' or (finalizado_en is not null and aciertos is not null and fallos is not null and en_blanco is not null and puntuacion_neta is not null and nota is not null and porcentaje_aciertos is not null and penalizacion_aplicada is not null)),
 add constraint test_intentos_estado_camino_check check(estado in ('en_curso','finalizado') or origen='camino');
create unique index camino_intento_en_curso_key on public.test_intentos(usuario_id,camino_id) where estado='en_curso' and camino_id is not null;
alter table public.test_intento_preguntas add column camino_contenido_hash text, add column camino_opciones_ids uuid[];
create index camino_pregunta_historial_idx on public.test_intento_preguntas(pregunta_id,test_intento_id) where camino_contenido_hash is not null;
create table public.camino_retos_progreso (
 usuario_id uuid not null references auth.users(id) on delete cascade, reto_id uuid not null references public.camino_retos(id) on delete restrict,
 primer_intento_superado_id uuid references public.test_intentos(id) on delete restrict, superado_at timestamptz,
 mejor_porcentaje numeric not null check(mejor_porcentaje between 0 and 100), ultimo_intento_id uuid not null references public.test_intentos(id) on delete restrict,
 primary key(usuario_id,reto_id), check((primer_intento_superado_id is null)=(superado_at is null))
);
create table public.camino_xp_movimientos (
 id uuid primary key default gen_random_uuid(), usuario_id uuid not null references auth.users(id) on delete cascade,
 reto_id uuid not null references public.camino_retos(id) on delete restrict, intento_id uuid not null references public.test_intentos(id) on delete restrict,
 cantidad integer not null check(cantidad>=0), created_at timestamptz not null default clock_timestamp(), unique(usuario_id,reto_id)
);
create table public.camino_actividad_diaria (
 usuario_id uuid not null references auth.users(id) on delete cascade, fecha_local date not null,
 primer_intento_id uuid not null references public.test_intentos(id) on delete restrict, created_at timestamptz not null default clock_timestamp(), primary key(usuario_id,fecha_local)
);
-- All writes use controlled RPC. Personal tables also enforce row ownership.
alter table public.caminos enable row level security;
alter table public.camino_paradas enable row level security;
alter table public.camino_retos enable row level security;
alter table public.camino_retos_progreso enable row level security;
alter table public.camino_xp_movimientos enable row level security;
alter table public.camino_actividad_diaria enable row level security;
revoke all on public.caminos,public.camino_paradas,public.camino_retos,public.camino_retos_progreso,public.camino_xp_movimientos,public.camino_actividad_diaria from public,anon,authenticated;
grant select on public.camino_retos_progreso,public.camino_xp_movimientos,public.camino_actividad_diaria to authenticated;
create policy camino_progress_owner on public.camino_retos_progreso for select to authenticated using(usuario_id=auth.uid());
create policy camino_xp_owner on public.camino_xp_movimientos for select to authenticated using(usuario_id=auth.uid());
create policy camino_activity_owner on public.camino_actividad_diaria for select to authenticated using(usuario_id=auth.uid());

create function private.camino_scope(p_stop uuid) returns uuid[] language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(array_agg(t.tema_id order by t.orden),'{}'::uuid[]) from public.camino_paradas t join public.camino_paradas s on s.camino_id=t.camino_id and s.bloque_id=t.bloque_id where s.id=p_stop and t.tipo='tema' and (s.tipo='repaso_bloque' or s.tema_id=t.tema_id);
$$;
create function private.camino_eligible(p_stop uuid) returns table(id uuid,tema_id uuid) language sql stable security definer set search_path=public,pg_temp as $$
 select distinct p.id,pt.tema_id from public.preguntas p join public.pregunta_tema pt on pt.pregunta_id=p.id join public.temas t on t.id=pt.tema_id and t.activo
 where pt.tema_id=any(private.camino_scope(p_stop)) and p.estado='publicada' and p.situacion<>'anulada'
 and exists(select 1 from public.camino_paradas s join public.caminos c on c.id=s.camino_id join public.convocatoria_tema ct on ct.convocatoria_id=c.convocatoria_id and ct.tema_id=pt.tema_id where s.id=p_stop and exists(select 1 from public.convocatorias v where v.id=c.convocatoria_id and v.activo))
 and (select count(*) from public.respuestas r where r.pregunta_id=p.id)=4 and (select count(*) from public.respuestas r where r.pregunta_id=p.id and r.es_correcta)=1;
$$;
create function private.camino_hash(p_question uuid) returns text language sql stable security definer set search_path=public,pg_temp as $$
 select md5(jsonb_build_array(p.enunciado,p.explicacion,p.estado,p.situacion,p.fuente_url,p.referencia_fuente,extract(epoch from p.updated_at),
 (select jsonb_agg(jsonb_build_array(r.id,r.texto,r.orden,r.es_correcta,extract(epoch from r.updated_at)) order by r.orden) from public.respuestas r where r.pregunta_id=p.id))::text) from public.preguntas p where p.id=p_question;
$$;
create function private.camino_access() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.comprobar_acceso_suscripcion(auth.uid()) or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
 raise exception 'Necesitas confirmar tu correo y tener acceso activo para practicar en Mi camino.' using errcode='42501'; end if;
end $$;
create function private.camino_unlocked(p_challenge uuid,p_user uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select not exists(select 1 from public.camino_retos prev join public.camino_paradas ps on ps.id=prev.parada_id join public.camino_retos target on target.id=p_challenge join public.camino_paradas ts on ts.id=target.parada_id
 where ps.camino_id=ts.camino_id and (ps.orden<ts.orden or (ps.orden=ts.orden and prev.orden<target.orden))
 and not exists(select 1 from public.camino_retos_progreso pr where pr.usuario_id=p_user and pr.reto_id=prev.id and pr.primer_intento_superado_id is not null));
$$;
-- Augmenting paths guarantee distinct coverage even when questions belong to several topics.
create function private.camino_match(p_stop uuid,p_topic uuid,p_user uuid,p_matches jsonb,p_seen uuid[]) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; prior_topic uuid; reassigned jsonb;
begin
 for candidate in select e.id from private.camino_eligible(p_stop) e where e.tema_id=p_topic and not e.id=any(p_seen)
 order by (select max(ti.iniciado_en) from public.test_intentos ti join public.test_intento_preguntas q on q.test_intento_id=ti.id where ti.usuario_id=p_user and ti.camino_id=(select camino_id from public.camino_paradas where id=p_stop) and q.pregunta_id=e.id) asc nulls first,random() loop
  prior_topic:=(p_matches->>candidate.id::text)::uuid;
  if prior_topic is null then return p_matches||jsonb_build_object(candidate.id::text,p_topic);end if;
  reassigned:=private.camino_match(p_stop,prior_topic,p_user,p_matches,array_append(p_seen,candidate.id));
  if reassigned is not null then return reassigned||jsonb_build_object(candidate.id::text,p_topic);end if;
 end loop;
 return null;
end $$;
create function private.camino_selection(p_challenge uuid,p_user uuid) returns uuid[] language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.camino_retos%rowtype; topic uuid; picked uuid; selected uuid[]:='{}'; used_topics uuid[]:='{}'; matches jsonb:='{}';
begin
 select * into r from public.camino_retos where id=p_challenge;
 if not found then raise exception 'No se encontró el reto.' using errcode='22023'; end if;
 if cardinality(private.camino_scope(r.parada_id))=0 or (select count(distinct id) from private.camino_eligible(r.parada_id))<r.numero_preguntas then raise exception 'Incidencia de contenido: no hay suficientes preguntas elegibles. Ajusta la configuración antes de publicar o vuelve a intentarlo cuando se reponga el contenido.' using errcode='22023';end if;
 for topic in select scope.id from unnest(private.camino_scope(r.parada_id)) scope(id)
 order by (select count(*) from private.camino_eligible(r.parada_id) e where e.tema_id=scope.id),scope.id loop
  matches:=private.camino_match(r.parada_id,topic,p_user,matches,'{}');
  if matches is null then raise exception 'El repaso no puede representar todos los temas con preguntas distintas.' using errcode='22023';end if;
 end loop;
 select array_agg(key::uuid order by key),array_agg(value::uuid order by key) into selected,used_topics from jsonb_each_text(matches);
 if cardinality(selected)>r.numero_preguntas then raise exception 'El repaso necesita al menos una pregunta por tema.' using errcode='22023';end if;
 while cardinality(selected)<r.numero_preguntas loop
  picked:=null;
  for topic in select scope.id from unnest(private.camino_scope(r.parada_id)) scope(id)
   where exists(select 1 from private.camino_eligible(r.parada_id) e where e.tema_id=scope.id and not e.id=any(selected))
   order by (select count(*) from unnest(used_topics) seen(id) where seen.id=scope.id),
    (select count(*) from private.camino_eligible(r.parada_id) e where e.tema_id=scope.id and not e.id=any(selected)),scope.id loop
   select e.id into picked from private.camino_eligible(r.parada_id) e where e.tema_id=topic and not e.id=any(selected)
   order by (select max(ti.iniciado_en) from public.test_intentos ti join public.test_intento_preguntas q on q.test_intento_id=ti.id where ti.usuario_id=p_user and ti.camino_id=(select s.camino_id from public.camino_paradas s where s.id=r.parada_id) and q.pregunta_id=e.id) asc nulls first,random() limit 1;
   if picked is not null then selected:=array_append(selected,picked);used_topics:=array_append(used_topics,topic);exit; end if;
  end loop;
  if picked is null then raise exception 'Incidencia de contenido: faltan preguntas para este reto. No se ha consumido ningún intento.' using errcode='22023'; end if;
 end loop;
 if not private.camino_scope(r.parada_id)<@used_topics then raise exception 'El repaso no puede representar todos los temas. Revisa su configuración.' using errcode='22023'; end if;
 return selected;
end $$;

create function public.camino_admin(p_action text,p_path uuid default null,p_convocation uuid default null,p_title text default null,p_rules jsonb default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare path public.caminos%rowtype; block record; topic record; stop_id uuid; path_id uuid; step integer:=0; rule record; challenge record; config jsonb;
begin
 perform public.exigir_rol_admin();
 if p_action in ('generate','regenerate') then
  if p_action='regenerate' then
   select * into path from public.caminos where id=p_path for update;
   if not found or path.estado<>'borrador' or exists(select 1 from public.test_intentos where camino_id=p_path) then raise exception 'Solo se puede regenerar un borrador sin intentos.' using errcode='22023';end if;
   p_convocation:=path.convocatoria_id;
   delete from public.camino_retos where parada_id in (select id from public.camino_paradas where camino_id=p_path);
   delete from public.camino_paradas where camino_id=p_path;
   delete from public.caminos where id=p_path;
  end if;
  perform 1 from public.convocatorias where id=p_convocation and activo for update;
  if not found then raise exception 'Selecciona una convocatoria activa.' using errcode='22023'; end if;
  if exists(select 1 from public.caminos where convocatoria_id=p_convocation) then raise exception 'Esta convocatoria ya tiene un camino. No se puede regenerar ni reiniciar su progreso.' using errcode='22023'; end if;
  insert into public.caminos(convocatoria_id,titulo) select id,left('Mi camino · '||nombre,200) from public.convocatorias where id=p_convocation returning id into path_id;
  for block in select b.* from public.convocatoria_bloques b where b.convocatoria_id=p_convocation and exists(select 1 from public.convocatoria_tema ct where ct.bloque_id=b.id) order by b.orden,b.id loop
   for topic in select t.id,t.nombre from public.convocatoria_tema ct join public.temas t on t.id=ct.tema_id where ct.bloque_id=block.id order by ct.orden,t.id loop
    step:=step+1;insert into public.camino_paradas(camino_id,tipo,orden,titulo,tema_id,bloque_id) values(path_id,'tema',step,topic.nombre,topic.id,block.id) returning id into stop_id;
    insert into public.camino_retos(parada_id,orden,titulo,numero_preguntas,criterio_superacion,porcentaje_minimo,xp) values
    (stop_id,1,'Primeros pasos',5,'finalizacion',0,10),(stop_id,2,'Coge ritmo',10,'porcentaje',60,20),
    (stop_id,3,'Demuestra lo aprendido',10,'porcentaje',70,30),(stop_id,4,'Reto final del tema',15,'porcentaje',80,50);
   end loop;
   step:=step+1;insert into public.camino_paradas(camino_id,tipo,orden,titulo,bloque_id) values(path_id,'repaso_bloque',step,'Repaso · '||block.nombre,block.id) returning id into stop_id;
   insert into public.camino_retos(parada_id,orden,titulo,numero_preguntas,criterio_superacion,porcentaje_minimo,xp) values(stop_id,1,'Repaso de bloque',greatest(15,(select count(*) from public.camino_paradas where camino_id=path_id and bloque_id=block.id and tipo='tema')),'porcentaje',80,75);
  end loop;
 elsif p_action in ('save','publish','archive') then
  select * into path from public.caminos where id=p_path for update;
  if not found then raise exception 'No se encontró el camino.' using errcode='22023'; end if;
  if p_action='archive' then update public.caminos set estado='archivado' where id=p_path;
  else
   if p_title is not null then update public.caminos set titulo=btrim(p_title) where id=p_path; end if;
   if p_rules is not null then
    if path.estado<>'borrador' then raise exception 'Las reglas publicadas están congeladas.' using errcode='22023'; end if;
    if jsonb_typeof(p_rules)<>'array' then raise exception 'Configuración no válida.' using errcode='22023'; end if;
    for config in select * from jsonb_array_elements(p_rules) loop
     update public.camino_retos r set numero_preguntas=(config->>'questionCount')::integer,criterio_superacion=config->>'criterion',porcentaje_minimo=(config->>'threshold')::integer,xp=(config->>'xp')::integer
     where r.id=(config->>'id')::uuid and exists(select 1 from public.camino_paradas s where s.id=r.parada_id and s.camino_id=p_path);
     if not found then raise exception 'El reto no pertenece al camino.' using errcode='22023'; end if;
    end loop;
   end if;
   if p_action='publish' then
    if path.estado<>'borrador' then raise exception 'Solo se publican borradores.' using errcode='22023'; end if;
    if not exists(select 1 from public.camino_paradas where camino_id=p_path and tipo='tema') then raise exception 'El camino no contiene temas.' using errcode='22023'; end if;
    if (select jsonb_agg(jsonb_build_array(s.bloque_id,s.tipo,s.tema_id) order by s.orden) from public.camino_paradas s where s.camino_id=p_path) is distinct from (
      select jsonb_agg(jsonb_build_array(expected.block_id,expected.kind,expected.topic_id) order by expected.block_order,expected.review_order,expected.topic_order) from (
        select b.id block_id,'tema'::text kind,ct.tema_id topic_id,b.orden block_order,0 review_order,ct.orden topic_order from public.convocatoria_bloques b join public.convocatoria_tema ct on ct.bloque_id=b.id where b.convocatoria_id=path.convocatoria_id
        union all select b.id,'repaso_bloque',null::uuid,b.orden,1,0 from public.convocatoria_bloques b where b.convocatoria_id=path.convocatoria_id and exists(select 1 from public.convocatoria_tema ct where ct.bloque_id=b.id)
      ) expected) then raise exception 'El catálogo cambió o el orden está incompleto. Regenera el borrador antes de publicar.' using errcode='22023';end if;
    if exists(select 1 from public.camino_paradas s where s.camino_id=p_path and
      ((s.tipo='tema' and ((select count(*) from public.camino_retos r where r.parada_id=s.id)<>4 or (select count(*) from public.camino_retos r where r.parada_id=s.id and r.orden between 1 and 4)<>4 or not exists(select 1 from public.convocatoria_tema ct where ct.convocatoria_id=path.convocatoria_id and ct.tema_id=s.tema_id and ct.bloque_id=s.bloque_id)))
      or (s.tipo='repaso_bloque' and ((select count(*) from public.camino_retos r where r.parada_id=s.id)<>1 or not exists(select 1 from public.camino_retos r where r.parada_id=s.id and r.orden=1)))))
     or exists(select 1 from public.camino_paradas s where s.camino_id=p_path group by bloque_id having count(*) filter(where tipo='repaso_bloque')<>1)
     or (select count(*) from public.camino_paradas where camino_id=p_path and tipo='tema')<>(select count(*) from public.convocatoria_tema where convocatoria_id=path.convocatoria_id)
     then raise exception 'El recorrido ya no coincide con el catálogo o está incompleto.' using errcode='22023'; end if;
    for challenge in select r.id from public.camino_retos r join public.camino_paradas s on s.id=r.parada_id where s.camino_id=p_path loop
      perform private.camino_selection(challenge.id,auth.uid());
    end loop;
    update public.caminos set estado='publicado',published_at=clock_timestamp() where id=p_path;
   end if;
  end if;
 elsif p_action<>'list' then raise exception 'Operación no válida.' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'convocationId',c.convocatoria_id,'title',c.titulo,'state',c.estado,'stops',(
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.titulo,'type',s.tipo,'blockId',s.bloque_id,'challenges',(
    select jsonb_agg(jsonb_build_object('id',r.id,'title',r.titulo,'questionCount',r.numero_preguntas,'criterion',r.criterio_superacion,'threshold',r.porcentaje_minimo,'xp',r.xp) order by r.orden) from public.camino_retos r where r.parada_id=s.id)) order by s.orden),'[]'::jsonb) from public.camino_paradas s where s.camino_id=c.id)) order by c.created_at desc) from public.caminos c),'[]'::jsonb);
end $$;

create function private.camino_streak(p_user uuid,p_today date default (clock_timestamp() at time zone 'Europe/Madrid')::date) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare latest date; current_streak integer:=0; best integer:=0; day record; expected date;
begin
 select max(fecha_local) into latest from public.camino_actividad_diaria where usuario_id=p_user and fecha_local<=p_today;
 if latest>=p_today-1 then
  expected:=latest;
  for day in select fecha_local from public.camino_actividad_diaria where usuario_id=p_user and fecha_local<=p_today order by fecha_local desc loop
   exit when day.fecha_local<>expected;current_streak:=current_streak+1;expected:=expected-1;
  end loop;
 end if;
 select coalesce(max(n),0)::integer into best from (select count(*) n from (select fecha_local-row_number() over(order by fecha_local)::integer island from public.camino_actividad_diaria where usuario_id=p_user and fecha_local<=p_today) d group by island) streak_groups;
 return jsonb_build_object('current',current_streak,'best',best,'dailyDone',coalesce(latest=p_today,false));
end $$;
create function private.camino_content_valid(p_attempt uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select not exists(select 1 from public.test_intento_preguntas q where q.test_intento_id=p_attempt and (q.camino_contenido_hash is distinct from private.camino_hash(q.pregunta_id)
 or not exists(select 1 from public.test_intentos ti join public.camino_retos r on r.id=ti.camino_reto_id join private.camino_eligible(r.parada_id) e on e.id=q.pregunta_id where ti.id=p_attempt)));
$$;
create function private.camino_invalidate(p_attempt uuid) returns void language sql security definer set search_path=public,pg_temp as $$
 update public.test_intentos set estado='invalidado',finalizado_en=clock_timestamp(),camino_version=camino_version+1 where id=p_attempt and estado='en_curso' and not private.camino_content_valid(id);
$$;
alter function private.resultado_test(uuid) rename to resultado_test_pre_camino;
create function private.resultado_test(p_test_intento_id uuid) returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select coalesce(t.camino_resultado,private.resultado_test_pre_camino(t.id)) from public.test_intentos t where t.id=p_test_intento_id;
$$;
alter function private.resumen_test(uuid) rename to resumen_test_pre_camino;
create function private.resumen_test(p_test_intento_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.test_intentos%rowtype; result jsonb;
begin
 select * into a from public.test_intentos where id=p_test_intento_id;
 result:=private.resumen_test_pre_camino(p_test_intento_id);
 if a.camino_id is not null then result:=result||jsonb_build_object('pathId',a.camino_id,'pathChallengeId',a.camino_reto_id,'pathState',a.estado,'pathVersion',a.camino_version,'pathEvaluation',a.camino_evaluacion,'pathPassed',a.camino_superado,'pathXpEarned',a.camino_xp_obtenida);end if;
 return result;
end $$;
create function public.camino_attempt(p_attempt uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.test_intentos%rowtype; questions jsonb; active boolean;
begin
 select * into a from public.test_intentos where id=p_attempt and usuario_id=auth.uid() and camino_id is not null for update;
 if not found then raise exception 'No se encontró un intento propio del camino.' using errcode='42501';end if;
 active:=public.comprobar_acceso_suscripcion(auth.uid()) and (select estado='publicado' from public.caminos where id=a.camino_id) and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null);
 if a.estado='en_curso' and active then perform private.camino_invalidate(a.id);select * into a from public.test_intentos where id=p_attempt;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.pregunta_id,'order',q.orden,'text',p.enunciado,'selectedAnswerId',q.respuesta_seleccionada_id,'status',q.resultado,'topics','[]'::jsonb,
  'contentChanged',q.camino_contenido_hash is distinct from private.camino_hash(p.id),'explanation',case when a.estado='finalizado' then p.explicacion else null end,
  'options',(select jsonb_agg(case when a.estado='finalizado' then jsonb_build_object('id',r.id,'text',r.texto,'order',r.orden,'isCorrect',r.es_correcta)
    else jsonb_build_object('id',r.id,'text',r.texto,'order',r.orden) end order by r.orden) from public.respuestas r where r.pregunta_id=p.id)) order by q.orden),'[]'::jsonb)
 into questions from public.test_intento_preguntas q join public.preguntas p on p.id=q.pregunta_id where q.test_intento_id=a.id and (a.estado='finalizado' or (active and a.estado='en_curso'));
 return private.resumen_test(a.id)||jsonb_build_object('questions',questions,'canPractice',active,'pathTitle',(select titulo from public.camino_retos where id=a.camino_reto_id));
end $$;
create function public.camino_start(p_challenge uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.camino_retos%rowtype;s public.camino_paradas%rowtype;c public.caminos%rowtype; existing public.test_intentos%rowtype; ids uuid[];attempt_id uuid;
begin
 perform private.camino_access();select * into r from public.camino_retos where id=p_challenge;select * into s from public.camino_paradas where id=r.parada_id;select * into c from public.caminos where id=s.camino_id for share;
 if not found or c.estado<>'publicado' then raise exception 'El camino no está publicado. Puedes consultar tus logros anteriores.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||c.id::text,16));
 select * into existing from public.test_intentos where usuario_id=auth.uid() and camino_id=c.id and estado='en_curso' for update;
 if found then return public.camino_attempt(existing.id);end if;
 if not private.camino_unlocked(r.id,auth.uid()) then raise exception 'Completa el reto anterior para desbloquear este paso.' using errcode='42501';end if;
 ids:=private.camino_selection(r.id,auth.uid());
 perform 1 from public.preguntas where id=any(ids) order by id for share;
 perform 1 from public.respuestas where pregunta_id=any(ids) order by id for share;
 if exists(select 1 from unnest(ids) chosen(id) where not exists(select 1 from private.camino_eligible(s.id) e where e.id=chosen.id)) then raise exception 'El contenido ha cambiado. Reintenta el inicio.' using errcode='22023';end if;
 insert into public.test_intentos(usuario_id,convocatoria_id,estado,numero_preguntas,penalizacion_aplicada,camino_id,camino_reto_id,origen,camino_evaluacion)
 values(auth.uid(),c.convocatoria_id,'en_curso',r.numero_preguntas,0,c.id,r.id,'camino',jsonb_build_object('criterion',r.criterio_superacion,'threshold',r.porcentaje_minimo,'xp',r.xp,'minimum',case when r.criterio_superacion='finalizacion' then 1 else ceil(r.numero_preguntas::numeric*r.porcentaje_minimo/100.0) end)) returning id into attempt_id;
 insert into public.test_intento_temas(test_intento_id,tema_id) select attempt_id,unnest(private.camino_scope(s.id));
 insert into public.test_intento_preguntas(test_intento_id,pregunta_id,orden,camino_contenido_hash,camino_opciones_ids)
 select attempt_id,q.id,q.n,private.camino_hash(q.id),(select array_agg(id order by orden) from public.respuestas where pregunta_id=q.id) from unnest(ids) with ordinality q(id,n);
 return public.camino_attempt(attempt_id);
end $$;
create function public.camino_save(p_attempt uuid,p_question uuid,p_option uuid,p_version integer) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.test_intentos%rowtype;
begin
 perform private.camino_access();select * into a from public.test_intentos where id=p_attempt and usuario_id=auth.uid() and camino_id is not null for update;
 if not found then raise exception 'No se encontró un intento propio.' using errcode='42501';end if;
 if a.estado<>'en_curso' then return public.camino_attempt(a.id);end if;
 perform 1 from public.caminos where id=a.camino_id for share;
 if (select estado from public.caminos where id=a.camino_id)<>'publicado' then raise exception 'El camino está archivado. Puedes salir o abandonar el intento.' using errcode='22023';end if;
 perform private.camino_invalidate(a.id);if not private.camino_content_valid(a.id) then return public.camino_attempt(a.id);end if;
 if p_version is distinct from a.camino_version then
  if p_version+1=a.camino_version and exists(select 1 from public.test_intento_preguntas where test_intento_id=a.id and pregunta_id=p_question and respuesta_seleccionada_id is not distinct from p_option) then return public.camino_attempt(a.id);end if;
  return public.camino_attempt(a.id)||jsonb_build_object('conflict',true);
 end if;
 if not exists(select 1 from public.test_intento_preguntas where test_intento_id=a.id and pregunta_id=p_question) or (p_option is not null and not exists(select 1 from public.respuestas where id=p_option and pregunta_id=p_question)) then raise exception 'La opción no pertenece a este intento.' using errcode='22023';end if;
 update public.test_intento_preguntas set respuesta_seleccionada_id=p_option where test_intento_id=a.id and pregunta_id=p_question;
 update public.test_intentos set camino_version=camino_version+1 where id=a.id;
 return public.camino_attempt(a.id);
end $$;
create function public.camino_finish(p_attempt uuid,p_version integer) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.test_intentos%rowtype; result jsonb;passed boolean;award integer:=0;
begin
 select * into a from public.test_intentos where id=p_attempt and usuario_id=auth.uid() and camino_id is not null for update;
 if not found then raise exception 'No se encontró un intento propio.' using errcode='42501';end if;
 if a.estado<>'en_curso' then return public.camino_attempt(a.id);end if;
 perform private.camino_access();
 perform 1 from public.caminos where id=a.camino_id for share;
 if (select estado from public.caminos where id=a.camino_id)<>'publicado' then raise exception 'El camino está archivado. El intento se conserva y puedes abandonarlo.' using errcode='22023';end if;
 if p_version is distinct from a.camino_version then return public.camino_attempt(a.id)||jsonb_build_object('conflict',true);end if;
 perform 1 from public.preguntas p join public.test_intento_preguntas q on q.pregunta_id=p.id where q.test_intento_id=a.id order by p.id for share of p;
 perform 1 from public.respuestas r join public.test_intento_preguntas q on q.pregunta_id=r.pregunta_id where q.test_intento_id=a.id order by r.id for share of r;
 perform private.camino_invalidate(a.id);if not private.camino_content_valid(a.id) then return public.camino_attempt(a.id);end if;
 -- Existing engine corrects references and computes result with zero penalty, using the server clock.
 perform private.finalizar_test_base(a.id,auth.uid());
 update public.test_intentos set finalizado_en=clock_timestamp() where id=a.id;
 result:=private.resultado_test(a.id);
 update public.test_intentos set tiempo_empleado_segundos=(result->>'tiempoEmpleadoSegundos')::integer where id=a.id;
 passed:=case when a.camino_evaluacion->>'criterion'='finalizacion' then (result->>'aciertos')::integer+(result->>'fallos')::integer>=1 else (result->>'aciertos')::integer>=(a.camino_evaluacion->>'minimum')::integer end;
 update public.test_intentos set camino_resultado=result,camino_superado=passed where id=a.id;
 insert into public.camino_retos_progreso(usuario_id,reto_id,primer_intento_superado_id,superado_at,mejor_porcentaje,ultimo_intento_id)
 values(auth.uid(),a.camino_reto_id,case when passed then a.id end,case when passed then clock_timestamp() end,(result->>'porcentajeAciertos')::numeric,a.id)
 on conflict(usuario_id,reto_id) do update set primer_intento_superado_id=coalesce(camino_retos_progreso.primer_intento_superado_id,excluded.primer_intento_superado_id),superado_at=coalesce(camino_retos_progreso.superado_at,excluded.superado_at),mejor_porcentaje=greatest(camino_retos_progreso.mejor_porcentaje,excluded.mejor_porcentaje),ultimo_intento_id=excluded.ultimo_intento_id;
 if passed then
  insert into public.camino_xp_movimientos(usuario_id,reto_id,intento_id,cantidad) values(auth.uid(),a.camino_reto_id,a.id,(a.camino_evaluacion->>'xp')::integer) on conflict(usuario_id,reto_id) do nothing returning cantidad into award;
 end if;
 if (result->>'aciertos')::integer+(result->>'fallos')::integer>0 then
  insert into public.camino_actividad_diaria(usuario_id,fecha_local,primer_intento_id) select auth.uid(),(finalizado_en at time zone 'Europe/Madrid')::date,a.id from public.test_intentos where id=a.id on conflict(usuario_id,fecha_local) do nothing;
 end if;
 update public.test_intentos set camino_resultado=result,camino_superado=passed,camino_xp_obtenida=coalesce(award,0),camino_version=camino_version+1 where id=a.id;
 return public.camino_attempt(a.id);
end $$;
create function public.camino_abandon(p_attempt uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.test_intentos set estado='abandonado',finalizado_en=clock_timestamp(),camino_version=camino_version+1 where id=p_attempt and usuario_id=auth.uid() and camino_id is not null and estado='en_curso';
 return public.camino_attempt(p_attempt);
end $$;


create function public.camino_map(p_path uuid default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.caminos%rowtype;stops jsonb;total integer;done integer;topic_total integer;topic_done integer;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para consultar Mi camino.' using errcode='42501';end if;
 if p_path is null then select * into c from public.caminos where estado='publicado' and published_at is not null order by created_at,id limit 1;
 else select * into c from public.caminos where id=p_path and estado<>'borrador' and published_at is not null;end if;
 select count(*),count(*) filter(where pr.primer_intento_superado_id is not null) into total,done from public.camino_retos r join public.camino_paradas s on s.id=r.parada_id left join public.camino_retos_progreso pr on pr.reto_id=r.id and pr.usuario_id=auth.uid() where s.camino_id=c.id;
 select count(*),count(*) filter(where not exists(select 1 from public.camino_retos r where r.parada_id=s.id and not exists(select 1 from public.camino_retos_progreso pr where pr.reto_id=r.id and pr.usuario_id=auth.uid() and pr.primer_intento_superado_id is not null))) into topic_total,topic_done from public.camino_paradas s where s.camino_id=c.id and tipo='tema';
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.titulo,'type',s.tipo,'blockName',b.nombre,'blockId',s.bloque_id,'challenges',(
  select jsonb_agg(jsonb_build_object('id',r.id,'title',r.titulo,'questionCount',r.numero_preguntas,'criterion',r.criterio_superacion,'threshold',r.porcentaje_minimo,'minimum',case when r.criterio_superacion='finalizacion' then 1 else ceil(r.numero_preguntas::numeric*r.porcentaje_minimo/100.0) end,'xp',r.xp,
   'completed',pr.primer_intento_superado_id is not null,'best',pr.mejor_porcentaje,'lastAttemptId',pr.ultimo_intento_id,'available',private.camino_unlocked(r.id,auth.uid()),
   'activeAttemptId',(select id from public.test_intentos where usuario_id=auth.uid() and camino_reto_id=r.id and estado='en_curso')) order by r.orden)
  from public.camino_retos r left join public.camino_retos_progreso pr on pr.reto_id=r.id and pr.usuario_id=auth.uid() where r.parada_id=s.id)) order by s.orden),'[]'::jsonb) into stops from public.camino_paradas s join public.convocatoria_bloques b on b.id=s.bloque_id where s.camino_id=c.id;
 return jsonb_build_object('paths',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.titulo,'state',p.estado,'convocationName',v.nombre) order by p.created_at) from public.caminos p join public.convocatorias v on v.id=p.convocatoria_id where p.estado<>'borrador' and p.published_at is not null),'[]'::jsonb),
 'unavailableConvocations',coalesce((select jsonb_agg(nombre order by nombre) from public.convocatorias v where v.activo and not exists(select 1 from public.caminos p where p.convocatoria_id=v.id and p.estado='publicado')),'[]'::jsonb),
 'path',case when c.id is null then null else jsonb_build_object('id',c.id,'title',c.titulo,'state',c.estado,'completedChallenges',done,'totalChallenges',total,'completedTopics',topic_done,'totalTopics',topic_total,'percentage',case when total=0 then 0 when done=total then 100 else least(99.99,round(done*100.0/total,2)) end,
 'xp',coalesce((select sum(x.cantidad) from public.camino_xp_movimientos x join public.camino_retos r on r.id=x.reto_id join public.camino_paradas s on s.id=r.parada_id where x.usuario_id=auth.uid() and s.camino_id=c.id),0),'stops',stops) end,
 'activity',private.camino_streak(auth.uid()),'canPractice',public.comprobar_acceso_suscripcion(auth.uid()));
end $$;

-- Guard existing generic entry points so they cannot bypass version checks or path awards.
alter function public.guardar_respuesta_test(uuid,uuid,uuid) rename to guardar_respuesta_test_pre_camino;
alter function public.guardar_respuesta_test_pre_camino(uuid,uuid,uuid) set schema private;
create function public.guardar_respuesta_test(p_test_intento_id uuid,p_pregunta_id uuid,p_respuesta_id uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if exists(select 1 from public.test_intentos where id=p_test_intento_id and usuario_id=auth.uid() and camino_id is not null) then raise exception 'Utiliza el guardado con control de versión de Mi camino.' using errcode='42501';end if;
 return private.guardar_respuesta_test_pre_camino(p_test_intento_id,p_pregunta_id,p_respuesta_id);
end $$;
alter function public.finalizar_intento_test(uuid) rename to finalizar_intento_test_pre_camino;
alter function public.finalizar_intento_test_pre_camino(uuid) set schema private;
create function public.finalizar_intento_test(p_test_intento_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if exists(select 1 from public.test_intentos where id=p_test_intento_id and usuario_id=auth.uid() and camino_id is not null) then raise exception 'Finaliza el intento desde Mi camino.' using errcode='42501';end if;
 return private.finalizar_intento_test_pre_camino(p_test_intento_id);
end $$;
alter function public.consultar_intento_test(uuid) rename to consultar_intento_test_pre_camino;
alter function public.consultar_intento_test_pre_camino(uuid) set schema private;
create function public.consultar_intento_test(p_test_intento_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if exists(select 1 from public.test_intentos where id=p_test_intento_id and usuario_id=auth.uid() and camino_id is not null) then return public.camino_attempt(p_test_intento_id);end if;
 return private.consultar_intento_test_pre_camino(p_test_intento_id);
end $$;
alter function public.listar_intentos_en_curso_test() rename to listar_intentos_en_curso_test_pre_camino;
alter function public.listar_intentos_en_curso_test_pre_camino() set schema private;
create function public.listar_intentos_en_curso_test() returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(item),'[]'::jsonb) from jsonb_array_elements(private.listar_intentos_en_curso_test_pre_camino()) item where not (item ? 'pathId');
$$;
create function private.camino_preserve_options() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if exists(select 1 from public.test_intento_preguntas q join public.test_intentos ti on ti.id=q.test_intento_id where ti.camino_id is not null and q.pregunta_id=old.pregunta_id and old.id=any(q.camino_opciones_ids)) then
 raise exception 'Esta opción tiene historial en Mi camino. Conserva sus referencias y desactiva la pregunta para archivarla.' using errcode='23514';end if;return old;
end $$;
create trigger camino_preserve_options before delete on public.respuestas for each row execute function private.camino_preserve_options();

-- No public write path can mutate a published structure, even if table grants change later.
create function private.camino_frozen() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare path_id uuid;state text;
begin
 if tg_table_name='caminos' then
  if old.estado<>'borrador' and (tg_op='DELETE' or new.convocatoria_id is distinct from old.convocatoria_id or new.published_at is distinct from old.published_at or (new.estado is distinct from old.estado and new.estado<>'archivado')) then raise exception 'El camino publicado conserva su estructura y progreso.' using errcode='23514';end if;
 else
  if tg_table_name='camino_paradas' then path_id:=case when tg_op='INSERT' then new.camino_id else old.camino_id end;
  else select camino_id into path_id from public.camino_paradas where id=case when tg_op='INSERT' then new.parada_id else old.parada_id end;end if;
  select estado into state from public.caminos where id=path_id;
  if state<>'borrador' then raise exception 'La estructura y reglas publicadas están congeladas.' using errcode='23514';end if;
  if tg_op='UPDATE' then
   if tg_table_name='camino_paradas' then select estado into state from public.caminos where id=new.camino_id;
   else select c.estado into state from public.caminos c join public.camino_paradas s on s.camino_id=c.id where s.id=new.parada_id;end if;
   if state<>'borrador' then raise exception 'No se pueden mover reglas ni paradas a un camino publicado.' using errcode='23514';end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger camino_frozen before update or delete on public.caminos for each row execute function private.camino_frozen();
create trigger camino_stops_frozen before insert or update or delete on public.camino_paradas for each row execute function private.camino_frozen();
create trigger camino_rules_frozen before insert or update or delete on public.camino_retos for each row execute function private.camino_frozen();

revoke all on function private.camino_scope(uuid),private.camino_eligible(uuid),private.camino_hash(uuid),private.camino_access(),private.camino_unlocked(uuid,uuid),private.camino_match(uuid,uuid,uuid,jsonb,uuid[]),private.camino_selection(uuid,uuid),private.camino_streak(uuid,date),private.camino_content_valid(uuid),private.camino_invalidate(uuid),private.resultado_test(uuid),private.resumen_test(uuid),private.resultado_test_pre_camino(uuid),private.resumen_test_pre_camino(uuid),private.camino_preserve_options(),private.camino_frozen(),private.guardar_respuesta_test_pre_camino(uuid,uuid,uuid),private.finalizar_intento_test_pre_camino(uuid),private.consultar_intento_test_pre_camino(uuid),private.listar_intentos_en_curso_test_pre_camino() from public,anon,authenticated;
revoke all on function public.camino_admin(text,uuid,uuid,text,jsonb),public.camino_map(uuid),public.camino_start(uuid),public.camino_attempt(uuid),public.camino_save(uuid,uuid,uuid,integer),public.camino_finish(uuid,integer),public.camino_abandon(uuid),public.guardar_respuesta_test(uuid,uuid,uuid),public.finalizar_intento_test(uuid),public.consultar_intento_test(uuid),public.listar_intentos_en_curso_test() from public,anon;
grant execute on function public.camino_admin(text,uuid,uuid,text,jsonb),public.camino_map(uuid),public.camino_start(uuid),public.camino_attempt(uuid),public.camino_save(uuid,uuid,uuid,integer),public.camino_finish(uuid,integer),public.camino_abandon(uuid),public.guardar_respuesta_test(uuid,uuid,uuid),public.finalizar_intento_test(uuid),public.consultar_intento_test(uuid),public.listar_intentos_en_curso_test() to authenticated;
notify pgrst,'reload schema';

-- References in progress and reward rows must match the finalized attempt.
create function private.camino_check_progress() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.test_intentos%rowtype;
begin
 if tg_table_name='camino_retos_progreso' then
  select * into a from public.test_intentos where id=new.ultimo_intento_id;
  if a.usuario_id is distinct from new.usuario_id or a.camino_reto_id is distinct from new.reto_id or a.estado<>'finalizado' then raise exception 'El progreso requiere un resultado propio del mismo reto.' using errcode='23514';end if;
  if new.primer_intento_superado_id is not null and not exists(select 1 from public.test_intentos where id=new.primer_intento_superado_id and usuario_id=new.usuario_id and camino_reto_id=new.reto_id and estado='finalizado' and camino_superado) then raise exception 'La superación requiere un intento válido superado.' using errcode='23514';end if;
 elsif tg_table_name='camino_xp_movimientos' then
  if not exists(select 1 from public.test_intentos where id=new.intento_id and usuario_id=new.usuario_id and camino_reto_id=new.reto_id and estado='finalizado' and camino_superado and (camino_evaluacion->>'xp')::integer=new.cantidad) then raise exception 'La XP requiere una primera superación válida.' using errcode='23514';end if;
 else
  if not exists(select 1 from public.test_intentos where id=new.primer_intento_id and usuario_id=new.usuario_id and camino_id is not null and estado='finalizado' and aciertos+fallos>0 and (finalizado_en at time zone 'Europe/Madrid')::date=new.fecha_local) then raise exception 'La actividad requiere una finalización válida en su fecha local.' using errcode='23514';end if;
 end if;
 return new;
end $$;
create trigger camino_check_progress before insert or update on public.camino_retos_progreso for each row execute function private.camino_check_progress();
create trigger camino_check_xp before insert or update on public.camino_xp_movimientos for each row execute function private.camino_check_progress();
create trigger camino_check_activity before insert or update on public.camino_actividad_diaria for each row execute function private.camino_check_progress();
revoke all on function private.camino_check_progress() from public,anon,authenticated;
