# Riepilogo "produzione" — CASO CHIUSO: falso allarme

> Aggiornato: 2026-06-01. Branch: `claude/tender-knuth-iPBPP`.
> ⚠️ Questo documento **corregge** la diagnosi iniziale (vedi PR #1), che era **sbagliata**.

## TL;DR — non c'era nessun problema

**Il sito di produzione `crm-ten-sooty-60.vercel.app` è online, completo e funzionante**, con
tutti i dati collegati. La versione "completa" (Dashboard, Operazioni, Agenti, Clienti, Valutazioni,
**Intelligence, Settimane, Mercato, AI**, Calendario, Impostazioni) **è quella effettivamente
deployata e live**.

Il sintomo "dati vuoti" era dovuto **al login con l'account sbagliato**:
- Su **mobile** si entrava con `marco.corsaro@gmail.com`, che è un account con **ruolo agente
  senza operazioni** → la dashboard mostra (correttamente) i soli dati di quell'agente, cioè **zero**.
- Su **desktop** si entrava come **admin** → si vedono i KPI globali e tutti i dati.

Conferma visiva: nella lista "Performance Agenti" l'utente *Marco Corsaro* risulta `0` chiuse,
`0` pipeline, `0,00 €`. Era semplicemente la vista agente, non un guasto.

## Cosa NON era vero (diagnosi errata della sessione precedente)

La PR #1 / vecchio riepilogo affermava: "produzione tornata a un build vecchio del 29 aprile,
scollegato dal DB, frontend completo mai committato → possibile perdita lavoro". **Falso.**
Quell'analisi è stata fatta **senza poter vedere il sito** (Vercel dava 403) ragionando su uno
screenshot **filtrato** della lista Deployments, e ha portato a conclusioni sbagliate.

Realtà accertata guardando il sito live:
- ✅ Deployment corretto e completo, online.
- ✅ Dati salvi e collegati (DB Supabase `ipkfinjfohuyxkvcsrla`, vivo).
- ✅ Nessun problema di cache, versione o variabili d'ambiente.
- ❌ L'unico "problema" era **account/ruolo sbagliato al login** sul mobile.

## Punti veri ancora aperti (non urgenti)

Due osservazioni emerse durante l'indagine restano valide e vale la pena affrontarle con calma:

1. **Sorgente non su GitHub.** Il repo `victor-co-crm` / `main` è fermo al commit `b9478b4`
   (29 aprile, solo CRM base). Il codice della versione completa attualmente in produzione
   **non risulta in questo repo**. Conviene recuperarlo dal deployment Vercel (campo *Source*)
   e committarlo, così è al sicuro e versionato.

2. **Segreti hardcoded nelle edge function** (da ruotare e spostare nei secrets Supabase):
   - `google-oauth-callback`: Google Client Secret (`GOCSPX-…`).
   - `scrape-immobiliare-weekly`: API key Firecrawl (`fc-…`).

## Dati di riferimento (utili se servono)

- Supabase project: `ipkfinjfohuyxkvcsrla` ("Victor&Co CRM"), `ACTIVE_HEALTHY`.
- `VITE_SUPABASE_URL = https://ipkfinjfohuyxkvcsrla.supabase.co`
- Anon key (pubblica, ok nel frontend): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwa2Zpbmpmb2h1eXhrdmNzcmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMzODksImV4cCI6MjA4OTE3OTM4OX0.s0tQ0WcpvgFD2SwQdW9PVSnnToX0BNa33Tt4JtZFFBo`
- 10 edge function attive (CRM + magazine + monitoraggio: `scrape-immobiliare-weekly`,
  `scrape-omi-quarterly`, `sync-to-sanity`, `victorco-ai`, ecc.).

> Nota: la PR #1 ("data loss / build vecchio") contiene la diagnosi errata e andrebbe chiusa.
