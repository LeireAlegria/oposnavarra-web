create table public.mensajes_contacto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  mensaje text not null check (char_length(btrim(mensaje)) between 1 and 5000),
  created_at timestamptz not null default now(),
  leido boolean not null default false
);
create index mensajes_contacto_created_at_idx on public.mensajes_contacto (created_at desc, id desc);
alter table public.mensajes_contacto enable row level security;
revoke all on public.mensajes_contacto from anon, authenticated;
grant select on public.mensajes_contacto to authenticated;
grant update (leido) on public.mensajes_contacto to authenticated;
create policy contact_admin_select on public.mensajes_contacto for select to authenticated using (public.es_admin_actual());
create policy contact_admin_update on public.mensajes_contacto for update to authenticated using (public.es_admin_actual()) with check (public.es_admin_actual());

-- Only the trusted server can supply the source fingerprint. No raw IP is stored.
create table public.contact_rate_limits (
  ip_hash text not null,
  accepted_at timestamptz not null default clock_timestamp()
);
create index contact_rate_limits_lookup_idx on public.contact_rate_limits (ip_hash, accepted_at);
alter table public.contact_rate_limits enable row level security;
revoke all on public.contact_rate_limits from anon, authenticated;
create function public.guardar_mensaje_contacto(p_nombre text, p_email text, p_mensaje text, p_ip_hash text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid fingerprint' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  delete from public.contact_rate_limits where accepted_at <= clock_timestamp() - interval '15 minutes';
  if (select count(*) from public.contact_rate_limits where ip_hash = p_ip_hash) >= 5 then
    raise exception 'Rate limit exceeded' using errcode = 'P0001';
  end if;
  insert into public.mensajes_contacto(nombre,email,mensaje) values(btrim(p_nombre),btrim(p_email),btrim(p_mensaje));
  insert into public.contact_rate_limits(ip_hash) values(p_ip_hash);
end;
$$;
revoke all on function public.guardar_mensaje_contacto(text,text,text,text) from public, anon, authenticated;
grant execute on function public.guardar_mensaje_contacto(text,text,text,text) to service_role;
