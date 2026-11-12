import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/activityLogger'
import { fileSafeName } from '../lib/amministrazione'

type Row = { id: string }

/** Hook generico CRUD per le tabelle adm_* (accesso admin via RLS). */
export function useAdmTable<T extends Row>(
  table: string,
  opts: { orderBy?: string; ascending?: boolean } = {},
) {
  const { orderBy = 'created_at', ascending = false } = opts
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
    if (err) {
      setError(err.message)
      setRows([])
    } else {
      setError(null)
      setRows((data ?? []) as T[])
    }
    setLoading(false)
  }, [table, orderBy, ascending])

  useEffect(() => { fetchRows() }, [fetchRows])

  const add = useCallback(async (values: Partial<T>) => {
    const { data, error: err } = await supabase.from(table).insert(values).select('*').single()
    if (err) return { error: err.message }
    setRows(prev => [data as T, ...prev])
    logAction(`${table}_created`)
    return { data: data as T }
  }, [table])

  const update = useCallback(async (id: string, patch: Partial<T>) => {
    const { data, error: err } = await supabase.from(table).update(patch).eq('id', id).select('*').single()
    if (err) return { error: err.message }
    setRows(prev => prev.map(r => (r.id === id ? (data as T) : r)))
    return { data: data as T }
  }, [table])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) return { error: err.message }
    setRows(prev => prev.filter(r => r.id !== id))
    logAction(`${table}_deleted`)
    return {}
  }, [table])

  return { rows, loading, error, add, update, remove, refetch: fetchRows }
}

/** Carica un file nel bucket privato `documents`, sotto il prefisso indicato. Ritorna il path salvato. */
export async function uploadAdmFile(prefix: string, file: File): Promise<{ path?: string; error?: string }> {
  const path = `${prefix}/${Date.now()}-${fileSafeName(file.name)}`
  const { error } = await supabase.storage.from('documents').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) return { error: error.message }
  return { path }
}

export async function openAdmFile(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 300)
  if (error || !data) return null
  window.open(data.signedUrl, '_blank', 'noopener')
  return data.signedUrl
}
