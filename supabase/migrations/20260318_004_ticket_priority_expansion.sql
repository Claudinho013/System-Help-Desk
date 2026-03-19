-- HelpDesk ticket priority expansion
-- Adds critical priority and normalizes legacy/invalid values

alter table public.hd_tickets
  drop constraint if exists hd_tickets_priority_check;

update public.hd_tickets
set priority = 'medium'
where priority is null
   or priority not in ('low', 'medium', 'high', 'critical');

alter table public.hd_tickets
  add constraint hd_tickets_priority_check check (priority in ('low', 'medium', 'high', 'critical'));
