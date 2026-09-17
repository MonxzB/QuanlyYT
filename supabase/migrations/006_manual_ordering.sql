alter table public.channels add column if not exists sort_order bigint;
alter table public.accounts add column if not exists sort_order bigint;

with ranked as (
  select id, row_number() over (order by updated_at desc, id) - 1 as position
  from public.channels
)
update public.channels
set sort_order = ranked.position
from ranked
where public.channels.id = ranked.id and public.channels.sort_order is null;

with ranked as (
  select id, row_number() over (order by created_at desc, id) - 1 as position
  from public.accounts
)
update public.accounts
set sort_order = ranked.position
from ranked
where public.accounts.id = ranked.id and public.accounts.sort_order is null;

alter table public.channels alter column sort_order set default 0;
alter table public.channels alter column sort_order set not null;
alter table public.accounts alter column sort_order set default 0;
alter table public.accounts alter column sort_order set not null;

create index if not exists channels_sort_order_idx on public.channels(sort_order, updated_at desc);
create index if not exists accounts_sort_order_idx on public.accounts(sort_order, created_at desc);

notify pgrst, 'reload schema';
