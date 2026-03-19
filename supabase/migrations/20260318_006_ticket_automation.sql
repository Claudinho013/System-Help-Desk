-- HelpDesk ticket automation expansion
-- Adds auto-assignment, SLA, escalation, notifications and internal reminders structures

alter table public.hd_tickets
  add column if not exists first_response_at timestamptz,
  add column if not exists sla_first_response_due_at timestamptz,
  add column if not exists sla_resolution_due_at timestamptz,
  add column if not exists sla_breached_at timestamptz,
  add column if not exists sla_state text not null default 'on_track',
  add column if not exists escalation_level integer not null default 0,
  add column if not exists escalated_at timestamptz,
  add column if not exists last_internal_reminder_at timestamptz,
  add column if not exists last_delay_alert_at timestamptz;

alter table public.hd_tickets
  drop constraint if exists hd_tickets_sla_state_check;

alter table public.hd_tickets
  add constraint hd_tickets_sla_state_check check (sla_state in ('on_track', 'warning', 'breached'));

create index if not exists idx_hd_tickets_sla_state on public.hd_tickets(sla_state);
create index if not exists idx_hd_tickets_sla_resolution_due_at on public.hd_tickets(sla_resolution_due_at);
create index if not exists idx_hd_tickets_escalation_level on public.hd_tickets(escalation_level);

alter table public.hd_settings
  add column if not exists auto_assign_by_department boolean not null default true,
  add column if not exists auto_assign_by_workload boolean not null default true,
  add column if not exists auto_reply_on_ticket_open boolean not null default true,
  add column if not exists auto_status_transitions_enabled boolean not null default true,
  add column if not exists sla_enabled boolean not null default true,
  add column if not exists auto_escalation_enabled boolean not null default true,
  add column if not exists delay_alerts_enabled boolean not null default true,
  add column if not exists attendant_reminders_enabled boolean not null default true,
  add column if not exists sla_rules_json jsonb not null default '{}'::jsonb,
  add column if not exists escalation_rules_json jsonb not null default '{}'::jsonb,
  add column if not exists reminder_rules_json jsonb not null default '{}'::jsonb;

create table if not exists public.hd_notifications (
  id bigint primary key,
  user_id bigint not null references public.hd_users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  ticket_id bigint references public.hd_tickets(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_hd_notifications_user_id on public.hd_notifications(user_id);
create index if not exists idx_hd_notifications_read_at on public.hd_notifications(read_at);
create index if not exists idx_hd_notifications_created_at on public.hd_notifications(created_at desc);

create table if not exists public.hd_internal_reminders (
  id bigint primary key,
  attendant_id bigint not null references public.hd_users(id) on delete cascade,
  ticket_id bigint not null references public.hd_tickets(id) on delete cascade,
  message text not null,
  created_by bigint references public.hd_users(id) on delete set null,
  status text not null default 'pending',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.hd_internal_reminders
  drop constraint if exists hd_internal_reminders_status_check;

alter table public.hd_internal_reminders
  add constraint hd_internal_reminders_status_check check (status in ('pending', 'done'));

create index if not exists idx_hd_internal_reminders_attendant_id on public.hd_internal_reminders(attendant_id);
create index if not exists idx_hd_internal_reminders_status on public.hd_internal_reminders(status);
create index if not exists idx_hd_internal_reminders_created_at on public.hd_internal_reminders(created_at desc);
