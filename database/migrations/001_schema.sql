-- LOEI CAT HOTEL — Migration 001: Schema
-- วางทั้งไฟล์ใน Supabase SQL Editor แล้วกด Run
-- ต้องรันไฟล์นี้ก่อน 002 และ 003

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────

create type public.room_type as enum ('villa', 'condo', 'reserve');
create type public.room_status as enum ('active', 'maintenance', 'inactive');
create type public.booking_status as enum (
  'draft', 'held', 'pending_deposit', 'confirmed', 'checked_in',
  'checked_out', 'cancellation_review', 'cancelled', 'expired'
);
create type public.payment_status as enum ('pending', 'paid', 'failed', 'voided');
create type public.refund_status as enum ('requested', 'under_review', 'approved', 'rejected', 'refunded');
create type public.staff_role as enum ('owner', 'front_desk', 'caregiver', 'housekeeper');
create type public.care_task_type as enum (
  'clean', 'water', 'food', 'medication', 'photo', 'incident', 'litter', 'supply_request'
);

-- ─────────────────────────────────────────────────────────
-- Core reference
-- ─────────────────────────────────────────────────────────

create table public.hotel_settings (
  hotel_setting_id uuid primary key default gen_random_uuid(),
  business_code text not null unique,
  business_name text not null,
  timezone text not null default 'Asia/Bangkok',
  maximum_daily_pets integer not null default 30 check (maximum_daily_pets > 0),
  deposit_percent numeric(5,2) not null default 50.00 check (deposit_percent between 0 and 100),
  check_in_start time not null default '08:30',
  check_in_end time not null default '18:00',
  check_out_start time not null default '12:00',
  check_out_end time not null default '18:00',
  late_pickup_end time not null default '20:00',
  -- DECISION PENDING (docs/10 ข้อ "เวลาทำความสะอาด"): ตั้ง 0 ไว้ก่อน
  -- เมื่อเจ้าของยืนยันแล้วให้ update ค่านี้ ไม่ต้องแก้ schema
  cleaning_buffer_minutes integer not null default 0 check (cleaning_buffer_minutes >= 0),
  owner_phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  room_id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  display_name text not null,
  room_type public.room_type not null,
  minimum_pets integer not null check (minimum_pets > 0),
  maximum_pets integer not null check (maximum_pets >= minimum_pets),
  display_to_customer boolean not null default true,
  recommendation_order integer not null default 100,
  status public.room_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.rate_plans (
  rate_plan_id uuid primary key default gen_random_uuid(),
  rate_plan_code text not null unique,
  rate_plan_name text not null,
  billing_unit text not null check (billing_unit in ('hour', 'night')),
  price_per_pet numeric(12,2) not null check (price_per_pet >= 0),
  maximum_hours integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- Staff
-- ─────────────────────────────────────────────────────────

create table public.staff_profiles (
  staff_profile_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  role public.staff_role not null,
  preferred_language text not null default 'th',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- Customers and pets
-- ─────────────────────────────────────────────────────────

create table public.customers (
  customer_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  preferred_name text,
  phone text not null,
  line_user_id text unique,
  line_display_name text,
  emergency_contact_name text,
  emergency_contact_phone text,
  acquisition_source text,
  privacy_consent_at timestamptz,
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.pets (
  pet_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id) on delete restrict,
  pet_name text not null,
  birth_date date,
  age_text text,
  sex text,
  breed text,
  color text,
  weight_kg numeric(6,2),
  microchip_number text,
  temperament_notes text,
  bite_scratch_notes text,
  escape_risk_notes text,
  feeding_notes text,
  allergy_notes text,
  medical_notes text,
  veterinarian_name text,
  veterinarian_phone text,
  care_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ─────────────────────────────────────────────────────────
-- Bookings
-- ─────────────────────────────────────────────────────────

create table public.bookings (
  booking_id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  customer_id uuid not null references public.customers(customer_id) on delete restrict,
  status public.booking_status not null default 'draft',
  source text not null check (source in ('line_oa', 'web', 'phone', 'walk_in', 'staff')),
  check_in_at timestamptz not null,
  check_out_at timestamptz not null,
  total_pets integer not null check (total_pets > 0 and total_pets <= 30),
  rate_plan_code_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  quantity_snapshot numeric(12,2) not null check (quantity_snapshot > 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  deposit_amount numeric(12,2) not null check (deposit_amount >= 0),
  balance_amount numeric(12,2) not null check (balance_amount >= 0),
  currency text not null default 'THB',
  deposit_due_at timestamptz,
  health_document_status text not null default 'pending'
    check (health_document_status in ('pending', 'submitted', 'verified', 'verified_on_site')),
  customer_notes text,
  staff_notes text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint chk_bookings_time_order check (check_out_at > check_in_at),
  constraint chk_bookings_amount_math check (round(deposit_amount + balance_amount, 2) = round(total_amount, 2))
);

create table public.booking_pets (
  booking_pet_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(booking_id) on delete restrict,
  pet_id uuid not null references public.pets(pet_id) on delete restrict,
  feeding_notes_snapshot text,
  medication_notes_snapshot text,
  care_notes_snapshot text,
  created_at timestamptz not null default now(),
  unique (booking_id, pet_id)
);

create table public.booking_room_allocations (
  booking_room_allocation_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(booking_id) on delete restrict,
  room_id uuid not null references public.rooms(room_id) on delete restrict,
  allocated_from timestamptz not null,
  allocated_until timestamptz not null,
  pet_count integer not null check (pet_count > 0),
  status text not null default 'active' check (status in ('active', 'released', 'completed')),
  allocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint chk_allocations_time_order check (allocated_until > allocated_from)
);

-- ─────────────────────────────────────────────────────────
-- Money
-- ─────────────────────────────────────────────────────────

create table public.payments (
  payment_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(booking_id) on delete restrict,
  payment_type text not null check (payment_type in ('deposit', 'balance', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  status public.payment_status not null default 'pending',
  payment_method text,
  provider_reference text,
  evidence_object_path text,
  paid_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_reference)
);

create table public.refund_requests (
  refund_request_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(booking_id) on delete restrict,
  payment_id uuid references public.payments(payment_id) on delete restrict,
  requested_amount numeric(12,2) not null check (requested_amount > 0),
  reason text not null,
  status public.refund_status not null default 'requested',
  decision_notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  refunded_at timestamptz,
  evidence_object_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- Operations (เพิ่มจาก HANDOFF.md ข้อ 5)
-- ─────────────────────────────────────────────────────────

create table public.booking_status_history (
  booking_status_history_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(booking_id) on delete restrict,
  previous_status public.booking_status,
  next_status public.booking_status not null,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system' check (actor_type in ('customer', 'staff', 'system', 'ai')),
  occurred_at timestamptz not null default now()
);

-- กัน LINE push ซ้ำระดับฐานข้อมูล ไม่ใช่แค่ระดับโค้ด
-- idempotency_key ตัวอย่าง: 'booking_confirmed:BK-20260805-001'
create table public.line_message_log (
  idempotency_key text primary key,
  booking_id uuid references public.bookings(booking_id) on delete set null,
  event_type text not null,
  line_user_id text not null,
  sent_at timestamptz not null default now(),
  line_response jsonb
);

create table public.daily_care_tasks (
  daily_care_task_id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(booking_id) on delete set null,
  room_id uuid references public.rooms(room_id) on delete set null,
  pet_id uuid references public.pets(pet_id) on delete set null,
  task_type public.care_task_type not null,
  task_date date not null default (now() at time zone 'Asia/Bangkok')::date,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'skipped')),
  notes text,
  photo_object_path text,
  performed_by uuid references auth.users(id) on delete set null,
  performed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.print_history (
  print_history_id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(booking_id) on delete set null,
  room_id uuid references public.rooms(room_id) on delete set null,
  document_type text not null check (
    document_type in ('room_label_80mm', 'booking_confirmation_80mm', 'booking_pass')
  ),
  printed_by uuid references auth.users(id) on delete set null,
  printed_at timestamptz not null default now()
);

create table public.emergency_consent (
  emergency_consent_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(booking_id) on delete restrict,
  customer_id uuid not null references public.customers(customer_id) on delete restrict,
  has_regular_clinic boolean not null default false,
  clinic_name text,
  clinic_phone text,
  allow_partner_clinic boolean not null default false,
  spending_limit_thb numeric(12,2),
  consent_text_version text not null,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  audit_log_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system' check (actor_type in ('customer', 'staff', 'system', 'ai')),
  before_data jsonb,
  after_data jsonb,
  reason text,
  occurred_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────

create index idx_bookings_stay_range on public.bookings (check_in_at, check_out_at)
  where status in ('held', 'pending_deposit', 'confirmed', 'checked_in');
create index idx_bookings_deposit_expiry on public.bookings (deposit_due_at)
  where status = 'pending_deposit';
create index idx_bookings_customer on public.bookings (customer_id);
create index idx_allocations_room_range on public.booking_room_allocations (room_id, allocated_from, allocated_until)
  where status = 'active';
create index idx_pets_customer on public.pets (customer_id) where deleted_at is null;
create index idx_payments_booking on public.payments (booking_id, status);
create index idx_customers_line_user on public.customers (line_user_id) where line_user_id is not null;
create index idx_care_tasks_date on public.daily_care_tasks (task_date, status);
create index idx_audit_entity on public.audit_log (entity_type, entity_id, occurred_at desc);
