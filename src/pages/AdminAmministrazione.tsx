import { useSearchParams } from 'react-router-dom'
import { useOperations } from '../hooks/useOperations'
import { useClients } from '../hooks/useClients'
import { useProfiles } from '../hooks/useProfiles'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import Panoramica from '../components/amministrazione/Panoramica'
import Adempimenti from '../components/amministrazione/Adempimenti'
import Pagamenti from '../components/amministrazione/Pagamenti'
import DocumentiPratiche from '../components/amministrazione/DocumentiPratiche'
import Contabilita from '../components/amministrazione/Contabilita'
import RichiestePortali from '../components/amministrazione/RichiestePortali'
import ProformaIncassi from '../components/amministrazione/ProformaIncassi'
import GuidaDocumenti from '../components/amministrazione/GuidaDocumenti'

const TABS = [
  { key: 'panoramica', label: 'Panoramica' },
  { key: 'adempimenti', label: 'Registrazioni' },
  { key: 'pagamenti', label: 'Pagamenti' },
  { key: 'documenti', label: 'Documenti pratiche' },
  { key: 'contabilita', label: 'Contabilita' },
  { key: 'portali', label: 'Richieste portali' },
  { key: 'proforma', label: 'Proforma e incassi' },
  { key: 'guida', label: 'Analisi e job description' },
] as const

/**
 * Area Amministrazione: un unico posto per le procedure di back office dell'agenzia.
 * Le tabelle sono adm_* (vedi supabase/2026-11-12_amministrazione.sql), accessibili solo agli admin.
 */
export default function AdminAmministrazione() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.key === params.get('t')) ? (params.get('t') as string) : 'panoramica'
  const goTo = (t: string) => setParams({ t })

  const { operations } = useOperations()
  const { clients } = useClients()
  const { agents } = useProfiles()
  const { toasts, addToast } = useToast()

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="section-heading">Amministrazione</div>
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => goTo(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'panoramica' && <Panoramica operations={operations} goTo={goTo} />}
      {tab === 'adempimenti' && <Adempimenti operations={operations} toast={addToast} />}
      {tab === 'pagamenti' && <Pagamenti operations={operations} toast={addToast} />}
      {tab === 'documenti' && <DocumentiPratiche operations={operations} toast={addToast} />}
      {tab === 'contabilita' && <Contabilita toast={addToast} />}
      {tab === 'portali' && <RichiestePortali agents={agents} toast={addToast} />}
      {tab === 'guida' && <GuidaDocumenti />}
      {tab === 'proforma' && <ProformaIncassi operations={operations} clients={clients} agents={agents} toast={addToast} />}
    </div>
  )
}
