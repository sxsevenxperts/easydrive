import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Send, MessageCircle, Users, Smile, X, Pencil, Check } from 'lucide-react'

const LOAD_LIMIT = 60
const EMOJIS = ['😊','👍','🚗','💰','🔥','😂','❤️','👏','🎉','😎','🤙','💪','🙏','✅','⚡']

function fmt(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diffH = (now - d) / 3_600_000
  if (diffH < 24) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// Cor do avatar baseada no nome (determinística)
function avatarColor(name = '') {
  const colors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#14b8a6','#f97316','#ec4899']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const LS_NAME_KEY = 'easydrive_chat_name'

export default function Chat({ user }) {
  const [messages, setMessages]     = useState([])
  const [text, setText]             = useState('')
  const [sending, setSending]       = useState(false)
  const [online, setOnline]         = useState(0)
  const [showEmoji, setShowEmoji]   = useState(false)
  const [error, setError]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const nameInputRef = useRef(null)
  const channelRef = useRef(null)

  const myId = user?.id
  const defaultName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Motorista'
  const [myName, setMyName] = useState(
    () => localStorage.getItem(LS_NAME_KEY) || defaultName
  )

  const saveName = useCallback(() => {
    const trimmed = nameInput.trim().slice(0, 30)
    if (trimmed) {
      setMyName(trimmed)
      localStorage.setItem(LS_NAME_KEY, trimmed)
    }
    setEditingName(false)
  }, [nameInput])

  // Focar input quando abrir edição
  useEffect(() => {
    if (editingName) {
      setNameInput(myName)
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [editingName, myName])

  // ── Carregar mensagens iniciais ────────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      setError('Chat não disponível no modo demo.')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('chat_messages')
        .select('id, user_id, user_name, content, created_at')
        .order('created_at', { ascending: false })
        .limit(LOAD_LIMIT)

      if (!cancelled) {
        if (err) setError('Erro ao carregar mensagens.')
        else setMessages((data || []).reverse())
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Realtime subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('chat-room', {
        config: { presence: { key: myId || 'anon' } },
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
      }, (payload) => {
        setMessages((prev) => {
          // Evitar duplicatas (mensagens enviadas por mim já estão no state)
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnline(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: myId, user_name: myName, online_at: new Date().toISOString() })
        }
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [myId, myName])

  // ── Enviar mensagem ────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = text.trim()
    if (!content || !supabase || sending) return

    setSending(true)
    setShowEmoji(false)

    // Otimistic update
    const optimistic = {
      id: `opt-${Date.now()}`,
      user_id: myId,
      user_name: myName,
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setText('')

    const { data, error: err } = await supabase
      .from('chat_messages')
      .insert({ user_id: myId, user_name: myName, content })
      .select()
      .single()

    setSending(false)

    if (err) {
      // Reverter optimistic em caso de erro
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(content)
      setError('Erro ao enviar. Tente novamente.')
    } else if (data) {
      // Substituir optimistic pelo real
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
    }
  }, [text, myId, myName, sending])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Agrupar mensagens consecutivas do mesmo usuário ───────────────────
  const grouped = messages.map((msg, i) => {
    const prev = messages[i - 1]
    const sameUser  = prev?.user_id === msg.user_id
    const sameMin   = prev && (new Date(msg.created_at) - new Date(prev.created_at)) < 60_000
    return { ...msg, hideAvatar: sameUser && sameMin, hideName: sameUser && sameMin }
  })

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Header */}
      <div style={{
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', flexShrink: 0,
      }}>
        {/* Linha superior: título + online */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageCircle size={18} color='#fff' />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>Chat dos Motoristas</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {online > 0 ? `${online} online agora` : 'Sala aberta'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text3)' }}>
            <Users size={13} />
            <span style={{ fontSize: 11 }}>{online}</span>
          </div>
        </div>

        {/* Linha do nome do usuário */}
        <div style={{
          background: 'var(--bg3)', borderRadius: 12, padding: '8px 12px',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: avatarColor(myName),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff',
          }}>
            {initials(myName)}
          </div>

          {editingName ? (
            <>
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                maxLength={30}
                placeholder='Seu nome no chat'
                style={{
                  flex: 1, background: 'var(--bg)', border: '1px solid #3b82f6',
                  borderRadius: 8, padding: '4px 8px', color: 'var(--text)',
                  fontSize: 13, outline: 'none',
                }}
              />
              <button
                onClick={saveName}
                style={{ background: '#22c55e', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Check size={14} color='#fff' />
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Salvar</span>
              </button>
              <button
                onClick={() => setEditingName(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Seu nome no chat</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{myName}</p>
              </div>
              <button
                onClick={() => setEditingName(true)}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  color: 'var(--text3)',
                }}
              >
                <Pencil size={13} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Editar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Aviso de erro */}
      {error && (
        <div style={{
          background: '#ef444415', borderBottom: '1px solid #ef444430',
          padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Lista de mensagens */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <p style={{ fontSize: 14 }}>Carregando mensagens...</p>
          </div>
        )}

        {!loading && messages.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--text3)' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🗣️</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Seja o primeiro a falar!</p>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>
              Este é o chat dos motoristas EasyDrive.<br />
              Compartilhe dicas, pontos quentes e experiências.
            </p>
          </div>
        )}

        {grouped.map((msg) => {
          const isMe = msg.user_id === myId
          const color = avatarColor(msg.user_name)

          return (
            <div key={msg.id} style={{
              display: 'flex',
              flexDirection: isMe ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 8,
              marginTop: msg.hideName ? 2 : 10,
            }}>
              {/* Avatar */}
              {!isMe && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: msg.hideAvatar ? 'transparent' : color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: '#fff',
                  marginBottom: 2,
                }}>
                  {!msg.hideAvatar && initials(msg.user_name)}
                </div>
              )}

              <div style={{
                maxWidth: '75%',
                display: 'flex', flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
              }}>
                {/* Nome + hora */}
                {!msg.hideName && (
                  <p style={{
                    fontSize: 11, color: isMe ? '#22c55e' : color,
                    fontWeight: 700, marginBottom: 3, paddingLeft: isMe ? 0 : 2, paddingRight: isMe ? 2 : 0,
                  }}>
                    {isMe ? 'Você' : msg.user_name}
                  </p>
                )}

                {/* Balão */}
                <div style={{
                  background: isMe
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'var(--bg3)',
                  color: isMe ? '#fff' : 'var(--text)',
                  borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  padding: '9px 13px',
                  border: isMe ? 'none' : '1px solid var(--border)',
                  fontSize: 14, lineHeight: 1.45,
                  wordBreak: 'break-word',
                  opacity: msg.id?.startsWith('opt-') ? 0.7 : 1,
                }}>
                  {msg.content}
                </div>

                {/* Hora (última mensagem do grupo) */}
                <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
                  {fmt(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div style={{
          padding: '10px 14px', background: 'var(--bg3)',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0,
        }}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => { setText(t => t + e); inputRef.current?.focus() }}
              style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '2px 4px', borderRadius: 8 }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        background: 'var(--bg)', borderTop: '1px solid var(--border)',
        padding: '10px 12px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 8, alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setShowEmoji(v => !v)}
          style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: showEmoji ? '#3b82f620' : 'var(--bg3)',
            border: `1px solid ${showEmoji ? '#3b82f6' : 'var(--border)'}`,
            color: showEmoji ? '#3b82f6' : 'var(--text3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Smile size={18} />
        </button>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={supabase ? 'Mensagem...' : 'Chat indisponível no modo demo'}
          disabled={!supabase || !user}
          rows={1}
          style={{
            flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '9px 12px', color: 'var(--text)',
            fontSize: 14, outline: 'none', resize: 'none',
            maxHeight: 96, lineHeight: 1.4,
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            overflowY: 'auto',
          }}
          onInput={(e) => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
          }}
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || sending || !supabase}
          style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: text.trim() && !sending ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--bg3)',
            border: 'none', cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', opacity: sending ? 0.6 : 1,
          }}
        >
          <Send size={16} color={text.trim() && !sending ? '#fff' : 'var(--text3)'} />
        </button>
      </div>
    </div>
  )
}
