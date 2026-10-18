-- =====================================================================
--  FOTOS RUGBY TORDOS
--  Script ÚNICO de base de datos para Supabase (reemplaza al 01 y 02 de hockey)
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run
--  Se corre UNA sola vez, en el proyecto nuevo (vacío).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CONFIGURACIÓN (código del equipo)
-- ---------------------------------------------------------------------
create table public.configuracion (
  id             int primary key default 1 check (id = 1),
  codigo_equipo  text not null
);

-- Código inicial. Después se cambia desde Administración en la app.
insert into public.configuracion (codigo_equipo) values ('PANTERAS2026');


-- ---------------------------------------------------------------------
-- 2. PERFILES (papás y mamás)
--    Los crea la app al registrarse, después de validar el código.
-- ---------------------------------------------------------------------
create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nombre      text not null,
  apellido    text not null default '',
  rol         text not null check (rol in ('mamá', 'papá')),
  es_admin    boolean not null default false,
  bloqueado   boolean not null default false,
  creado_en   timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. DIVISIONES (se pueden sumar nuevas desde la app)
-- ---------------------------------------------------------------------
create table public.divisiones (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  orden      int not null default 100,
  creado_en  timestamptz not null default now()
);

insert into public.divisiones (nombre, orden) values
  ('M6 y M7', 1),
  ('M8',      2),
  ('M9',      3),
  ('M10',     4);


-- ---------------------------------------------------------------------
-- 4. JUGADORES y su relación con los padres (mamá y papá comparten hijo)
-- ---------------------------------------------------------------------
create table public.jugadores (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  apellido    text not null,
  foto_path   text,                       -- foto de perfil (en Supabase Storage)
  creado_por  uuid references public.perfiles(id) on delete set null,
  creado_en   timestamptz not null default now()
);

create table public.familia (
  perfil_id   uuid   not null references public.perfiles(id)  on delete cascade,
  jugador_id  bigint not null references public.jugadores(id) on delete cascade,
  primary key (perfil_id, jugador_id)
);


-- ---------------------------------------------------------------------
-- 5. FOTOS (la original vive en Google Drive, acá van las etiquetas)
-- ---------------------------------------------------------------------
create table public.fotos (
  id                 bigint generated always as identity primary key,
  drive_file_id      text not null unique,      -- ID del archivo en Drive
  miniatura_path     text not null,             -- miniatura en Supabase Storage
  nombre_archivo     text,
  ancho              int,
  alto               int,
  -- Etiquetas obligatorias
  mes                int not null check (mes between 1 and 12),
  anio               int not null check (anio between 2015 and 2100),
  division_id        bigint not null references public.divisiones(id),
  -- Etiquetas optativas
  tipo_actividad     text check (tipo_actividad in
                       ('Entrenamiento', 'Partido', 'Encuentro', 'Torneo',
                        'Tercer Tiempo', 'Salida', 'Otros')),
  titulo             text,
  -- Control
  subido_por         uuid references public.perfiles(id) on delete set null,
  creado_en          timestamptz not null default now(),
  -- Papelera: si tiene fecha, la foto está "borrada" pero se puede recuperar
  en_papelera_desde  timestamptz,
  enviada_por        uuid references public.perfiles(id) on delete set null
);

create index fotos_fecha_idx    on public.fotos (anio desc, mes desc);
create index fotos_division_idx on public.fotos (division_id);

create table public.foto_jugadores (
  foto_id     bigint not null references public.fotos(id)     on delete cascade,
  jugador_id  bigint not null references public.jugadores(id) on delete cascade,
  primary key (foto_id, jugador_id)
);

create index foto_jugadores_jugador_idx on public.foto_jugadores (jugador_id);


-- ---------------------------------------------------------------------
-- 6. FUNCIONES DE AYUDA (quién está activo / quién es admin)
-- ---------------------------------------------------------------------
create or replace function public.es_activo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and not bloqueado
  );
$$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and es_admin and not bloqueado
  );
$$;


-- ---------------------------------------------------------------------
-- 7. SEGURIDAD (Row Level Security)
--    Nadie que no esté logueado y activo puede ver ni tocar nada.
-- ---------------------------------------------------------------------
alter table public.configuracion   enable row level security;
alter table public.perfiles        enable row level security;
alter table public.divisiones      enable row level security;
alter table public.jugadores       enable row level security;
alter table public.familia         enable row level security;
alter table public.fotos           enable row level security;
alter table public.foto_jugadores  enable row level security;

-- Configuración: solo admins la ven
create policy "admins ven configuracion" on public.configuracion
  for select using (public.es_admin());

