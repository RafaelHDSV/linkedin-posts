-- Schema inicial: cache de perfis monitorados e posts coletados do LinkedIn.
-- Tabelas com prefixo linkedin_posts_ para coexistir com outros projetos no mesmo Supabase.
-- Aplicar no SQL Editor do Supabase ou via CLI: supabase db push

create table if not exists public.linkedin_posts_profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  url text not null,
  ativo boolean not null default true,
  intervalo_coleta_horas integer not null default 6,
  ultima_coleta_em timestamptz,
  ultimo_status text check (ultimo_status in ('sucesso', 'erro')),
  falhas_consecutivas integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.linkedin_posts_posts (
  id uuid primary key default gen_random_uuid(),
  post_id text not null unique,
  profile_username text not null,
  texto text not null default '',
  url text not null,
  publicado_em timestamptz,
  tipo_midia text not null default 'texto'
    check (tipo_midia in ('texto', 'imagem', 'video', 'documento', 'outro')),
  midia_urls text[] not null default '{}',
  reacoes_count integer,
  coletado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkedin_posts_posts_profile_username_idx
  on public.linkedin_posts_posts (profile_username);

create index if not exists linkedin_posts_posts_profile_publicado_idx
  on public.linkedin_posts_posts (profile_username, publicado_em desc nulls last);

-- RLS habilitado: o backend usa service_role (ignora RLS). Bloqueia acesso via chave anon/publishable.
alter table public.linkedin_posts_profiles enable row level security;
alter table public.linkedin_posts_posts enable row level security;

create or replace function public.linkedin_posts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists linkedin_posts_profiles_set_updated_at on public.linkedin_posts_profiles;
create trigger linkedin_posts_profiles_set_updated_at
  before update on public.linkedin_posts_profiles
  for each row execute function public.linkedin_posts_set_updated_at();

drop trigger if exists linkedin_posts_posts_set_updated_at on public.linkedin_posts_posts;
create trigger linkedin_posts_posts_set_updated_at
  before update on public.linkedin_posts_posts
  for each row execute function public.linkedin_posts_set_updated_at();
