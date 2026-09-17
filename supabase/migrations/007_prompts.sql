create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid references public.niches(id) on delete set null,
  title text,
  content text not null check (char_length(content) between 1 and 20000),
  sort_order bigint not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prompts enable row level security;

drop policy if exists prompts_read on public.prompts;
drop policy if exists prompts_write on public.prompts;
drop policy if exists prompts_edit on public.prompts;
drop policy if exists prompts_delete on public.prompts;

create policy prompts_read on public.prompts for select to authenticated
using (public.current_app_role() in ('viewer', 'manager', 'admin'));

create policy prompts_write on public.prompts for insert to authenticated
with check (public.current_app_role() in ('manager', 'admin'));

create policy prompts_edit on public.prompts for update to authenticated
using (public.current_app_role() in ('manager', 'admin'))
with check (public.current_app_role() in ('manager', 'admin'));

create policy prompts_delete on public.prompts for delete to authenticated
using (public.current_app_role() in ('manager', 'admin'));

drop trigger if exists prompts_updated_at on public.prompts;
create trigger prompts_updated_at
before update on public.prompts
for each row execute function public.set_updated_at();

create index if not exists prompts_niche_order_idx on public.prompts(niche_id, sort_order, created_at);
create index if not exists prompts_updated_at_idx on public.prompts(updated_at desc);

notify pgrst, 'reload schema';
