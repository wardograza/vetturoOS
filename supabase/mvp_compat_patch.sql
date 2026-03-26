alter table if exists public.profiles
  add column if not exists username text,
  add column if not exists phone_number text,
  add column if not exists permissions text[] not null default '{}';

alter table if exists public.profiles
  alter column mall_id drop not null;

alter table if exists public.user_invites
  add column if not exists full_name text,
  add column if not exists username text,
  add column if not exists phone_number text,
  add column if not exists permissions text[] not null default '{}';

alter table if exists public.user_invites
  alter column mall_id drop not null,
  alter column invited_by drop not null,
  alter column temp_password_hash drop not null;

alter table if exists public.tasks
  alter column mall_id drop not null,
  alter column created_by drop not null;

alter table if exists public.documents
  add column if not exists domain_category text,
  add column if not exists sub_category text,
  add column if not exists purpose_summary text,
  add column if not exists source_payload jsonb,
  add column if not exists conflict_count integer not null default 0;

alter table if exists public.documents
  alter column mall_id drop not null,
  alter column uploaded_by drop not null;

alter table if exists public.document_memory_entries
  alter column mall_id drop not null;

alter table if exists public.decision_dna_scores
  alter column mall_id drop not null;

alter table if exists public.communications
  alter column mall_id drop not null;

create table if not exists public.organization_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  organization_code text,
  hq_full_address text,
  org_website_url text,
  org_logo_url text,
  branding_figma_link text,
  primary_brand_color text,
  secondary_brand_color text,
  portfolio_size_count integer,
  org_go_live_target date,
  standard_hours_open text,
  standard_hours_close text,
  fiscal_year_start text,
  currency_preference text,
  master_contract_link text,
  erp_system_provider text,
  web_app_access_url text,
  onboarding_lead_name text,
  onboarding_lead_email text,
  onboarding_lead_phone text,
  group_cfo_email text,
  group_cto_it_email text,
  group_leasing_head text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  brand_poc_name text,
  brand_poc_email text,
  store_manager_name text,
  store_manager_phone text,
  billing_contact_email text,
  nexus_leasing_lead text,
  parent_company text,
  category_primary text,
  category_secondary text,
  brand_grade text,
  store_format text,
  target_audience text,
  avg_transaction_value numeric(12,2),
  annual_marketing_spend numeric(12,2),
  usp_description text,
  expansion_history text,
  unit_code text not null,
  lease_start_date date,
  lease_expiry_date date,
  lock_in_expiry date,
  rent_amount numeric(12,2) not null default 0,
  mg_rent_monthly numeric(12,2),
  gto_percent numeric(8,2),
  escalation_freq_months integer,
  escalation_percent numeric(8,2),
  last_escalation_date date,
  security_deposit numeric(12,2),
  cam_rate_sqft numeric(12,2),
  utility_meter_id text,
  unit_gla_sba numeric(12,2),
  power_load_kva numeric(12,2),
  gas_connection_yn text,
  water_inlet_yn text,
  exhaust_provision_yn text,
  signage_type text,
  insurance_expiry date,
  trade_license_expiry date,
  last_audit_score numeric(8,2),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_name, unit_code)
);

create table if not exists public.app_configs (
  id uuid primary key default gen_random_uuid(),
  alert_threshold_p1_minutes integer not null default 30,
  alert_threshold_p2_minutes integer not null default 120,
  alert_threshold_p3_minutes integer not null default 480,
  data_refresh_minutes integer not null default 30 check (data_refresh_minutes between 15 and 30),
  auto_escalation_enabled boolean not null default true,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  bot_approval_probe_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.app_configs (
  id,
  alert_threshold_p1_minutes,
  alert_threshold_p2_minutes,
  alert_threshold_p3_minutes,
  data_refresh_minutes,
  auto_escalation_enabled,
  email_enabled,
  whatsapp_enabled,
  bot_approval_probe_enabled
)
values (
  '00000000-0000-0000-0000-000000000001',
  30,
  120,
  480,
  30,
  true,
  true,
  false,
  true
)
on conflict (id) do update set
  updated_at = now();

insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do nothing;
