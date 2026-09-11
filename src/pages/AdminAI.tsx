import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTIONS = [
  'Qual è il valore totale degli immobili venduti nel 2026?',
  'Chi è l\'agente con le commissioni più alte?',
  'Quanti clienti acquirenti abbiamo?',
  'Quali immobili sono in pipeline con probabilità 90%?',
  'Qual è il prezzo medio degli immobili venduti a Novara?',
  'Dammi un riepilogo delle performance di tutti gli agenti',
]

export default function AdminAI() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return

    const userMsg: Message = { role: 'user', content: msg, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      // Build history (last 10 messages for context)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const { data, error } = await supabase.functions.invoke('victorco-ai', {
        body: { message: msg, history },
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `Errore: ${(err as Error).message}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const mono = { fontFamily: "'Montserrat', sans-serif" } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className="section-heading" style={{ margin: 0 }}>Victor&Co AI</div>
          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 2 }}>
            Accesso completo a tutti i dati CRM — chiedi qualsiasi cosa
          </div>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => setMessages([])}>
            Nuova conversazione
          </button>
        )}
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--s1)',
        borderRadius: 12,
        border: '1px solid var(--bd)',
        padding: 16,
        marginBottom: 12,
      }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
            <div style={{ ...mono, fontSize: 28, color: 'var(--lime)', fontWeight: 700 }}>// V&C AI</div>
            <div style={{ color: 'var(--g)', fontSize: 14, textAlign: 'center', maxWidth: 500 }}>
              Chiedimi informazioni su clienti, immobili, commissioni, performance agenti, valutazioni, o qualsiasi dato del CRM.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, whiteSpace: 'normal', textAlign: 'left', maxWidth: 280 }}
                  onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? 'rgba(13,52,71,0.15)' : 'var(--bg2)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(13,52,71,0.3)' : 'var(--bd)'}`,
                }}>
                  {msg.role === 'assistant' && (
                    <div style={{ ...mono, fontSize: 10, color: 'var(--lime)', marginBottom: 6 }}>// Victor AI</div>
                  )}
                  <div style={{
                    color: 'var(--w)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                  <div style={{ ...mono, fontSize: 9, color: 'var(--g)', marginTop: 6, textAlign: 'right' }}>
                    {msg.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: 'var(--bg2)', border: '1px solid var(--bd)',
                }}>
                  <div style={{ ...mono, fontSize: 10, color: 'var(--lime)', marginBottom: 6 }}>// Victor AI</div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                    <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', animationDelay: '0.2s' }} />
                    <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', animationDelay: '0.4s' }} />
                    <span style={{ fontSize: 12, color: 'var(--g)', marginLeft: 8 }}>Analizzo i dati...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        display: 'flex', gap: 8,
        background: 'var(--s1)', borderRadius: 12,
        border: '1px solid var(--bd)', padding: 8,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Chiedi qualcosa sui dati CRM..."
          rows={1}
          style={{
            flex: 1, resize: 'none',
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--w)', fontSize: 14, padding: '8px 12px',
            fontFamily: 'Poppins, sans-serif',
          }}
        />
        <button
          className="btn btn-primary"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          style={{ alignSelf: 'flex-end', padding: '8px 20px' }}
        >
          Invia
        </button>
      </div>
    </div>
  )
}
