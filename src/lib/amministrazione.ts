// Tipi, etichette e helper del modulo Amministrazione.
// Le tabelle adm_* sono create da supabase/2026-11-12_amministrazione.sql

export type FulfilmentKind =
  | 'preliminare_compravendita' | 'locazione' | 'proroga_locazione'
  | 'cessione_locazione' | 'risoluzione' | 'altro'
export type FulfilmentStatus = 'da_preparare' | 'pronta' | 'inviata' | 'registrata'

export type Fulfilment = {
  id: string
  operation_id: string | null
  kind: FulfilmentKind
  title: string
  parties: string | null
  act_date: string | null
  due_date: string | null
  status: FulfilmentStatus
  tax_amount: number | null
  registration_ref: string | null
  receipt_path: string | null
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type PaymentCategory = 'fornitore' | 'agente' | 'locazione' | 'ufficio' | 'tasse' | 'altro'
export type PaymentStatus = 'da_approvare' | 'approvato' | 'disposto' | 'pagato' | 'annullato'
export type PaymentRecurrence = 'nessuna' | 'mensile' | 'trimestrale' | 'annuale'

export type AdmPayment = {
  id: string
  category: PaymentCategory
  payee: string
  description: string | null
  amount: number
  iban: string | null
  reference: string | null
  due_date: string | null
  operation_id: string | null
  status: PaymentStatus
  recurrence: PaymentRecurrence
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  attachment_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type DocStage = 'incarico' | 'proposta' | 'preliminare' | 'rogito'
export type DocItemStatus = 'mancante' | 'caricato' | 'verificato' | 'non_applicabile'

export type DocItem = {
  id: string
  operation_id: string
  stage: DocStage
  doc_key: string
  label: string
  required: boolean
  status: DocItemStatus
  paper_filed: boolean
  digital_path: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type AccountantRequest = {
  id: string
  description: string
  period: string | null
  requested_by: string | null
  requested_at: string
  due_date: string | null
  status: 'aperta' | 'in_lavorazione' | 'inviata' | 'chiusa'
  attachment_path: string | null
  notes: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type MonthCloseItem = {
  id: string
  month: string
  item_key: string
  label: string
  done: boolean
  done_at: string | null
  attachment_path: string | null
  notes: string | null
}

export type LeadStatus = 'nuova' | 'inoltrata' | 'presa_in_carico' | 'contattata' | 'chiusa'

export type AdmLead = {
  id: string
  portal: string
  received_at: string
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  property_ref: string | null
  property_title: string | null
  assigned_agent_id: string | null
  status: LeadStatus
  forwarded_at: string | null
  first_contact_at: string | null
  notes: string | null
  source_table: string | null
  source_id: string | null
  created_at: string
  updated_at: string
}

export type InvoiceStatus = 'bozza' | 'inviata' | 'pagata' | 'annullata'

export type AdmInvoice = {
  id: string
  doc_type: 'proforma' | 'fattura'
  number: string | null
  operation_id: string | null
  party: 'venditore' | 'acquirente'
  client_id: string | null
  client_name: string
  client_email: string | null
  client_tax_id: string | null
  description: string | null
  amount_net: number
  vat_pct: number
  amount_total: number
  issue_date: string
  due_date: string | null
  status: InvoiceStatus
  sent_at: string | null
  paid_at: string | null
  paid_amount: number | null
  proforma_id: string | null
  sdi_status: 'da_emettere' | 'emessa' | 'consegnata' | 'scartata' | null
  sdi_ref: string | null
  forwarded_to_agent_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type InvoiceEvent = {
  id: string
  invoice_id: string
  kind: 'sollecito_mail' | 'sollecito_telefonico' | 'promessa_pagamento' | 'nota'
  note: string | null
  happened_at: string
}

export const FULFILMENT_KIND_LABELS: Record<FulfilmentKind, string> = {
  preliminare_compravendita: 'Preliminare di compravendita',
  locazione: 'Contratto di locazione',
  proroga_locazione: 'Proroga locazione',
  cessione_locazione: 'Cessione locazione',
  risoluzione: 'Risoluzione',
  altro: 'Altro',
}

/** Termine di registrazione indicativo dalla data dell'atto: preliminari 20 gg, locazioni 30 gg. Da verificare caso per caso. */
export const FULFILMENT_DEFAULT_DAYS: Record<FulfilmentKind, number> = {
  preliminare_compravendita: 20,
  locazione: 30,
  proroga_locazione: 30,
  cessione_locazione: 30,
  risoluzione: 30,
  altro: 30,
}

export const FULFILMENT_STATUS_LABELS: Record<FulfilmentStatus, string> = {
  da_preparare: 'Da preparare',
  pronta: 'Pronta per invio',
  inviata: 'Inviata al portale',
  registrata: 'Registrata',
}

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  fornitore: 'Fornitore',
  agente: 'Agente',
  locazione: 'Locazione',
  ufficio: 'Spese ufficio',
  tasse: 'Tasse e imposte',
  altro: 'Altro',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  da_approvare: 'Da approvare',
  approvato: 'Approvato',
  disposto: 'Disposto in banca',
  pagato: 'Pagato',
  annullato: 'Annullato',
}

export const STAGE_LABELS: Record<DocStage, string> = {
  incarico: 'Incarico',
  proposta: 'Proposta',
  preliminare: 'Preliminare',
  rogito: 'Rogito',
}

export const STAGES: DocStage[] = ['incarico', 'proposta', 'preliminare', 'rogito']

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nuova: 'Nuova',
  inoltrata: 'Inoltrata',
  presa_in_carico: 'Presa in carico',
  contattata: 'Contattata',
  chiusa: 'Chiusa',
}

export const PORTALS = ['immobiliare.it', 'casa.it', 'idealista', 'sito victorcorealestate', 'telefono', 'altro']

/** Documenti collegati ai template gia' generati dal crm (tabella operation_documents). */
export const TEMPLATE_DOCS: { key: string; templateId: string; label: string; stage: DocStage; critical?: boolean }[] = [
  { key: 'tpl_antiriciclaggio', templateId: 'antiriciclaggio', label: 'Modulo antiriciclaggio firmato', stage: 'incarico', critical: true },
  { key: 'tpl_privacy', templateId: 'privacy', label: 'Informativa privacy firmata', stage: 'incarico' },
  { key: 'tpl_incarico_vendita', templateId: 'incarico_vendita', label: 'Incarico di vendita firmato', stage: 'incarico' },
  { key: 'tpl_proposta_acquisto', templateId: 'proposta_acquisto', label: 'Proposta di acquisto firmata', stage: 'proposta' },
  { key: 'tpl_dich_provvigionale', templateId: 'dich_provvigionale_acquirente', label: 'Dichiarazione provvigionale acquirente', stage: 'proposta' },
]

/** Documenti aggiuntivi da caricare a mano: checklist standard per pratica. */
export const EXTRA_DOCS: { key: string; label: string; stage: DocStage; required?: boolean; sellOnly?: boolean }[] = [
  { key: 'doc_identita', label: 'Documenti di identita e codice fiscale delle parti', stage: 'incarico' },
  { key: 'visura_catastale', label: 'Visura e planimetria catastale', stage: 'incarico' },
  { key: 'titolo_provenienza', label: 'Titolo di provenienza (atto)', stage: 'incarico', sellOnly: true },
  { key: 'ape', label: 'Attestato di prestazione energetica (APE)', stage: 'incarico' },
  { key: 'ricevuta_caparra', label: 'Copia assegno / bonifico caparra', stage: 'proposta' },
  { key: 'preliminare_firmato', label: 'Preliminare firmato', stage: 'preliminare', sellOnly: true },
  { key: 'preliminare_registrato', label: 'Ricevuta di registrazione del preliminare', stage: 'preliminare', sellOnly: true },
  { key: 'contratto_locazione', label: 'Contratto di locazione firmato', stage: 'preliminare' },
  { key: 'ricevuta_registrazione_loc', label: 'Ricevuta di registrazione locazione', stage: 'preliminare' },
  { key: 'rogito_copia', label: 'Copia atto di compravendita', stage: 'rogito', sellOnly: true },
  { key: 'fattura_provvigione', label: 'Fattura provvigione emessa', stage: 'rogito' },
]

export const MONTH_CLOSE_TEMPLATE: { key: string; label: string }[] = [
  { key: 'estratto_conto_banca', label: 'Estratto conto bancario del mese' },
  { key: 'estratto_carta', label: 'Estratto conto carta' },
  { key: 'fatture_emesse', label: 'Fatture emesse verificate' },
  { key: 'fatture_ricevute', label: 'Fatture ricevute e ricevute di spesa raccolte' },
  { key: 'pagamenti_riconciliati', label: 'Pagamenti e incassi riconciliati' },
  { key: 'f24', label: 'F24 e scadenze fiscali del mese controllati' },
  { key: 'invio_studio', label: 'Pacchetto inviato allo studio del commercialista' },
]

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Giorni da oggi (negativo = scaduto). */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const a = new Date(todayIso() + 'T12:00:00').getTime()
  const b = new Date(iso.slice(0, 10) + 'T12:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export function dueLabel(iso: string | null | undefined): { text: string; tone: 'red' | 'amber' | 'g' } {
  const d = daysUntil(iso)
  if (d === null) return { text: '-', tone: 'g' }
  if (d < 0) return { text: `scaduta da ${-d} gg`, tone: 'red' }
  if (d === 0) return { text: 'scade oggi', tone: 'red' }
  if (d <= 5) return { text: `tra ${d} gg`, tone: 'amber' }
  return { text: `tra ${d} gg`, tone: 'g' }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('it-IT')
}

export function monthStart(iso: string): string {
  return iso.slice(0, 7) + '-01'
}

export function fileSafeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

export function eur(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}
