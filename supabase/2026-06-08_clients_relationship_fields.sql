-- Victor&Co CRM - Migrazione: campi relazione & dialogo periodico
-- Applicata il 2026-06-08. Eseguibile nel SQL Editor di Supabase (idempotente).
--
-- Aggiunge alla tabella `clients` i campi per gestire il dialogo periodico
-- (almeno 1 volta l'anno) con tutta la rubrica contatti, non solo ex clienti.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS segment TEXT
    CHECK (segment IN ('ex_cliente','cerchia','lead','farm','network','altro')),
  ADD COLUMN IF NOT EXISTS tier TEXT
    CHECK (tier IN ('A','B','C')),
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT
    CHECK (preferred_channel IN ('chiamata','email','whatsapp','incontro')),
  ADD COLUMN IF NOT EXISTS rogito_date DATE,
  ADD COLUMN IF NOT EXISTS contact_cadence_months INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snooze_until DATE,
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.segment IS 'Segmento di relazione: ex_cliente, cerchia, lead, farm, network, altro';
COMMENT ON COLUMN public.clients.tier IS 'Priorita relazione: A (top), B, C';
COMMENT ON COLUMN public.clients.preferred_channel IS 'Canale preferito per il contatto';
COMMENT ON COLUMN public.clients.rogito_date IS 'Data rogito (ancora per il touch anniversario)';
COMMENT ON COLUMN public.clients.contact_cadence_months IS 'Cadenza desiderata di contatto in mesi (default 12)';
COMMENT ON COLUMN public.clients.last_contact_at IS 'Data/ora ultimo contatto registrato';
COMMENT ON COLUMN public.clients.snooze_until IS 'Posticipa la coda di contatto fino a questa data';
COMMENT ON COLUMN public.clients.do_not_contact IS 'Escludi dal dialogo periodico';
