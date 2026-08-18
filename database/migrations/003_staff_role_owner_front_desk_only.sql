-- Keep only the two staff roles currently supported by the production dashboard.
-- This migration is transactional and aborts before any schema change when a
-- staff profile still uses caregiver or housekeeper.

begin;

do $$
begin
  if exists (
    select 1
    from public.staff_profiles
    where role::text not in ('owner', 'front_desk')
  ) then
    raise exception 'Cannot reduce staff_role: caregiver/housekeeper profiles still exist';
  end if;
end
$$;

-- RLS policies depend on current_staff_role(), whose return type is the old
-- enum. Keep that enum as a compatibility type so no policy is dropped.
alter type public.staff_role rename to staff_role_legacy;
create type public.staff_role as enum ('owner', 'front_desk');

alter table public.staff_profiles
  alter column role type public.staff_role
  using role::text::public.staff_role;

create or replace function public.current_staff_role()
returns public.staff_role_legacy
language sql
stable
security definer
set search_path = public
as $$
  select role::text::public.staff_role_legacy
  from public.staff_profiles
  where auth_user_id = auth.uid()
    and is_active
  limit 1
$$;

comment on type public.staff_role is
  'Active staff roles supported by the production dashboard: owner and front_desk';
comment on type public.staff_role_legacy is
  'Compatibility return type for existing RLS policies; do not use for staff_profiles.role';

commit;

-- Verification: should return only owner and front_desk.
select enumlabel as active_staff_role
from pg_enum
where enumtypid = 'public.staff_role'::regtype
order by enumsortorder;
