create extension if not exists "pgcrypto";

create type public.app_role as enum (
  'super_admin',
  'mall_manager',
  'leasing_manager',
  'finance',
  'facilities'
);

create type public.document_type as enum ('lease', 'budget');

create type public.document_status as enum (
  'pending_parse',
  'pending_approval',
  'approved',
  'rejected',
  'requires_edit'
);

create type public.memory_entry_kind as enum ('raw_text', 'structured_fields');

create type public.task_status as enum (
  'open',
  'assigned',
  'in_progress',
  'awaiting_approval',
  'awaiting_proof',
  'closed',
  'reopened'
);

create type public.communication_channel as enum ('email', 'whatsapp');

create type public.communication_status as enum (
  'queued',
  'sending',
  'sent',
  'delivered',
  'opened',
  'read',
  'clicked',
  'replied',
  'actioned',
  'escalated',
  'bounced',
  'failed'
);

create type public.communication_purpose as enum (
  'lease_escalation',
  'budget_follow_up',
  'brand_outreach',
  'priority_escalation',
  'compliance_reminder',
  'approval_request'
);

create type public.unit_status as enum ('vacant', 'occupied', 'under_negotiation');

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.malls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null unique,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  mall_id uuid not null references public.malls(id) on delete cascade,
  role public.app_role not null,
  full_name text not null,
  email text not null unique,
  invited_by uuid references public.profiles(id),
  must_reset_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.malls(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  temp_password_hash text not null,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.malls(id) on delete cascade,
  unit_code text not null,
  sba numeric(12,2),
  kwh_load numeric(12,2),
  gas_provision boolean not null default false,
  floor_label text,
  status public.unit_status not null default 'vacant',
  created_at timestamptz not null default now(),
  unique (mall_id, unit_code)
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.malls(id) on delete cascade,
  name text not null,
  category text not null,
  current_unit_id uuid references public.units(id),
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.malls(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  file_name text not null,
  storage_path text not null,
  document_type public.document_type not null,
  status public.document_status not null default 'pending_parse',
  parser_summary text,
  is_in_core_memory boolean not null default false,
  uploaded_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.document_memory_entries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  mall_id uuid not null references public.malls(id) on delete cascade,
  kind public.memory_entry_kind not null,
  title text not null,
  raw_content text,
  structured_payload jsonb,
  edited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.malls(id) on delete cascade,
  unit_id uuid references public.units(id),
  title text not null,
  description text,
  department text not null,
  priority text not null default 'P2',
  status public.task_status not null default 'open',
  created_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  proof_required boolean not null default false,
  sla_due_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null,
  content_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.malls(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  channel public.communication_channel not null,
  purpose public.communication_purpose not null,
  recipient_name text not null,
  recipient_email text,
  recipient_phone text,
  subject text,
  body_preview text not null,
  current_status public.communication_status not null default 'queued',
  escalation_level integer not null default 1,
  requires_action boolean not null default true,
  sla_due_at timestamptz,
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  read_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  actioned_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communication_events (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications(id) on delete cascade,
  status public.communication_status not null,
  notes text,
  provider_payload jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.decision_dna_scores (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.malls(id) on delete cascade,
  unit_id uuid references public.units(id),
  candidate_brand_name text not null,
  category text not null,
  category_synergy numeric(5,2) not null,
  technical_fit numeric(5,2) not null,
  financial_health numeric(5,2) not null,
  cannibalization_risk numeric(5,2) not null,
  total_score numeric(5,2) not null,
  recommendation text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_communications_updated_at on public.communications;
create trigger set_communications_updated_at
before update on public.communications
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_entries_updated_at on public.document_memory_entries;
create trigger set_memory_entries_updated_at
before update on public.document_memory_entries
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_invites enable row level security;
alter table public.documents enable row level security;
alter table public.document_memory_entries enable row level security;
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.communications enable row level security;
alter table public.communication_events enable row level security;

create policy "profiles visible within mall"
on public.profiles
for select
using (
  mall_id in (
    select mall_id from public.profiles where id = auth.uid()
  )
);

create policy "super admins manage invites"
on public.user_invites
for all
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and mall_id = user_invites.mall_id
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and mall_id = user_invites.mall_id
  )
);
