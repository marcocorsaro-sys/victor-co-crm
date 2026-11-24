# Monitor annunci (CRM → pagina /monitor) — Oleggio, Novara San Martino, Novara San Paolo

Rilevazione settimanale degli annunci in vendita a Oleggio su 4 portali, con deduplica per immobile,
stima dell'anzianità (ID progressivi calibrati su istantanee Wayback) e diff: nuovi, ritirati, variazioni di prezzo.

## Procedura (eseguita da un task schedulato Claude con Firecrawl + Supabase MCP)
1. Per ogni portale leggere tutte le pagine elenco con Firecrawl `firecrawl_scrape`, formato `rawHtml`, `maxAge: 0`
   (proxy `auto`; se immobiliare fallisce, `stealth`). Il risultato è grande e viene salvato su file dal tool: va bene così.
   Zona 'Oleggio':
   - immobiliare: https://www.immobiliare.it/vendita-case/oleggio/  e  ?pag=2..N  (25/pagina; N = maxPages nel JSON)
   - idealista:   https://www.idealista.it/vendita-case/oleggio-novara/  e  lista-2.htm..lista-N.htm (30/pagina; fermarsi quando una pagina ha < 30 annunci)
   - casa.it:     https://www.casa.it/vendita/residenziale/oleggio/  e  ?page=2..N (20/pagina; N = paginator.totalPages)
   - subito:      https://www.subito.it/annunci-piemonte/vendita/immobili/novara/oleggio/  e  ?o=2..N (30/pagina; N = totalPages)
   Zona 'Novara - San Martino':
   - immobiliare: https://www.immobiliare.it/vendita-case/novara/san-martino/  (+ ?pag=N)
   - idealista:   https://www.idealista.it/vendita-case/novara/san-martino/  (+ lista-N.htm)
   - casa.it:     https://www.casa.it/vendita/residenziale/novara/san-martino/  (+ ?page=N)
   - subito:      https://www.subito.it/annunci-piemonte/vendita/immobili/novara/novara/?q=san+martino  (+ &o=N)
   Zona 'Novara - San Paolo': come sopra con san-paolo / q=san+paolo.
   Ogni zona va parsata in una cartella separata (listings.jsonl distinto).
2. Copiare i file dei risultati in una cartella di lavoro e parsarli:
   `python3 -I parse.py <portale> <file1> <file2> ...`  (appende a listings.jsonl; eliminare listings.jsonl prima di iniziare)
   Il parser accetta sia il file JSON del tool-result (campo rawHtml) sia HTML puro.
3. `python3 -I emit_ingest.py '<zona>'` → `ingest_<portale>.sql` (zona = 'Oleggio' | 'Novara - San Martino' | 'Novara - San Paolo')
4. Eseguire ogni `ingest_<portale>.sql` con Supabase MCP `execute_sql` (progetto ipkfinjfohuyxkvcsrla). La funzione
   `market_ingest(portal, rows, area)` fa upsert, attacca i nuovi annunci agli immobili esistenti, marca inattivi gli annunci
   non più presenti, registra le variazioni di prezzo e scrive una riga in `market_runs`. Restituisce i conteggi.
5. Riportare a Marco (chat) i conteggi per portale e i 5 immobili più interessanti (ribassi, nuovi inserimenti da privati).

Tabelle: market_listings (1 riga per annuncio/portale), market_properties (1 riga per immobile, con stato/owner/note degli agenti),
market_runs (storico rilevazioni), market_id_anchors (calibrazione ID→data).
