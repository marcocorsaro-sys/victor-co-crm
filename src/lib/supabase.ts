import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  first_name: string
  last_name: string
  full_name: string
  role: 'admin' | 'agent'
  initials: string
  color: string
  active: boolean
  comm_pct_agency: number
  comm_pct_agent: number
  created_at: string
  phone: string | null
  display_email: string | null
  personal_address: string | null
  codice_fiscale: string | null
  iban: string | null
  contract_start_date: string | null
  contract_type: string | null
  profile_notes: string | null
}

export type Client = {
  id: string
  first_name: string
  last_name: string
  name: string
  phone: string | null
  email: string | null
  type: 'acquirente' | 'venditore' | 'entrambi'
  address: string | null
  notes: string | null
  birth_date: string | null
  company: string | null
  source: string | null
  linked_agent_id: string | null
  date_added: string
  updated_at: string
  // Anagrafica estesa per modulistica
  luogo_nascita: string | null
  provincia_nascita: string | null
  nazionalita: string | null
  professione: string | null
  codice_fiscale: string | null
  citta: string | null
  cap: string | null
  provincia: string | null
  // Documento identità
  documento_tipo: string | null
  documento_numero: string | null
  documento_rilasciato_da: string | null
  documento_rilascio_date: string | null
  documento_scadenza: string | null
  // Antiriciclaggio
  pep: boolean
  pep_carica: string | null
  provenienza_fondi: string | null
  scopo_operazione: string | null
  scopo_operazione_altro: string | null
  // Privacy
  privacy_diffusione_consenso: boolean | null
  privacy_marketing_consenso: boolean | null
  // Relazione & dialogo periodico
  segment: 'ex_cliente' | 'cerchia' | 'lead' | 'farm' | 'network' | 'altro' | null
  tier: 'A' | 'B' | 'C' | null
  preferred_channel: 'chiamata' | 'email' | 'whatsapp' | 'incontro' | null
  rogito_date: string | null
  contact_cadence_months: number
  last_contact_at: string | null
  snooze_until: string | null
  do_not_contact: boolean
}

export const CLIENT_SEGMENT_LABELS: Record<NonNullable<Client['segment']>, string> = {
  ex_cliente: 'Ex cliente',
  cerchia: 'Cerchia personale',
  lead: 'Lead / Prospect',
  farm: 'Zona presidiata',
  network: 'Network professionale',
  altro: 'Altro',
}

export const CLIENT_CHANNEL_LABELS: Record<NonNullable<Client['preferred_channel']>, string> = {
  chiamata: 'Chiamata',
  email: 'Email',
  whatsapp: 'WhatsApp',
  incontro: 'Incontro',
}

export type AgencySettings = {
  id: number
  full_name: string | null
  sede_legale_via: string | null
  sede_legale_cap: string | null
  sede_legale_citta: string | null
  sede_legale_provincia: string | null
  sede_operativa_via: string | null
  sede_operativa_cap: string | null
  sede_operativa_citta: string | null
  sede_operativa_provincia: string | null
  telefono: string | null
  email: string | null
  pec: string | null
  partita_iva: string | null
  codice_fiscale: string | null
  camera_commercio: string | null
  rea: string | null
  rea_data_iscrizione: string | null
  rea_protocollo: string | null
  iscrizione_fiaip: string | null
  polizza_compagnia: string | null
  polizza_numero: string | null
  polizza_scadenza: string | null
  updated_at: string
}

export type DocumentTemplateId =
  | 'antiriciclaggio'
  | 'privacy'
  | 'incarico_vendita'
  | 'proposta_acquisto'
  | 'dich_provvigionale_acquirente'

export type DocumentParty = 'buyer' | 'seller' | 'agency'
export type DocumentStatus = 'missing' | 'draft' | 'generated' | 'signed' | 'archived'

export type OperationDocument = {
  id: string
  operation_id: string
  template_id: DocumentTemplateId
  party: DocumentParty
  status: DocumentStatus
  data: Record<string, unknown>
  pdf_storage_path: string | null
  pdf_signed_storage_path: string | null
  generated_at: string | null
  signed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type AnnualBudget = {
  id: string
  year: number
  total_target: number
  created_at: string
  updated_at: string
}

export type AgentBudgetAllocation = {
  id: string
  budget_id: string
  agent_id: string
  allocated_target: number
  created_at: string
}

export type Operation = {
  id: string
  agent_id: string
  property_name: string
  address: string | null
  type: 'vendita' | 'locazione'
  status: 'pipeline' | 'proposta_accettata' | 'incassato' | 'terminato'
  origin: 'agente' | 'agenzia' | 'valutazione'
  property_value: number | null
  comm_pct_seller: number
  comm_pct_buyer: number
  sale_date: string | null
  final_value: number | null
  gross_commission: number | null
  agent_commission: number | null
  notes: string | null
  date_added: string
  updated_at: string
  // Acquirente
  buyer_first_name: string | null
  buyer_last_name: string | null
  buyer_name: string | null
  // Collaboratore
  collaborator_id: string | null
  collaborator_first_name: string | null
  collaborator_last_name: string | null
  collaborator_name: string | null
  collaborator_comm_pct: number
  collaborator_commission: number | null
  // Modalità commissioni (pct o fixed)
  comm_mode_seller: 'pct' | 'fixed'
  comm_mode_buyer: 'pct' | 'fixed'
  comm_fixed_seller: number
  comm_fixed_buyer: number
  // Provvigioni incassate
  commission_collected: number | null
  collection_date: string | null
  // Date incarico
  mandate_start_date: string | null
  mandate_end_date: string | null
  // Probabilità vendita
  sale_probability: 30 | 60 | 90 | null
  // Cliente associato
  client_id: string | null
  // Pubblicazione sito
  publish_to_website: boolean
  // Dati per modulistica documenti
  dati_catastali: { foglio?: string; particella?: string; sub?: string; categoria?: string; classe?: string; rendita?: string } | null
  scala: string | null
  piano: string | null
  interno: string | null
  servito_ascensore: boolean
  destinazione_uso: string | null
  composizione: string | null
  confini: string | null
  superficie_mq: number | null
  locato_a: string | null
  locato_canone: number | null
  locato_scadenza: string | null
  caparra: number | null
  caparra_modalita: string | null
  modalita_pagamento: string | null
  condizioni_sospensive: string | null
  scadenza_proposta: string | null
  provenienza_immobile: string | null
  provenienza_atto_data: string | null
  provenienza_atto_notaio: string | null
  quote_proprieta: Array<{ client_id: string; quota_pct: number; tipologia: 'piena' | 'nuda' | 'usufrutto' }> | null
}

export type ClientProperty = {
  id: string
  client_id: string
  property_name: string
  address: string | null
  property_value: number | null
  status: 'venduto_nostra' | 'venduto_altri' | 'in_vendita_altri' | 'non_in_vendita' | 'tracciato'
  agency_name: string | null
  notes: string | null
  operation_id: string | null
  created_at: string
  updated_at: string
}

export type Valutazione = {
  id: string
  agent_id: string
  owner_name: string
  address: string
  estimated_price: number | null
  acquisition_probability: '15_giorni' | '3_mesi' | '6_mesi' | null
  notes: string | null
  valuation_date: string
  incarico_preso: boolean
  incarico_date: string | null
  operation_id: string | null
  origin: 'agente' | 'agenzia'
  valuation_delivered: boolean
  created_at: string
  updated_at: string
}

export type ValutazioneWithAgent = Valutazione & {
  profiles?: Profile
}

export type OperationWithAgent = Operation & {
  profiles?: Profile
}
