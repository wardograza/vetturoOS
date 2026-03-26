create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  username text unique,
  phone_number text,
  role text not null default 'mall_manager',
  permissions text[] not null default '{}',
  must_reset_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text,
  email text not null,
  phone_number text,
  role text not null,
  permissions text[] not null default '{}',
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

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

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  department text not null,
  priority text not null default 'P2',
  status text not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  proof_required boolean not null default false,
  sla_due_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  document_type text not null default 'general',
  domain_category text,
  sub_category text,
  purpose_summary text,
  status text not null default 'pending_approval',
  parser_summary text,
  source_payload jsonb,
  conflict_count integer not null default 0,
  is_in_core_memory boolean not null default false,
  uploaded_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.document_memory_entries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  kind text not null default 'structured_fields',
  title text not null,
  raw_content text,
  structured_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  recipient_name text not null,
  recipient_email text,
  recipient_phone text,
  channel text not null,
  purpose text not null,
  subject text,
  body_preview text not null default '',
  current_status text not null default 'queued',
  escalation_level integer not null default 1,
  requires_action boolean not null default true,
  sla_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decision_dna_scores (
  id uuid primary key default gen_random_uuid(),
  candidate_brand_name text not null,
  category text not null,
  category_synergy numeric(5,2) not null default 0,
  technical_fit numeric(5,2) not null default 0,
  financial_health numeric(5,2) not null default 0,
  cannibalization_risk numeric(5,2) not null default 0,
  total_score numeric(5,2) not null default 0,
  recommendation text not null default 'Review',
  created_at timestamptz not null default now()
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
on conflict (id) do nothing;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_organization_profiles_updated_at on public.organization_profiles;
create trigger set_organization_profiles_updated_at before update on public.organization_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_tenant_profiles_updated_at on public.tenant_profiles;
create trigger set_tenant_profiles_updated_at before update on public.tenant_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_communications_updated_at on public.communications;
create trigger set_communications_updated_at before update on public.communications
for each row execute function public.set_updated_at();

drop trigger if exists set_app_configs_updated_at on public.app_configs;
create trigger set_app_configs_updated_at before update on public.app_configs
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_invites enable row level security;
alter table public.organization_profiles enable row level security;
alter table public.tenant_profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.document_memory_entries enable row level security;
alter table public.communications enable row level security;
alter table public.decision_dna_scores enable row level security;
alter table public.app_configs enable row level security;

drop policy if exists "authenticated read profiles" on public.profiles;
create policy "authenticated read profiles" on public.profiles
for select to authenticated using (true);

drop policy if exists "authenticated update own profile" on public.profiles;
create policy "authenticated update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "authenticated read invites" on public.user_invites;
create policy "authenticated read invites" on public.user_invites
for select to authenticated using (true);

drop policy if exists "authenticated read organization profiles" on public.organization_profiles;
create policy "authenticated read organization profiles" on public.organization_profiles
for select to authenticated using (true);

drop policy if exists "authenticated insert organization profiles" on public.organization_profiles;
create policy "authenticated insert organization profiles" on public.organization_profiles
for insert to authenticated with check (true);

drop policy if exists "authenticated update organization profiles" on public.organization_profiles;
create policy "authenticated update organization profiles" on public.organization_profiles
for update to authenticated using (true) with check (true);

drop policy if exists "authenticated read tenant profiles" on public.tenant_profiles;
create policy "authenticated read tenant profiles" on public.tenant_profiles
for select to authenticated using (true);

drop policy if exists "authenticated insert tenant profiles" on public.tenant_profiles;
create policy "authenticated insert tenant profiles" on public.tenant_profiles
for insert to authenticated with check (true);

drop policy if exists "authenticated update tenant profiles" on public.tenant_profiles;
create policy "authenticated update tenant profiles" on public.tenant_profiles
for update to authenticated using (true) with check (true);

drop policy if exists "authenticated read tasks" on public.tasks;
create policy "authenticated read tasks" on public.tasks
for select to authenticated using (true);

drop policy if exists "authenticated insert tasks" on public.tasks;
create policy "authenticated insert tasks" on public.tasks
for insert to authenticated with check (true);

drop policy if exists "authenticated update tasks" on public.tasks;
create policy "authenticated update tasks" on public.tasks
for update to authenticated using (true) with check (true);

drop policy if exists "authenticated read documents" on public.documents;
create policy "authenticated read documents" on public.documents
for select to authenticated using (true);

drop policy if exists "authenticated insert documents" on public.documents;
create policy "authenticated insert documents" on public.documents
for insert to authenticated with check (true);

drop policy if exists "authenticated update documents" on public.documents;
create policy "authenticated update documents" on public.documents
for update to authenticated using (true) with check (true);

drop policy if exists "authenticated read memory entries" on public.document_memory_entries;
create policy "authenticated read memory entries" on public.document_memory_entries
for select to authenticated using (true);

drop policy if exists "authenticated insert memory entries" on public.document_memory_entries;
create policy "authenticated insert memory entries" on public.document_memory_entries
for insert to authenticated with check (true);

drop policy if exists "authenticated read communications" on public.communications;
create policy "authenticated read communications" on public.communications
for select to authenticated using (true);

drop policy if exists "authenticated insert communications" on public.communications;
create policy "authenticated insert communications" on public.communications
for insert to authenticated with check (true);

drop policy if exists "authenticated update communications" on public.communications;
create policy "authenticated update communications" on public.communications
for update to authenticated using (true) with check (true);

drop policy if exists "authenticated read decision dna" on public.decision_dna_scores;
create policy "authenticated read decision dna" on public.decision_dna_scores
for select to authenticated using (true);

drop policy if exists "authenticated insert decision dna" on public.decision_dna_scores;
create policy "authenticated insert decision dna" on public.decision_dna_scores
for insert to authenticated with check (true);

drop policy if exists "authenticated read app configs" on public.app_configs;
create policy "authenticated read app configs" on public.app_configs
for select to authenticated using (true);

drop policy if exists "authenticated update app configs" on public.app_configs;
create policy "authenticated update app configs" on public.app_configs
for update to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read vault" on storage.objects;
create policy "authenticated read vault" on storage.objects
for select to authenticated using (bucket_id = 'vault');

drop policy if exists "authenticated upload vault" on storage.objects;
create policy "authenticated upload vault" on storage.objects
for insert to authenticated with check (bucket_id = 'vault');

drop policy if exists "authenticated update vault" on storage.objects;
create policy "authenticated update vault" on storage.objects
for update to authenticated using (bucket_id = 'vault') with check (bucket_id = 'vault');
