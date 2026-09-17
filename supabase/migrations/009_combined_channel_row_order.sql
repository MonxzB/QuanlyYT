-- Give channels and accounts without channels one shared, collision-free order.
-- Existing channel order is preserved, followed by the existing account order.
with ranked as (
  select id, row_number() over (order by sort_order, updated_at desc, id) - 1 as position
  from public.channels
)
update public.channels
set sort_order = ranked.position
from ranked
where public.channels.id = ranked.id;

with channel_count as (
  select count(*)::bigint as value from public.channels
), ranked as (
  select id, row_number() over (order by sort_order, created_at desc, id) - 1 as position
  from public.accounts
)
update public.accounts
set sort_order = channel_count.value + ranked.position
from ranked, channel_count
where public.accounts.id = ranked.id;

notify pgrst, 'reload schema';
