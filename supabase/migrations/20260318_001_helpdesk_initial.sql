-- HelpDesk initial schema for Supabase
-- Execute this script in Supabase SQL Editor

create table if not exists public.hd_users (
  id bigint primary key,
  name text not null,
  email text not null unique,
  password text not null,
  role text not null check (role in ('admin', 'attendant', 'client', 'manager')),
  phone text,
  department text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.hd_categories (
  id bigint primary key,
  name text not null unique 
);

create table if not exists public.hd_tickets (
  id bigint primary key,
  title text not null,
  description text not null,
  status text not null check (status in ('open', 'in_progress', 'resolved')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  category_id bigint references public.hd_categories(id) on delete set null,
  requester_id bigint references public.hd_users(id) on delete set null,
  assigned_to bigint references public.hd_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hd_comments (
  id bigint primary key,
  ticket_id bigint not null references public.hd_tickets(id) on delete cascade,
  author_id bigint references public.hd_users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.hd_settings (
  id bigint primary key,
  company_name text not null,
  support_email text not null,
  allow_ticket_reopen boolean not null default true,
  auto_assign_enabled boolean not null default false,
  notify_on_new_ticket boolean not null default true,
  notify_on_ticket_update boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.hd_knowledge_articles (
  id bigint primary key,
  title text not null,
  category text,
  content text not null,
  updated_at timestamptz not null default now(),
  author_id bigint references public.hd_users(id) on delete set null
);

create table if not exists public.hd_user_activities (
  id bigint primary key,
  user_id bigint references public.hd_users(id) on delete cascade,
  actor_id bigint references public.hd_users(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hd_users_email on public.hd_users(email);
create index if not exists idx_hd_users_role on public.hd_users(role);
create index if not exists idx_hd_users_is_active on public.hd_users(is_active);

create index if not exists idx_hd_tickets_status on public.hd_tickets(status);
create index if not exists idx_hd_tickets_priority on public.hd_tickets(priority);
create index if not exists idx_hd_tickets_requester_id on public.hd_tickets(requester_id);
create index if not exists idx_hd_tickets_assigned_to on public.hd_tickets(assigned_to);

create index if not exists idx_hd_comments_ticket_id on public.hd_comments(ticket_id);
create index if not exists idx_hd_knowledge_articles_updated_at on public.hd_knowledge_articles(updated_at desc);
create index if not exists idx_hd_user_activities_user_id on public.hd_user_activities(user_id);
create index if not exists idx_hd_user_activities_created_at on public.hd_user_activities(created_at desc);

insert into public.hd_settings (
  id,
  company_name,
  support_email,
  allow_ticket_reopen,
  auto_assign_enabled,
  notify_on_new_ticket,
  notify_on_ticket_update,
  updated_at
)
values (1, 'HelpDesk Corp', 'suporte@helpdesk.local', true, false, true, true, now())
on conflict (id) do nothing;
