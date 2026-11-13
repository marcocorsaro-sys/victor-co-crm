-- Modulo Talent: agenti immobiliari esterni da attrarre in Victor&Co.
-- Fonte lista: "Elenco Agenti Immobiliari" (PDF, 16 nominativi).
-- Arricchimento: Apify (LinkedIn + Instagram), solo dati pubblici professionali.
-- Solo oggetti nuovi. RLS attiva, accesso solo admin (get_user_role).

create table if not exists public.talent_prospects (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  full_name text not null,
  phone text,
  agency text,
  regime text,                       -- es. 'forfettario / in proprio'
  patentino text not null default 'non_noto'
    check (patentino in ('si','no','non_noto')),
  activity text,                     -- es. 'solo affitti'
  pdf_note text,                     -- nota originale dal PDF
  data_flag text,                    -- anomalie dati (es. numero duplicato)

  linkedin_url text,
  linkedin_match text not null default 'non_trovato'
    check (linkedin_match in ('confermato','possibile','non_trovato','scartato')),
  linkedin_data jsonb not null default '{}'::jsonb,

  instagram_handle text,
  instagram_match text not null default 'non_trovato'
    check (instagram_match in ('confermato','possibile','non_trovato','scartato')),
  instagram_data jsonb not null default '{}'::jsonb,

  score_breakdown jsonb not null default '{}'::jsonb,  -- {digitale|esperienza|contendibilita|fit: {v,max,note}}
  approach_angle text,

  stage text not null default 'da_contattare'
    check (stage in ('da_contattare','contattato','incontro','trattativa','scartato','entrato')),
  owner text,                        -- chi lo segue (Marco / Victor)
  notes text,
  contacted_at timestamptz,
  enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists talent_prospects_stage_idx on public.talent_prospects(stage, position);

drop trigger if exists talent_prospects_updated_at on public.talent_prospects;
create trigger talent_prospects_updated_at
  before update on public.talent_prospects
  for each row execute function public.update_updated_at_column();

alter table public.talent_prospects enable row level security;
drop policy if exists talent_prospects_admin_all on public.talent_prospects;
create policy talent_prospects_admin_all on public.talent_prospects for all to authenticated
  using ((select public.get_user_role((select auth.uid()))) = 'admin')
  with check ((select public.get_user_role((select auth.uid()))) = 'admin');

-- Seed: 16 nominativi dal PDF + arricchimento Apify del 13/11/2026
insert into public.talent_prospects
  (position, full_name, phone, agency, regime, patentino, activity, pdf_note, data_flag,
   linkedin_url, linkedin_match, linkedin_data, instagram_handle, instagram_match, instagram_data,
   score_breakdown, approach_angle, enriched_at)
values
(1, 'Emanuele Passarani', '328 2125221', 'Sim Immobiliare', null, 'non_noto', null, 'Sim immobiliare', null,
 'https://www.linkedin.com/in/emanuele-passarani-9557ba7b', 'confermato',
 '{"headline":"Agente Immobiliare. Ogni tetto ha il suo proprietario!","location":"Cameri","followers":402,"connections":401,"current":"Agente immobiliare, SIM Immobiliare SRL, da gen 2015 (circa 12 anni)","experience":["Speaker ufficiale Novara Calcio (2009-2016)","Speaker ufficiale Igor Volley Novara (2012-2016)","Responsabile Service/Clienti, Etica SpA (1998-2014)"],"skills":["Public Speaking","Event Management","Negotiation","Social Media","Sales Management"],"languages":["Inglese (professionale)"],"open_to_work":false}'::jsonb,
 'manupassarani_realestate', 'confermato',
 '{"url":"https://www.instagram.com/manupassarani_realestate","bio":"Real Estate since 2017 at @sim_immobiliare. Owner of Number Ten Immobiliare.","followers":202,"following":200,"posts":41,"category":"Real Estate Agent","private":false}'::jsonb,
 '{"digitale":{"v":15,"max":30,"note":"IG 202 follower / 41 post, LinkedIn 402 follower"},"esperienza":{"v":26,"max":30,"note":"In Sim dal 2015, 28 anni di carriera commerciale"},"contendibilita":{"v":12,"max":25,"note":"Dipendente di rete (Sim); la bio IG cita anche Number Ten Immobiliare, da chiarire"},"fit":{"v":13,"max":15,"note":"Ex speaker ufficiale di Igor Volley Novara e Novara Calcio: stesso mondo delle community di Victor&Co (volley, basket)"}}'::jsonb,
 'Parlargli del legame con lo sport novarese: e stato speaker ufficiale di Novara Calcio e Igor Volley, Victor&Co sponsorizza Borgoticino e ISSA Novara. Chiarire prima il ruolo di Number Ten Immobiliare (bio Instagram). Proposta: visibilita sui contenuti di agenzia e supporto di Valentina.',
 now()),
(2, 'Davide Ventura', '327 8751759', 'Sim Immobiliare', null, 'non_noto', null, 'Sim immobiliare', null,
 null, 'non_trovato', '{}'::jsonb,
 'davideeventura', 'confermato',
 '{"url":"https://www.instagram.com/davideeventura","bio":"Novara. @sim_immobiliare","followers":636,"following":457,"posts":15,"category":"Real Estate Agent","private":false}'::jsonb,
 '{"digitale":{"v":13,"max":30,"note":"IG 636 follower ma solo 15 post: audience superiore ai contenuti"},"esperienza":{"v":null,"max":30,"note":"LinkedIn non trovato"},"contendibilita":{"v":12,"max":25,"note":"Dipendente di rete (Sim)"},"fit":{"v":9,"max":15,"note":"Novara, account professionale gia avviato"}}'::jsonb,
 'Ha piu follower (636) che contenuti (15 post): il gancio e il supporto editoriale di agenzia (Valentina, rubriche agente, magazine) per valorizzare il seguito che ha gia.',
 now()),
(3, 'Mauro Gatti', '339 3664758', null, 'forfettario / in proprio', 'non_noto', null, 'lavora in proprio forfettario', null,
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Nessun profilo riconducibile con certezza"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":22,"max":25,"note":"Lavora in proprio, nessuna rete alle spalle"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Lavora in proprio: proposta di struttura (portali, CRM, lead, back office) senza perdere autonomia.',
 now()),
(4, 'Marco Ferrone', '346 2850059', 'SoluzioniRe', null, 'no', null, 'non ha ancora il patentino', null,
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Solo omonimi"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":8,"max":25,"note":"Senza patentino non puo operare in autonomia"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Non ancora abilitato: percorso di abilitazione e affiancamento da un senior.',
 now()),
(5, 'Andrea Fernandez', '351 3320223', 'Sim Immobiliare', null, 'non_noto', null, 'Sim immobiliare', null,
 null, 'non_trovato', '{}'::jsonb,
 'andreafernandez_realestate', 'confermato',
 '{"url":"https://www.instagram.com/andreafernandez_realestate","bio":"Agente Immobiliare. Case e persone al centro. Novara e dintorni. @sim_immobiliare","followers":331,"following":264,"posts":38,"category":null,"private":false}'::jsonb,
 '{"digitale":{"v":14,"max":30,"note":"IG 331 follower / 38 post, profilo curato con posizionamento chiaro"},"esperienza":{"v":null,"max":30,"note":"LinkedIn non trovato"},"contendibilita":{"v":12,"max":25,"note":"Dipendente di rete (Sim)"},"fit":{"v":10,"max":15,"note":"Posizionamento persone-prima, in linea con il tono di Victor&Co"}}'::jsonb,
 'Il suo posizionamento (case e persone al centro) e vicino al tono di Victor&Co. Gancio: crescita come volto dell agenzia sui contenuti.',
 now()),
(6, 'Eduardo Muolo', '346 5414295', 'Sim Immobiliare', 'forfettario', 'non_noto', null, 'Sim immobiliare forfettario', 'Stesso numero di Luca Invernizzi nel PDF: verificare',
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Nessun profilo trovato"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":14,"max":25,"note":"In Sim ma forfettario: rapporto flessibile"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'In Sim ma con partita IVA forfettaria: rapporto flessibile, valutare proposta di collaborazione. Prima verificare il numero (uguale a quello di Invernizzi).',
 now()),
(7, 'Luca Invernizzi', '346 5414295', null, 'forfettario / in proprio', 'non_noto', null, 'lavora in proprio forfettario', 'Stesso numero di Eduardo Muolo nel PDF: verificare',
 null, 'non_trovato', '{}'::jsonb,
 'luca___invernizzi', 'possibile',
 '{"url":"https://www.instagram.com/luca___invernizzi","bio":"Co-founder e co-owner @pianoimmobiliare","followers":1700,"posts":430,"category":"Entrepreneur","private":false,"warning":"Omonimia possibile: non confermato che sia lo stesso Luca Invernizzi del PDF"}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Profilo candidato non confermato"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":22,"max":25,"note":"Lavora in proprio, nessuna rete alle spalle"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Lavora in proprio: proposta di struttura senza perdere autonomia. Verificare numero e profilo Instagram candidato prima di muoversi.',
 now()),
(8, 'Mattia Boscolo', '340 4984294', 'Savasta Immobiliare', null, 'non_noto', null, 'Savasta immobiliare (patentino non noto)', null,
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Solo omonimi (profilo IG trovato e di Roma/Tempocasa, non riconducibile)"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":12,"max":25,"note":"In agenzia locale; patentino non noto"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Prima verificare il patentino. Poi proposta come agente con supporto su portali e mandati.',
 now()),
(9, 'Davide Caccia', '349 1629835', null, null, 'non_noto', 'solo affitti', 'Solo affitti', null,
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Solo omonimi"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":10,"max":25,"note":"Opera solo su affitti"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Opera solo su affitti: aprire alle vendite con supporto su mandati e valutazioni.',
 now()),
(10, 'Paola Parsi', '346 5756484', 'Novara Immobiliare', 'autonoma', 'non_noto', null, 'Novara immobiliare', null,
 'https://www.linkedin.com/in/paola-parsi-66946736a', 'confermato',
 '{"headline":"Agente Immobiliare | Consulente in immobili residenziali e commerciali","location":"Novara","followers":4,"connections":4,"current":"Agente immobiliare (self-employed), Novara Immobiliare, da set 2024","about":"Valutazione e vendita residenziale, consulenza acquisto, promozione online e offline, grafica pubblicitaria e social media management per agenzie immobiliari","skills":["Transazioni immobiliari","Valutazioni immobiliari","Comunicazioni di social media"],"open_to_work":false}'::jsonb,
 null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":9,"max":30,"note":"LinkedIn quasi vuoto (4 contatti) ma competenze di grafica e social per immobiliare"},"esperienza":{"v":8,"max":30,"note":"Agente da 2 anni e 3 mesi"},"contendibilita":{"v":20,"max":25,"note":"Self-employed in Novara Immobiliare"},"fit":{"v":11,"max":15,"note":"Offre grafica e social management: affine al lavoro di contenuti di Victor&Co"}}'::jsonb,
 'Profilo junior (agente da settembre 2024) con competenze di grafica e social. Gancio: crescita guidata e ruolo nei contenuti con Valentina. Instagram non individuato: chiederlo al primo contatto.',
 now()),
(11, 'Thomas Vella', '334 7289789', null, 'forfettario / in proprio', 'non_noto', null, 'lavora in proprio forfettario', null,
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Nessun profilo riconducibile"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":22,"max":25,"note":"Lavora in proprio, nessuna rete alle spalle"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Lavora in proprio: proposta di struttura (portali, CRM, lead) senza perdere autonomia.',
 now()),
(12, 'Victor Barbosa', '347 3881212', 'Tempocasa', null, 'no', null, 'non ha ancora il patentino', null,
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Solo omonimi"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":8,"max":25,"note":"Senza patentino non puo operare in autonomia"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Non ancora abilitato e in franchising: percorso di abilitazione e affiancamento.',
 now()),
(13, 'Arianna Porzio', '333 3405417', 'Malquati Real Estate', null, 'non_noto', null, 'Malquati Real Estate', null,
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Solo omonimi"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":12,"max":25,"note":"In agenzia strutturata (Malquati)"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'In agenzia strutturata: serve un motivo forte per muoversi (mandati, supporto contenuti, ripartizione).',
 now()),
(14, 'Cristina Dassi', '346 0534021', 'Sim Immobiliare', null, 'non_noto', null, 'Sim Immobiliare', null,
 'https://www.linkedin.com/in/cristina-dassi-839b96182', 'possibile',
 '{"headline":"(solo un cuore)","location":"Novara","warning":"Profilo a Novara senza headline: non confermato che sia l agente del PDF"}'::jsonb,
 null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Profilo LinkedIn candidato non confermato"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":12,"max":25,"note":"Dipendente di rete (Sim)"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Dipendente di rete: serve un motivo forte per muoversi. Verificare il profilo LinkedIn candidato.',
 now()),
(15, 'Riccardo Meta', '347 4378827', 'Sim Immobiliare', null, 'non_noto', null, 'Sim Immobiliare', null,
 'https://www.linkedin.com/in/riccardo-meta-ab9383233', 'possibile',
 '{"headline":"--","location":"Novara","warning":"Profilo a Novara senza headline: non confermato che sia l agente del PDF"}'::jsonb,
 null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Profilo LinkedIn candidato non confermato"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":12,"max":25,"note":"Dipendente di rete (Sim)"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Dipendente di rete: serve un motivo forte per muoversi. Verificare il profilo LinkedIn candidato.',
 now()),
(16, 'Daniele Mazzone', '331 3297400', 'Sim Immobiliare', null, 'no', null, 'non ha ancora il patentino', null,
 null, 'non_trovato', '{}'::jsonb, null, 'non_trovato', '{}'::jsonb,
 '{"digitale":{"v":null,"max":30,"note":"Solo omonimi"},"esperienza":{"v":null,"max":30,"note":"n/d"},"contendibilita":{"v":8,"max":25,"note":"Senza patentino non puo operare in autonomia"},"fit":{"v":null,"max":15,"note":"n/d"}}'::jsonb,
 'Non ancora abilitato: percorso di abilitazione e affiancamento da un senior.',
 now());
