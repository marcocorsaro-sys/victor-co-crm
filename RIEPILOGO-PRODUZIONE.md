# Riepilogo situazione produzione — "versione vecchia + senza dati"

> Documento di handoff per riprendere il lavoro da un'altra macchina.
> Data analisi: 2026-06-01. Branch: `claude/production-version-mismatch-9W61V`.

## TL;DR

**Nessuna perdita di dati.** Quello che si vede in produzione (`crm-ten-sooty-60.vercel.app`)
è un **build vecchio del CRM** (stato repo al 29 aprile 2026), **scollegato dal database**.
Da qui i due sintomi insieme: **UX vecchia + zero dati**. Il database reale è intatto e vivo.
Il frontend della versione "completa" (pagina mese + monitoraggio Immobiliare) **non è mai stato
committato su GitHub**: probabilmente vive solo come deployment precedente su Vercel.

## Fatti accertati

### 1. L'URL di produzione è quello giusto
`https://crm-ten-sooty-60.vercel.app` è il CRM ufficiale: è cablato come `CRM_URL` nella
edge function `google-oauth-callback` del database. Non è un duplicato.

### 2. I dati sono salvi (Supabase `ipkfinjfohuyxkvcsrla`)
Progetto Supabase **"Victor&Co CRM"** — `https://ipkfinjfohuyxkvcsrla.supabase.co` — `ACTIVE_HEALTHY`.
Conteggi principali:
- `clients`: 1.755
- `operations`: 101 (ultima modifica **29/05/2026** → DB in uso fino a pochi giorni fa)
- `profiles`: 9 · `valutazioni`: 19 · `agent_activity_logs`: 626
- `magazine_articles`: 97 · `competitor_agencies`: 13 · `market_weekly_listings`: 63
- `omi_quotations`, `market_omi_quarterly`, `mortgage_rates`, `news_items`, ecc.

10 edge function attive, tra cui:
- `scrape-immobiliare-weekly` → cron settimanale monitoraggio annunci agenzie (Firecrawl, Novara)
- `scrape-omi-quarterly`, `backfill-wayback-listings` → market data
- `sync-to-sanity` → pubblicazione magazine su Sanity
- `victorco-ai`, `admin-actions`, `google-oauth`, `google-oauth-callback`, `google-api-proxy`

### 3. Questo repository è "congelato" al 29 aprile 2026
`victor-co-crm` / `main` = commit `b9478b4`. Intera storia: 15 commit, dal 20 al 29 aprile.
Contiene **solo il CRM base** (dashboard, clienti, operazioni, valutazioni, documenti, calendario).
**Mai presenti** in tutta la storia git: pagina mese, magazine, monitoraggio Immobiliare, cron.

### 4. Le feature avanzate sono di maggio 2026 (dopo l'ultimo commit)
Backend (edge function + tabelle) costruito a maggio → **il frontend corrispondente non è in questo repo**.
GitHub code search per `market_weekly_listings`/`scrape-immobiliare`/`competitor_agencies` = 0 risultati
(nota: i repo privati potrebbero non essere indicizzati, quindi non è prova definitiva).

## Cosa è successo (ipotesi più probabile)

La produzione su `crm-ten-sooty-60` è tornata a una **build vecchia del CRM** (29 aprile) e con
**variabili Supabase mancanti/sbagliate**. La versione "buona" con pagina mese + monitoraggio,
che combaciava col backend di maggio, **è stata deployata su Vercel ma il sorgente non è finito
su GitHub** → ora il repo ha solo la versione vecchia.

## Piano di recupero (TODO)

- [ ] **A. Ripristino immediato del sito** — Vercel → progetto `crm` (crm-ten-sooty-60) → Deployments →
      trova l'ultimo deploy "buono" di **maggio** (con pagina mese + dati) → `⋯ → Promote to Production / Instant Rollback`.
- [ ] **B. Ritrova il sorgente** — dal deployment buono leggi **branch/commit/repo** (o "Created via CLI").
      Se è via CLI, il codice non è su git: va recuperato dall'artefatto del deployment.
- [ ] **C. Correggi le env var** (Vercel → Settings → Environment Variables → Production) + Redeploy:
      - `VITE_SUPABASE_URL = https://ipkfinjfohuyxkvcsrla.supabase.co`
      - `VITE_SUPABASE_ANON_KEY = <anon key del progetto Victor&Co CRM>`
- [ ] **D. Gmail** — riautorizzare il connettore Gmail per cercare le email di deploy Vercel/Supabase
      (`from:vercel.com`, `crm-ten-sooty`, periodo maggio) e individuare automaticamente il build buono + il suo sorgente.

## ⚠️ Sicurezza — segreti in chiaro nelle edge function (da ruotare)

- `google-oauth-callback`: **Google Client Secret** (`GOCSPX-…`) hardcoded.
- `scrape-immobiliare-weekly`: **API key Firecrawl** (`fc-…`) hardcoded.

Ruotare entrambi e spostarli nei *secrets* di Supabase (`Deno.env.get(...)`).

## Blocchi incontrati in questa sessione

- **Vercel MCP**: 403 Forbidden sul progetto (account/scope non autorizzato in questa sessione) →
  impossibile leggere env var, deployment o fare rollback in autonomia.
- **Rete sandbox**: richieste in uscita bloccate (403 anche su Google) → impossibile ispezionare il sito.
- **Gmail MCP**: token scaduto → ricerca email da rifare dopo riautorizzazione.
- **Sanity MCP**: l'account collegato non contiene il progetto magazine di Victor&Co.
- **Scope GitHub**: limitato a `marcocorsaro-sys/victor-co-crm` (altri repo non leggibili da qui).
