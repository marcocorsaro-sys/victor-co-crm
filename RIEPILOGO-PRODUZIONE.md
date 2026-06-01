# Riepilogo situazione produzione — "versione vecchia + senza dati"

> Documento di handoff per riprendere il lavoro da un'altra macchina.
> Analisi iniziale: 2026-06-01. Branch corrente: `claude/tender-knuth-iPBPP`.
> Vedi anche PR #1 (branch `claude/production-version-mismatch-9W61V`).

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
- [x] **C. Env var Production note** — valori esatti recuperati (vedi sotto). Resta da impostarli su Vercel + Redeploy.
- [ ] **D. Gmail** — riautorizzare il connettore Gmail per cercare le email di deploy Vercel/Supabase
      (`from:vercel.com`, `crm-ten-sooty`, periodo maggio) e individuare automaticamente il build buono + il suo sorgente.

## ✅ Punto C — Env var Production (valori reali recuperati da Supabase)

In Vercel → progetto `crm` → **Settings → Environment Variables → Production**, impostare e poi **Redeploy**:

```
VITE_SUPABASE_URL = https://ipkfinjfohuyxkvcsrla.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwa2Zpbmpmb2h1eXhrdmNzcmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMzODksImV4cCI6MjA4OTE3OTM4OX0.s0tQ0WcpvgFD2SwQdW9PVSnnToX0BNa33Tt4JtZFFBo
```

Note:
- È la **anon key pubblica** (role `anon`), pensata per essere inclusa nel frontend → ok averla qui.
  In alternativa esiste la publishable key moderna `sb_publishable_2SG-qY0Dr7wRO_M0l62ZMw_-QujGjGK`.
- Se il build usa prefisso `NEXT_PUBLIC_` invece di `VITE_`, adattare i nomi delle variabili.

## ⚠️ Sicurezza — segreti in chiaro nelle edge function (da ruotare)

- `google-oauth-callback`: **Google Client Secret** (`GOCSPX-…`) hardcoded.
- `scrape-immobiliare-weekly`: **API key Firecrawl** (`fc-…`) hardcoded.

Ruotare entrambi e spostarli nei *secrets* di Supabase (`Deno.env.get(...)`).

## Stato blocchi (aggiornato 2026-06-01, seconda sessione)

| Blocco | Sessione precedente | Sessione attuale |
|---|---|---|
| **Supabase MCP** | — | ✅ accesso pieno — anon key + URL recuperati (punto C risolto) |
| **Vercel MCP** | 403 Forbidden | ❌ ancora **403**: l'account Vercel collegato non vede il progetto `crm` (zero team). Rollback (A) e recupero sorgente (B) richiedono l'account Vercel corretto. |
| **Gmail MCP** | token scaduto | ❌ ancora **token scaduto** → richiede ri-autorizzazione del connettore (punto D) |
| **Sanity MCP** | account senza progetto magazine | invariato |
| **Scope GitHub** | solo `victor-co-crm` | invariato |

### Azioni che richiedono l'utente (non sbloccabili da questa sessione)
1. **Vercel**: ricollegare l'account che possiede `crm-ten-sooty-60`, oppure eseguire manualmente rollback (A) + leggere branch/commit del deploy buono (B).
2. **Gmail**: riautorizzare il connettore per la ricerca email di deploy (D).
