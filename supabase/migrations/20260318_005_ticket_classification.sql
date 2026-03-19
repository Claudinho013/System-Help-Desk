-- HelpDesk ticket classification expansion
-- Adds problem type and tags storage for advanced organization and filtering

alter table public.hd_tickets
  add column if not exists problem_type text not null default 'other',
  add column if not exists tags_json jsonb not null default '[]'::jsonb;

alter table public.hd_tickets
  drop constraint if exists hd_tickets_problem_type_check;

update public.hd_tickets
set problem_type = 'other'
where problem_type is null
   or problem_type not in (
     'access_issue',
     'billing_issue',
     'bug',
     'performance_issue',
     'integration_issue',
     'infrastructure_issue',
     'service_request',
     'question',
     'other'
   );

update public.hd_tickets
set tags_json = '[]'::jsonb
where tags_json is null
   or jsonb_typeof(tags_json) <> 'array';

alter table public.hd_tickets
  add constraint hd_tickets_problem_type_check check (
    problem_type in (
      'access_issue',
      'billing_issue',
      'bug',
      'performance_issue',
      'integration_issue',
      'infrastructure_issue',
      'service_request',
      'question',
      'other'
    )
  );

create index if not exists idx_hd_tickets_problem_type on public.hd_tickets(problem_type);
create index if not exists idx_hd_tickets_tags_json on public.hd_tickets using gin (tags_json);
