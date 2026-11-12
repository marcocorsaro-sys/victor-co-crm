-- Questionario: nessuna perdita di dati (merge lato server, storico versioni) e flag di notifica
alter table public.adm_questionnaires
  add column if not exists notified_start_at timestamptz,
  add column if not exists notified_done_at timestamptz;

create table if not exists public.adm_questionnaire_versions (
  id bigserial primary key,
  questionnaire_id uuid not null references public.adm_questionnaires(id) on delete cascade,
  answers jsonb not null,
  status text,
  saved_at timestamptz not null default now()
);
alter table public.adm_questionnaire_versions enable row level security;
drop policy if exists adm_questionnaire_versions_admin_all on public.adm_questionnaire_versions;
create policy adm_questionnaire_versions_admin_all on public.adm_questionnaire_versions
  for all to authenticated
  using ((select public.get_user_role((select auth.uid()))) = 'admin')
  with check ((select public.get_user_role((select auth.uid()))) = 'admin');
create index if not exists adm_questionnaire_versions_q_idx on public.adm_questionnaire_versions (questionnaire_id, saved_at desc);

create or replace function public.adm_q_log_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.adm_questionnaire_versions (questionnaire_id, answers, status)
  values (new.id, new.answers, new.status);
  return new;
end $$;
revoke all on function public.adm_q_log_version() from public, anon, authenticated;

drop trigger if exists trg_adm_q_log_version on public.adm_questionnaires;
create trigger trg_adm_q_log_version after update on public.adm_questionnaires
  for each row when (old.answers is distinct from new.answers or old.status is distinct from new.status)
  execute function public.adm_q_log_version();

-- il salvataggio ora FONDE le risposte (non sovrascrive): un client vecchio o lento non cancella mai nulla
create or replace function public.adm_q_save(p_token text, p_answers jsonb, p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r adm_questionnaires;
begin
  update adm_questionnaires
     set answers = coalesce(answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb),
         status = case when p_submit then 'inviato' else status end,
         submitted_at = case when p_submit then now() else submitted_at end
   where token = p_token
   returning * into r;
  if not found then return null; end if;
  return jsonb_build_object('status', r.status, 'updated_at', r.updated_at);
end $$;
revoke all on function public.adm_q_save(text, jsonb, boolean) from public;
grant execute on function public.adm_q_save(text, jsonb, boolean) to anon, authenticated;
