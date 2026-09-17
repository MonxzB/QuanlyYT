alter table public.accounts
  add column if not exists has_password boolean not null default false;

create table if not exists public.account_secrets (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  password_encrypted text,
  two_factor_secret_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_secrets enable row level security;
revoke all on table public.account_secrets from anon, authenticated;

drop trigger if exists account_secrets_updated_at on public.account_secrets;
create trigger account_secrets_updated_at
before update on public.account_secrets
for each row execute function public.set_updated_at();
