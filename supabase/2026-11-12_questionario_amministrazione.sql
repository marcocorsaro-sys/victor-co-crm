-- Questionario discovery Amministrazione (link personale per Victor, senza login)
create table if not exists public.adm_questionnaires (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  title text not null default 'Questionario amministrazione',
  recipient text,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'aperto' check (status in ('aperto','inviato')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_adm_questionnaires_updated on public.adm_questionnaires;
create trigger trg_adm_questionnaires_updated before update on public.adm_questionnaires
  for each row execute function public.update_updated_at_column();

alter table public.adm_questionnaires enable row level security;
drop policy if exists adm_questionnaires_admin_all on public.adm_questionnaires;
create policy adm_questionnaires_admin_all on public.adm_questionnaires
  for all to authenticated
  using ((select public.get_user_role((select auth.uid()))) = 'admin')
  with check ((select public.get_user_role((select auth.uid()))) = 'admin');

-- Numeri aggregati dal CRM (nessun dato personale) da far "battezzare" a Victor
create or replace function public.adm_q_crm_facts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'periodo_da', to_char(date_trunc('month', current_date) - interval '6 months', 'YYYY-MM-DD'),
    'vendite_chiuse_6m', (select count(*) from operations where type='vendita' and sale_date >= date_trunc('month', current_date) - interval '6 months' and sale_date < date_trunc('month', current_date)),
    'locazioni_chiuse_6m', (select count(*) from operations where type='locazione' and sale_date >= date_trunc('month', current_date) - interval '6 months' and sale_date < date_trunc('month', current_date)),
    'vendite_in_pipeline', (select count(*) from operations where type='vendita' and status='pipeline'),
    'proposte_accettate', (select count(*) from operations where status='proposta_accettata'),
    'mandati_attivi', (select count(*) from operations where mandate_start_date is not null and mandate_end_date >= current_date),
    'mandati_in_scadenza_60gg', (select count(*) from operations where mandate_end_date between current_date and current_date + interval '60 days'),
    'provvigioni_maturate_12m', (select coalesce(round(sum(gross_commission)),0) from operations where sale_date >= current_date - interval '12 months' and sale_date <= current_date),
    'provvigioni_incassate_12m', (select coalesce(round(sum(commission_collected)),0) from operations where sale_date >= current_date - interval '12 months' and sale_date <= current_date),
    'operazioni_con_incasso_parziale', (select count(*) from operations where sale_date >= current_date - interval '12 months' and sale_date <= current_date and coalesce(gross_commission,0) > coalesce(commission_collected,0) + 1),
    'richieste_portali_90gg', (select count(*) from property_inquiries where created_at >= current_date - interval '90 days'),
    'contatti_sito_90gg', (select count(*) from website_contacts where created_at >= current_date - interval '90 days'),
    'agenti_attivi', (select count(*) from profiles where role='agent' and active),
    'operazioni_per_mese', coalesce((
      select jsonb_agg(jsonb_build_object('mese', m, 'vendite', v, 'locazioni', l) order by m)
      from (
        select to_char(sale_date,'YYYY-MM') m,
               count(*) filter (where type='vendita') v,
               count(*) filter (where type='locazione') l
        from operations
        where sale_date >= date_trunc('month', current_date) - interval '6 months' and sale_date < date_trunc('month', current_date)
        group by 1
      ) s), '[]'::jsonb)
  );
$$;

create or replace function public.adm_q_get(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r adm_questionnaires;
begin
  select * into r from adm_questionnaires where token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'title', r.title, 'recipient', r.recipient, 'answers', r.answers,
    'status', r.status, 'submitted_at', r.submitted_at, 'updated_at', r.updated_at,
    'crm', public.adm_q_crm_facts()
  );
end $$;

create or replace function public.adm_q_save(p_token text, p_answers jsonb, p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r adm_questionnaires;
begin
  update adm_questionnaires
     set answers = coalesce(p_answers, '{}'::jsonb),
         status = case when p_submit then 'inviato' else status end,
         submitted_at = case when p_submit then now() else submitted_at end
   where token = p_token
   returning * into r;
  if not found then return null; end if;
  return jsonb_build_object('status', r.status, 'updated_at', r.updated_at);
end $$;

revoke all on function public.adm_q_crm_facts() from public, anon, authenticated;
grant execute on function public.adm_q_get(text) to anon, authenticated;
grant execute on function public.adm_q_save(text, jsonb, boolean) to anon, authenticated;

insert into public.adm_questionnaires (recipient, title)
select 'Victor Sponton', 'Come semplifichiamo la tua amministrazione'
where not exists (select 1 from public.adm_questionnaires where recipient = 'Victor Sponton');
