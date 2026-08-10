-- Store the customer's Mi Home account identifier used for room-camera sharing.
-- Treat this value as personal data and expose it only to authorized staff.

alter table public.customers
  add column if not exists mihome_app_id text;

alter table public.customers
  drop constraint if exists customers_mihome_app_id_length;

alter table public.customers
  add constraint customers_mihome_app_id_length
  check (mihome_app_id is null or char_length(mihome_app_id) <= 120);

comment on column public.customers.mihome_app_id is
  'Mi Home app account identifier supplied by the customer for camera access sharing';
