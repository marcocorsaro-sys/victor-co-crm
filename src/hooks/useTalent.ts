import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type MatchStatus = 'confermato' | 'possibile' | 'non_trovato' | 'scartato'
export type TalentStage = 'da_contattare' | 'contattato' | 'incontro' | 'trattativa' | 'scartato' | 'entrato'

export const TALENT_STAGES: { id: TalentStage; label: string }[] = [
  { id: 'da_contattare', label: 'Da contattare' },
  { id: 'contattato', label: 'Contattato' },
  { id: 'incontro', label: 'Incontro' },
  { id: 'trattativa', label: 'Trattativa' },
  { id: 'entrato', label: 'Entrato' },
  { id: 'scartato', label: 'Scartato' },
]

export type ScorePart = { v: number | null; max: number; note: string }
export type ScoreBreakdown = Partial<Record<'digitale' | 'esperienza' | 'contendibilita' | 'fit', ScorePart>>

export type TalentProspect = {
  id: string
  position: number
  full_name: string
  phone: string | null
  agency: string | null
  regime: string | null
  patentino: 'si' | 'no' | 'non_noto'
  activity: string | null
  pdf_note: string | null
  data_flag: string | null
  linkedin_url: string | null
  linkedin_match: MatchStatus
  linkedin_data: Record<string, any>
  instagram_handle: string | null
  instagram_match: MatchStatus
  instagram_data: Record<string, any>
  score_breakdown: ScoreBreakdown
  approach_angle: string | null
  stage: TalentStage
  owner: string | null
  notes: string | null
  contacted_at: string | null
  enriched_at: string | null
}

/** Punteggio 0-100 sulle sole componenti con dato disponibile; null se copertura < 2 componenti. */
export function talentScore(b: ScoreBreakdown): { score: number | null; coverage: number } {
  const parts = Object.values(b).filter(Boolean) as ScorePart[]
  const known = parts.filter(p => p.v !== null)
  if (known.length < 2) return { score: null, coverage: known.length }
  const got = known.reduce((s, p) => s + (p.v as number), 0)
  const max = known.reduce((s, p) => s + p.max, 0)
  return { score: Math.round((got / max) * 100), coverage: known.length }
}

export function useTalent() {
  const [prospects, setProspects] = useState<TalentProspect[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const { data } = await supabase.from('talent_prospects').select('*').order('position')
    if (data) setProspects(data as TalentProspect[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const update = async (id: string, patch: Partial<TalentProspect>) => {
    setProspects(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)))
    const { error } = await supabase.from('talent_prospects').update(patch).eq('id', id)
    if (error) fetchAll()
  }

  return { prospects, loading, update, refetch: fetchAll }
}
