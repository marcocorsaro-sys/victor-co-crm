import { supabase } from './supabase'
import type { Valutazione } from './supabase'

export async function getValutazioni(agentId: string, year: number) {
  const { data, error } = await supabase
    .from('valutazioni')
    .select('*')
    .eq('agent_id', agentId)
    .gte('valuation_date', `${year}-01-01`)
    .lt('valuation_date', `${year + 1}-01-01`)
    .order('valuation_date', { ascending: false })
  return { data: data as Valutazione[] | null, error }
}

export async function getAllValutazioni(year: number) {
  const { data, error } = await supabase
    .from('valutazioni')
    .select('*, profiles(id, full_name, initials, color)')
    .gte('valuation_date', `${year}-01-01`)
    .lt('valuation_date', `${year + 1}-01-01`)
    .order('valuation_date', { ascending: false })
  return { data, error }
}

export async function createValutazione(fields: Partial<Valutazione>) {
  const { data, error } = await supabase
    .from('valutazioni')
    .insert(fields)
    .select()
    .single()
  return { data: data as Valutazione | null, error }
}

export async function updateValutazione(id: string, fields: Partial<Valutazione>) {
  const { data, error } = await supabase
    .from('valutazioni')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  return { data: data as Valutazione | null, error }
}

export async function deleteValutazione(id: string) {
  const { error } = await supabase
    .from('valutazioni')
    .delete()
    .eq('id', id)
  return { error }
}

export async function setIncaricoPreso(valutazioneId: string) {
  // 1. Read the valutazione
  const { data: val, error: fetchError } = await supabase
    .from('valutazioni')
    .select('*')
    .eq('id', valutazioneId)
    .single()

  if (fetchError || !val) throw fetchError || new Error('Valutazione non trovata')

  // 2. Create operation in pipeline
  const { data: operation, error: opError } = await supabase
    .from('operations')
    .insert({
      agent_id: val.agent_id,
      property_name: val.owner_name,
      address: val.address,
      property_value: val.estimated_price ?? null,
      type: 'vendita',
      status: 'pipeline',
      // L'incarico eredita l'origine reale della valutazione (agente/agenzia)
      origin: val.origin ?? 'agente',
      notes: val.notes ?? null,
    })
    .select()
    .single()

  if (opError) throw opError

  // 3. Update valutazione with incarico flag + operation link
  const { error: valError } = await supabase
    .from('valutazioni')
    .update({
      incarico_preso: true,
      incarico_date: new Date().toISOString(),
      operation_id: operation.id,
    })
    .eq('id', valutazioneId)

  if (valError) throw valError

  return operation
}
