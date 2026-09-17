alter table public.niches add column if not exists sort_order bigint;

with ranked as (
  select id, row_number() over (order by created_at, name, id) - 1 as position
  from public.niches
)
update public.niches
set sort_order = ranked.position
from ranked
where public.niches.id = ranked.id and public.niches.sort_order is null;

alter table public.niches alter column sort_order set default ((extract(epoch from clock_timestamp()) * 1000)::bigint);
alter table public.niches alter column sort_order set not null;

create index if not exists niches_sort_order_idx on public.niches(sort_order, name);

notify pgrst, 'reload schema';