-- Perfiles: los activos ven a todos; cada uno edita solo su nombre, apellido y rol
create policy "activos ven perfiles" on public.perfiles
  for select using (public.es_activo());
create policy "cada uno edita su perfil" on public.perfiles
  for update using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.perfiles from anon, authenticated;
grant  update (nombre, apellido, rol) on public.perfiles to authenticated;

-- Divisiones: todos ven y suman; solo admins renombran o borran
create policy "activos ven divisiones" on public.divisiones
  for select using (public.es_activo());
create policy "activos suman divisiones" on public.divisiones
  for insert with check (public.es_activo());
create policy "admins editan divisiones" on public.divisiones
  for update using (public.es_admin()) with check (public.es_admin());
create policy "admins borran divisiones" on public.divisiones
  for delete using (public.es_admin());

-- Jugadores: todos ven, suman y editan; solo admins borran
create policy "activos ven jugadores" on public.jugadores
  for select using (public.es_activo());
create policy "activos suman jugadores" on public.jugadores
  for insert with check (public.es_activo() and creado_por = auth.uid());
create policy "activos editan jugadores" on public.jugadores
  for update using (public.es_activo()) with check (public.es_activo());
create policy "admins borran jugadores" on public.jugadores
  for delete using (public.es_admin());

-- Familia: todos ven; cada uno se vincula/desvincula con su hijo
create policy "activos ven familias" on public.familia
  for select using (public.es_activo());
create policy "cada uno se vincula" on public.familia
  for insert with check (public.es_activo() and perfil_id = auth.uid());
create policy "cada uno se desvincula" on public.familia
  for delete using (perfil_id = auth.uid() or public.es_admin());

-- Fotos: todos ven, suben y editan cualquier foto (incluye mandar a papelera);
--        solo admins borran definitivamente
create policy "activos ven fotos" on public.fotos
  for select using (public.es_activo());
create policy "activos suben fotos" on public.fotos
  for insert with check (public.es_activo() and subido_por = auth.uid());
create policy "activos editan fotos" on public.fotos
  for update using (public.es_activo()) with check (public.es_activo());
create policy "admins borran fotos" on public.fotos
  for delete using (public.es_admin());

-- Quién está en cada foto: todos ven, agregan y quitan
create policy "activos ven etiquetas" on public.foto_jugadores
  for select using (public.es_activo());
create policy "activos agregan etiquetas" on public.foto_jugadores
  for insert with check (public.es_activo());
create policy "activos quitan etiquetas" on public.foto_jugadores
  for delete using (public.es_activo());


-- ---------------------------------------------------------------------
-- 8. FUNCIONES DE ADMIN
-- ---------------------------------------------------------------------
create or replace function public.admin_cambiar_codigo(nuevo text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden cambiar el código';
  end if;
  if length(trim(nuevo)) < 4 then
    raise exception 'El código debe tener al menos 4 caracteres';
  end if;
  update public.configuracion set codigo_equipo = upper(trim(nuevo)) where id = 1;
end;
$$;

create or replace function public.admin_bloquear(perfil uuid, bloquear boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden pausar cuentas';
  end if;
  if perfil = auth.uid() then
    raise exception 'No podés pausar tu propia cuenta';
  end if;
  update public.perfiles set bloqueado = bloquear where id = perfil;
end;
$$;

create or replace function public.admin_hacer_admin(perfil uuid, admin boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden nombrar administradores';
  end if;
  if perfil = auth.uid() and not admin then
    raise exception 'No podés quitarte el rol de admin a vos mismo';
  end if;
  update public.perfiles set es_admin = admin where id = perfil;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. "DESPERTADOR" (lo llama el Worker de Cloudflare cada 2 días para
--    que Supabase no se pause por inactividad)
-- ---------------------------------------------------------------------
create or replace function public.ping()
returns int
language sql stable
as $$ select 1; $$;

grant execute on function public.ping() to anon;


-- ---------------------------------------------------------------------
-- 10. ALMACENAMIENTO de miniaturas y fotos de perfil (privado)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('miniaturas', 'miniaturas', false)
on conflict (id) do nothing;

create policy "activos ven miniaturas" on storage.objects
  for select using (bucket_id = 'miniaturas' and public.es_activo());
create policy "activos suben miniaturas" on storage.objects
  for insert with check (bucket_id = 'miniaturas' and public.es_activo());
create policy "activos reemplazan miniaturas" on storage.objects
  for update using (bucket_id = 'miniaturas' and public.es_activo());
create policy "admins borran miniaturas" on storage.objects
  for delete using (bucket_id = 'miniaturas' and public.es_admin());


-- =====================================================================
--  LISTO. Si al correrlo aparece "Success. No rows returned", está bien.
-- =====================================================================
