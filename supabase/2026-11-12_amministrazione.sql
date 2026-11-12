-- Modulo Amministrazione: adempimenti, pagamenti, controllo documentale,
-- contabilita, richieste portali, proforma/fatture.
-- Tutte le tabelle: RLS attiva, accesso solo admin (get_user_role).
-- Solo oggetti nuovi, nessuna modifica alle tabelle esistenti.

create table if not exists public.adm_fulfilments (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid references public.operations(id) on delete set null,
  kind text not null default 'preliminare_compravendita'
    check (kind in ('preliminare_compravendita','locazione','proroga_locazione','cessione_locazione','risoluzione','altro')),
  title text not null,
  parties text,
  act_date date,
  due_date date,
  status text not null default 'da_preparare'
    check (status in ('da_preparare','pronta','inviata','registrata')),
  tax_amount numeric(12,2),
  registration_ref text,
  receipt_path text,
  notes text,
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adm_payments (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'fornitore'
    check (category in ('fornitore','agente','locazione','ufficio','tasse','altro')),
  payee text not null,
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  iban text,
  reference text,
  due_date date,
  operation_id uuid references public.operations(id) on delete set null,
  status text not null default 'da_approvare'
    check (status in ('da_approvare','approvato','disposto','pagato','annullato')),
  recurrence text not null default 'nessuna'
    check (recurrence in ('nessuna','mensile','trimestrale','annuale')),
  requested_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  attachment_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adm_doc_items (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  stage text not null check (stage in ('incarico','proposta','preliminare','rogito')),
  doc_key text not null,
  label text not null,
  required boolean not null default true,
  status text not null default 'mancante'
    check (status in ('mancante','caricato','verificato','non_applicabile')),
  paper_filed boolean not null default false,
  digital_path text,
  verified_by uuid,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operation_id, doc_key)
);

create table if not exists public.adm_accountant_requests (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  period text,
  requested_by text,
  requested_at date not null default current_date,
  due_date date,
  status text not null default 'aperta'
    check (status in ('aperta','in_lavorazione','inviata','chiusa')),
  attachment_path text,
  notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adm_month_close_items (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  item_key text not null,
  label text not null,
  done boolean not null default false,
  done_at timestamptz,
  attachment_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, item_key)
);

create table if not exists public.adm_leads (
  id uuid primary key default gen_random_uuid(),
  portal text not null default 'altro',
  received_at timestamptz not null default now(),
  name text,
  email text,
  phone text,
  message text,
  property_ref text,
  property_title text,
  assigned_agent_id uuid references public.profiles(id) on delete set null,
  status text not null default 'nuova'
    check (status in ('nuova','inoltrata','presa_in_carico','contattata','chiusa')),
  forwarded_at timestamptz,
  first_contact_at timestamptz,
  notes text,
  source_table text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists adm_leads_source_uniq
  on public.adm_leads (source_table, source_id) where source_table is not null;

create table if not exists public.adm_invoices (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null default 'proforma' check (doc_type in ('proforma','fattura')),
  number text,
  operation_id uuid references public.operations(id) on delete set null,
  party text not null default 'acquirente' check (party in ('venditore','acquirente')),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  client_email text,
  client_tax_id text,
  description text,
  amount_net numeric(12,2) not null check (amount_net >= 0),
  vat_pct numeric(5,2) not null default 22,
  amount_total numeric(12,2) generated always as (round(amount_net * (1 + vat_pct / 100), 2)) stored,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'bozza' check (status in ('bozza','inviata','pagata','annullata')),
  sent_at timestamptz,
  paid_at timestamptz,
  paid_amount numeric(12,2),
  proforma_id uuid references public.adm_invoices(id) on delete set null,
  sdi_status text check (sdi_status in ('da_emettere','emessa','consegnata','scartata')),
  sdi_ref text,
  forwarded_to_agent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adm_invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.adm_invoices(id) on delete cascade,
  kind text not null default 'nota'
    check (kind in ('sollecito_mail','sollecito_telefonico','promessa_pagamento','nota')),
  note text,
  happened_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- numerazione progressiva per tipo e anno (PF-2026-001, FT-2026-001)
create or replace function public.adm_set_invoice_number()
returns trigger language plpgsql set search_path = public as $$
declare yr text; n int;
begin
  if new.number is null or new.number = '' then
    yr := to_char(coalesce(new.issue_date, current_date), 'YYYY');
    perform pg_advisory_xact_lock(hashtext('adm_invoice_number_' || new.doc_type || yr));
    select count(*) + 1 into n from public.adm_invoices
      where doc_type = new.doc_type and to_char(issue_date, 'YYYY') = yr;
    new.number := (case when new.doc_type = 'proforma' then 'PF' else 'FT' end)
      || '-' || yr || '-' || lpad(n::text, 3, '0');
  end if;
  return new;
end $$;
drop trigger if exists adm_invoices_number on public.adm_invoices;
create trigger adm_invoices_number before insert on public.adm_invoices
  for each row execute function public.adm_set_invoice_number();

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['adm_fulfilments','adm_payments','adm_doc_items','adm_accountant_requests',
                           'adm_month_close_items','adm_leads','adm_invoices']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.update_updated_at_column()', t || '_updated_at', t);
  end loop;
end $$;

-- indici
create index if not exists adm_fulfilments_op_idx on public.adm_fulfilments(operation_id);
create index if not exists adm_fulfilments_due_idx on public.adm_fulfilments(status, due_date);
create index if not exists adm_payments_op_idx on public.adm_payments(operation_id);
create index if not exists adm_payments_status_idx on public.adm_payments(status, due_date);
create index if not exists adm_leads_agent_idx on public.adm_leads(assigned_agent_id);
create index if not exists adm_leads_status_idx on public.adm_leads(status, received_at desc);
create index if not exists adm_invoices_op_idx on public.adm_invoices(operation_id);
create index if not exists adm_invoices_client_idx on public.adm_invoices(client_id);
create index if not exists adm_invoices_proforma_idx on public.adm_invoices(proforma_id);
create index if not exists adm_invoices_status_idx on public.adm_invoices(status, due_date);
create index if not exists adm_invoice_events_inv_idx on public.adm_invoice_events(invoice_id);

-- RLS: solo admin
do $$
declare t text;
begin
  foreach t in array array['adm_fulfilments','adm_payments','adm_doc_items','adm_accountant_requests',
                           'adm_month_close_items','adm_leads','adm_invoices','adm_invoice_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using ((select public.get_user_role((select auth.uid()))) = 'admin')
      with check ((select public.get_user_role((select auth.uid()))) = 'admin')$p$, t || '_admin_all', t);
  end loop;
end $$;
