-- HelpDesk ticket workflow upgrade
-- Adds detailed ticket fields, history table and status expansion

alter table public.hd_tickets
  add column if not exists ticket_number text,
  add column if not exists subcategory text,
  add column if not exists department_responsible text,
  add column if not exists origin text not null default 'site',
  add column if not exists attachments_json jsonb not null default '[]'::jsonb,
  add column if not exists attendant_response text,
  add column if not exists client_return text,
  add column if not exists closed_at timestamptz;

alter table public.hd_tickets
  drop constraint if exists hd_tickets_status_check;

alter table public.hd_tickets
  add constraint hd_tickets_status_check check (status in ('open', 'in_progress', 'resolved', 'closed'));

alter table public.hd_tickets
  drop constraint if exists hd_tickets_origin_check;

alter table public.hd_tickets
  add constraint hd_tickets_origin_check check (origin in ('site', 'email', 'whatsapp', 'app'));

create unique index if not exists idx_hd_tickets_ticket_number
  on public.hd_tickets(ticket_number)
  where ticket_number is not null;

create index if not exists idx_hd_tickets_origin on public.hd_tickets(origin);
create index if not exists idx_hd_tickets_closed_at on public.hd_tickets(closed_at desc);

update public.hd_tickets
set ticket_number = concat('HD-', to_char(coalesce(created_at, now()), 'YYYYMMDD'), '-', lpad(id::text, 5, '0'))
where ticket_number is null;

update public.hd_tickets
set subcategory = coalesce(subcategory, 'Geral')
where subcategory is null;

update public.hd_tickets
set department_responsible = coalesce(department_responsible, 'Atendimento')
where department_responsible is null;

create table if not exists public.hd_ticket_history (
  id bigint primary key,
  ticket_id bigint not null references public.hd_tickets(id) on delete cascade,
  actor_id bigint references public.hd_users(id) on delete set null,
  event_type text not null,
  description text,
  changes_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hd_ticket_history_ticket_id on public.hd_ticket_history(ticket_id);
create index if not exists idx_hd_ticket_history_created_at on public.hd_ticket_history(created_at desc);
