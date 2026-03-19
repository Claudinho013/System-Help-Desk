-- HelpDesk communication expansion
-- Adds email integration, push notifications, WebSocket support and comment types

-- Expand comments table with visibility and type
alter table public.hd_comments
  add column if not exists type text not null default 'standard',
  add column if not exists visibility text not null default 'public',
  add column if not exists emailed_at timestamptz;

alter table public.hd_comments
  drop constraint if exists hd_comments_type_check;

alter table public.hd_comments
  add constraint hd_comments_type_check check (type in ('standard', 'internal', 'system'));

alter table public.hd_comments
  drop constraint if exists hd_comments_visibility_check;

alter table public.hd_comments
  add constraint hd_comments_visibility_check check (visibility in ('public', 'internal'));

create index if not exists idx_hd_comments_type on public.hd_comments(type);
create index if not exists idx_hd_comments_visibility on public.hd_comments(visibility);

-- Expand settings with communication toggles
alter table public.hd_settings
  add column if not exists email_notifications_enabled boolean not null default false,
  add column if not exists email_reply_enabled boolean not null default false,
  add column if not exists push_notifications_enabled boolean not null default false;

-- Email messages table
create table if not exists public.hd_email_messages (
  id bigint primary key,
  to_address text not null,
  subject text not null,
  html_body text,
  text_body text,
  ticket_id bigint references public.hd_tickets(id) on delete set null,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.hd_email_messages
  drop constraint if exists hd_email_messages_status_check;

alter table public.hd_email_messages
  add constraint hd_email_messages_status_check check (status in ('pending', 'sent', 'failed'));

create index if not exists idx_hd_email_messages_to_address on public.hd_email_messages(to_address);
create index if not exists idx_hd_email_messages_status on public.hd_email_messages(status);
create index if not exists idx_hd_email_messages_ticket_id on public.hd_email_messages(ticket_id);
create index if not exists idx_hd_email_messages_created_at on public.hd_email_messages(created_at desc);

-- Push subscriptions table
create table if not exists public.hd_push_subscriptions (
  id bigint primary key,
  user_id bigint not null references public.hd_users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  subscribed_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_hd_push_subscriptions_user_id on public.hd_push_subscriptions(user_id);
create index if not exists idx_hd_push_subscriptions_endpoint on public.hd_push_subscriptions(endpoint);

-- Activity log for ticket updates (for real-time sync)
create table if not exists public.hd_ticket_activity_log (
  id bigint primary key,
  ticket_id bigint not null references public.hd_tickets(id) on delete cascade,
  event_type text not null,
  triggered_by bigint references public.hd_users(id) on delete set null,
  changes_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hd_ticket_activity_log_ticket_id on public.hd_ticket_activity_log(ticket_id);
create index if not exists idx_hd_ticket_activity_log_created_at on public.hd_ticket_activity_log(created_at desc);
