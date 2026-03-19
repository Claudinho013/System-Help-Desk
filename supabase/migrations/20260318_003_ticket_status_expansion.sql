-- HelpDesk ticket status expansion
-- Adds detailed workflow statuses and maps legacy values

alter table public.hd_tickets
  drop constraint if exists hd_tickets_status_check;

update public.hd_tickets
set status = 'in_service'
where status = 'in_progress';

update public.hd_tickets
set status = 'open'
where status is null
   or status not in (
     'open',
     'in_analysis',
     'in_service',
     'waiting_customer',
     'waiting_third_party',
     'resolved',
     'closed',
     'cancelled'
   );

alter table public.hd_tickets
  add constraint hd_tickets_status_check check (
    status in (
      'open',
      'in_analysis',
      'in_service',
      'waiting_customer',
      'waiting_third_party',
      'resolved',
      'closed',
      'cancelled'
    )
  );
