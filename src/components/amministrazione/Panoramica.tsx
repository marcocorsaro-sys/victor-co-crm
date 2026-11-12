import { useEffect, useState } from 'react'
import type { OperationWithAgent } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { addDaysIso, todayIso } from '../../lib/amministrazione'
import { Head, Kpi, SetupNotice } from './ui'

type Props = { operations: OperationWithAgent[]; goTo: (tab: string) => void }

type Counts = {
  adempimentiUrgenti: number
  pagamentiDaApprovare: number
  antiriciclaggioMancante: number
  leadDaAssegnare: number
  leadFermi: number
  proformaScadute: number
  richiesteStudio: number
  chiusuraAperta: number
}

export default function Panoramica({ operations, goTo }: Props) {
  const [c, setC] = useState<Counts | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const today = todayIso()
      const limit = addDaysIso(today, 5)
      const monthKey = today.slice(0, 7) + '-01'
      const dayAgo = new Date(Date.now() - 86400000).toISOString()
      const [adm, pay, aml, leadNew, leadStale, prof, req, close] = await Promise.all([
        supabase.from('adm_fulfilments').select('id', { count: 'exact', head: true }).neq('status', 'registrata').lte('due_date', limit),
        supabase.from('adm_payments').select('id', { count: 'exact', head: true }).eq('status', 'da_approvare'),
        supabase.from('operation_documents').select('operation_id').eq('template_id', 'antiriciclaggio').in('status', ['signed', 'archived']),
        supabase.from('adm_leads').select('id', { count: 'exact', head: true }).eq('status', 'nuova'),
        supabase.from('adm_leads').select('id', { count: 'exact', head: true }).eq('status', 'inoltrata').lte('forwarded_at', dayAgo),
        supabase.from('adm_invoices').select('id', { count: 'exact', head: true }).eq('status', 'inviata').lt('due_date', today),
        supabase.from('adm_accountant_requests').select('id', { count: 'exact', head: true }).neq('status', 'chiusa'),
        supabase.from('adm_month_close_items').select('id', { count: 'exact', head: true }).eq('month', monthKey).eq('done', false),
      ])
      const firstErr = [adm, pay, leadNew, leadStale, prof, req, close].find(r => r.error)?.error
      if (firstErr) setError(firstErr.message)
      const signed = new Set(((aml.data ?? []) as Array<{ operation_id: string }>).map(r => r.operation_id))
      setC({
        adempimentiUrgenti: adm.count ?? 0,
        pagamentiDaApprovare: pay.count ?? 0,
        antiriciclaggioMancante: operations.filter(o => o.status !== 'terminato' && !signed.has(o.id)).length,
        leadDaAssegnare: leadNew.count ?? 0,
        leadFermi: leadStale.count ?? 0,
        proformaScadute: prof.count ?? 0,
        richiesteStudio: req.count ?? 0,
        chiusuraAperta: close.count ?? 0,
      })
    })()
  }, [operations])

  const tone = (n: number, t: 'red' | 'amber') => (n > 0 ? t : 'green')

  return (
    <div>
      <Head title="Da fare oggi" hint="Cio' che richiede un'azione, modulo per modulo. Clicca una scheda per andare al dettaglio." />
      <SetupNotice error={error} />
      {!c ? <div className="skeleton" style={{ height: 160, borderRadius: 10 }} /> : (
        <div className="kpi-grid">
          <Kpi label="Registrazioni entro 5 giorni o scadute" value={c.adempimentiUrgenti} tone={tone(c.adempimentiUrgenti, 'red')} onClick={() => goTo('adempimenti')} />
          <Kpi label="Pagamenti da approvare" value={c.pagamentiDaApprovare} tone={tone(c.pagamentiDaApprovare, 'amber')} onClick={() => goTo('pagamenti')} />
          <Kpi label="Pratiche senza antiriciclaggio firmato" value={c.antiriciclaggioMancante} tone={tone(c.antiriciclaggioMancante, 'red')} onClick={() => goTo('documenti')} />
          <Kpi label="Richieste portali da assegnare" value={c.leadDaAssegnare} tone={tone(c.leadDaAssegnare, 'red')} onClick={() => goTo('portali')} />
          <Kpi label="Richieste inoltrate ferme da 24 ore" value={c.leadFermi} tone={tone(c.leadFermi, 'amber')} onClick={() => goTo('portali')} />
          <Kpi label="Proforma scadute da sollecitare" value={c.proformaScadute} tone={tone(c.proformaScadute, 'red')} onClick={() => goTo('proforma')} />
          <Kpi label="Richieste aperte dal commercialista" value={c.richiesteStudio} tone={tone(c.richiesteStudio, 'amber')} onClick={() => goTo('contabilita')} />
          <Kpi label="Voci aperte nella chiusura del mese" value={c.chiusuraAperta} tone={tone(c.chiusuraAperta, 'amber')} onClick={() => goTo('contabilita')} />
        </div>
      )}
    </div>
  )
}
