import { useState, useCallback } from 'react'
import type { OperationWithAgent } from '../lib/supabase'
import { parseEurInput } from '../lib/calculations'

export type FilterState = {
  search: string
  agents: string[]
  types: string[]
  origins: string[]
  statuses: string[]
  dateFrom: string
  dateTo: string
  commissionMin: string
  commissionMax: string
  valueMin: string
  valueMax: string
  collectionStatus: string  // 'collected' | 'not_collected' | ''
  collaborator: string
}

const initialFilters: FilterState = {
  search: '', agents: [], types: [], origins: [], statuses: [],
  dateFrom: '', dateTo: '', commissionMin: '', commissionMax: '',
  valueMin: '', valueMax: '', collectionStatus: '', collaborator: '',
}

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(initialFilters)

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [])

  const applyFilters = useCallback((operations: OperationWithAgent[]): OperationWithAgent[] => {
    return operations.filter(o => {
      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase()
        // Match across all buyers + sellers (with retro-compat to legacy buyer_name)
        const buyersText = (o.buyers || []).map(b => `${b.first_name} ${b.last_name}`).join(' ').toLowerCase()
        const sellersText = (o.sellers || []).map(s => `${s.first_name} ${s.last_name}`).join(' ').toLowerCase()
        const match = o.property_name.toLowerCase().includes(q) ||
          (o.address || '').toLowerCase().includes(q) ||
          (o.buyer_name || '').toLowerCase().includes(q) ||
          buyersText.includes(q) ||
          sellersText.includes(q) ||
          (o.profiles?.full_name || '').toLowerCase().includes(q)
        if (!match) return false
      }
      // Multi-select filters
      if (filters.agents.length > 0 && !filters.agents.includes(o.agent_id)) return false
      if (filters.types.length > 0 && !filters.types.includes(o.type)) return false
      if (filters.origins.length > 0 && !filters.origins.includes(o.origin)) return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(o.status)) return false
      // Date range
      if (filters.dateFrom || filters.dateTo) {
        const d = o.sale_date || o.date_added
        if (!d) return false
        const date = d.split('T')[0]
        if (filters.dateFrom && date < filters.dateFrom) return false
        if (filters.dateTo && date > filters.dateTo) return false
      }
      // Commission range
      if (filters.commissionMin) {
        const min = parseEurInput(filters.commissionMin)
        if ((o.gross_commission || 0) < min) return false
      }
      if (filters.commissionMax) {
        const max = parseEurInput(filters.commissionMax)
        if ((o.gross_commission || 0) > max) return false
      }
      // Value range
      if (filters.valueMin) {
        const min = parseEurInput(filters.valueMin)
        const val = o.final_value || o.property_value || 0
        if (val < min) return false
      }
      if (filters.valueMax) {
        const max = parseEurInput(filters.valueMax)
        const val = o.final_value || o.property_value || 0
        if (val > max) return false
      }
      // Collection status
      if (filters.collectionStatus === 'collected' && !o.commission_collected) return false
      if (filters.collectionStatus === 'not_collected' && o.commission_collected) return false
      // Collaborator
      if (filters.collaborator === 'with' && !o.collaborator_id && !o.collaborator_name) return false
      if (filters.collaborator === 'without' && (o.collaborator_id || o.collaborator_name)) return false
      return true
    })
  }, [filters])

  const hasActiveFilters = Object.entries(filters).some(([, v]) => {
    if (Array.isArray(v)) return v.length > 0
    return !!v
  })

  return { filters, setFilter, resetFilters, applyFilters, hasActiveFilters }
}
