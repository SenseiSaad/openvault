'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  CalendarCheck,
  Check,
  Download,
  FileText,
  Globe,
  History,
  KeyRound,
  Laptop,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  ShieldAlert,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  askStream,
  chatApi,
  downloadGeneratedForm,
  settingsApi,
  workApi,
  type Conversation,
  type LlmStatus,
  type WorkflowResult,
} from '@/lib/api'
import { t } from '@/lib/i18n'
import { toast } from '@/components/toaster'

type Message = {
  id?: number
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  rating?: number | null
  error?: boolean
  mode?: 'local' | 'online'
  flag?: { message: string; categories: string[] }
  workflow?: WorkflowResult
}

const EXAMPLES = [
  'Summarise our key documents in a few bullet points.',
  'What information is available in the uploaded files?',
  'What are the key technical or business takeaways?',
]

export default function WorkspaceChatPage() {
  const { user, language } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [llm, setLlm] = useState<LlmStatus | null>(null)
  const [mode, setMode] = useState<'local' | 'online'>('online')
  const [showKeyModal, setShowKeyModal] = useState(false)

  // Chat conversation history state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loadingConv, setLoadingConv] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refreshLlm = useCallback(() => {
    workApi.llmStatus().then(setLlm).catch(() => setLlm(null))
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const res = await chatApi.conversations()
      setConversations(res.results || [])
    } catch {
      /* non-blocking */
    }
  }, [])

  useEffect(() => {
    refreshLlm()
    loadConversations()
  }, [refreshLlm, loadConversations])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const selectConversation = useCallback(
    async (id: number) => {
      if (streaming) return
      setCurrentConversationId(id)
      setLoadingConv(true)
      try {
        const res = await chatApi.messages(id)
        setMessages(
          res.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources || [],
            rating: m.rating,
          })),
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load conversation.')
      } finally {
        setLoadingConv(false)
      }
    },
    [streaming],
  )

  const handleNewChat = useCallback(() => {
    if (streaming) return
    setCurrentConversationId(null)
    setMessages([])
  }, [streaming])

  const handleDeleteConversation = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await chatApi.remove(id)
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (currentConversationId === id) {
          setCurrentConversationId(null)
          setMessages([])
        }
        toast.success('Conversation removed.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not delete conversation.')
      }
    },
    [currentConversationId],
  )

  const handleRate = useCallback(async (msgIndex: number, messageId: number, rating: 1 | -1) => {
    setMessages((prev) =>
      prev.map((m, idx) => (idx === msgIndex ? { ...m, rating } : m)),
    )
    try {
      await chatApi.rate(messageId, rating)
      toast.success(rating === 1 ? 'Marked helpful.' : 'Feedback recorded.')
    } catch {
      toast.error('Could not save rating.')
    }
  }, [])

  const send = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || streaming) return
      setInput('')
      setStreaming(true)

      setMessages((m) => [
        ...m,
        { role: 'user', content: q, mode },
        { role: 'assistant', content: '', mode },
      ])

      const controller = new AbortController()
      abortRef.current = controller
      try {
        await askStream(
          q,
          (e) => {
            if (e.type === 'conversation') {
              setCurrentConversationId(e.conversation_id)
              loadConversations()
              return
            }
            setMessages((m) => {
              const last = m[m.length - 1]
              if (last?.role !== 'assistant') return m
              const updated: Message = { ...last }
              if (e.type === 'sources') updated.sources = e.sources
              else if (e.type === 'saved') updated.id = e.message_id
              else if (e.type === 'flag')
                updated.flag = { message: e.message, categories: e.categories }
              else if (e.type === 'token') updated.content += e.token
              else if (e.type === 'workflow') updated.workflow = e
              else if (e.type === 'error') {
                updated.content = e.message
                updated.error = true
              }
              return [...m.slice(0, -1), updated]
            })
          },
          controller.signal,
          { mode, conversationId: currentConversationId },
        )
      } catch (err) {
        if (!controller.signal.aborted) {
          setMessages((m) => {
            const last = m[m.length - 1]
            if (last?.role !== 'assistant' || last.content) return m
            return [
              ...m.slice(0, -1),
              {
                ...last,
                content: err instanceof Error ? err.message : 'Something went wrong.',
                error: true,
              },
            ]
          })
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
        loadConversations()
      }
    },
    [streaming, mode, currentConversationId, loadConversations],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const onlineAvailable = !!llm?.online_api?.online || (mode === 'online' && !!llm?.online)
  const localAvailable = !!llm?.local?.online || (mode === 'local' && !!llm?.online)
  const hasGeminiKey = !!llm?.online_api?.has_key

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      {/* History Sidebar */}
      {sidebarOpen ? (
        <aside className="flex w-64 shrink-0 flex-col rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-3 shadow-sm transition-all lg:w-72">
          <div className="flex items-center justify-between border-b border-[#f0ede6] pb-3">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6b6862]">
              <History className="size-3.5" />
              {t('history', language)}
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 text-[#6b6862] hover:bg-[#f2efe9]"
              title="Hide sidebar"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="py-2.5">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={streaming}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1d1b] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#3c3b37] disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              {t('newChat', language)}
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto pr-1">
            {conversations.length === 0 ? (
              <p className="mt-8 text-center text-xs text-[#8c8a83]">No past conversations.</p>
            ) : (
              conversations.map((c) => {
                const isSelected = c.id === currentConversationId
                return (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                      isSelected
                        ? 'bg-[#1d1d1b] font-medium text-white'
                        : 'text-[#4f4d47] hover:bg-[#f4f2ec]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <MessageSquare className="size-3.5 shrink-0 opacity-70" />
                      <span className="truncate" title={c.title}>
                        {c.title || 'Untitled thread'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className={`rounded p-1 opacity-0 transition group-hover:opacity-100 ${
                        isSelected
                          ? 'text-white/80 hover:text-white'
                          : 'text-[#9a3b2c] hover:bg-[#fbe4e0]'
                      }`}
                      title="Delete thread"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[#d8d5cc] bg-[#fffdfa] text-[#6b6862] hover:bg-[#f4f2ec]"
          title="Open conversation history"
        >
          <History className="size-4" />
        </button>
      )}

      {/* Main Chat Area */}
      <div className="mx-auto flex h-full max-w-3xl flex-1 flex-col">
        <ChatHeader
          llm={llm}
          mode={mode}
          onModeChange={setMode}
          onOpenKeyModal={() => setShowKeyModal(true)}
        />

        <div ref={scrollRef} className="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
          {loadingConv ? (
            <div className="grid h-full place-items-center text-sm text-[#6b6862]">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading thread…
              </span>
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              mode={mode}
              isAvailable={mode === 'online' ? onlineAvailable : localAvailable}
              hasGeminiKey={hasGeminiKey}
              onOpenKeyModal={() => setShowKeyModal(true)}
              onPick={send}
            />
          ) : (
            messages.map((m, i) => (
              <Bubble
                key={i}
                index={i}
                msg={m}
                streaming={streaming && i === messages.length - 1}
                onRate={(r) => m.id && handleRate(i, m.id, r)}
                lang={language}
              />
            ))
          )}
        </div>

        <Composer
          value={input}
          mode={mode}
          onChange={setInput}
          onSend={() => send(input)}
          onStop={stop}
          streaming={streaming}
          disabled={!user}
          placeholder={t('askPlaceholder', language)}
        />

        {showKeyModal && (
          <GeminiKeyModal
            onClose={() => setShowKeyModal(false)}
            onSaved={() => {
              setShowKeyModal(false)
              refreshLlm()
            }}
          />
        )}
      </div>
    </div>
  )
}

function ChatHeader({
  llm,
  mode,
  onModeChange,
  onOpenKeyModal,
}: {
  llm: LlmStatus | null
  mode: 'local' | 'online'
  onModeChange: (m: 'local' | 'online') => void
  onOpenKeyModal: () => void
}) {
  const localOnline = !!llm?.local?.online
  const onlineReady = !!llm?.online_api?.online
  const hasKey = !!llm?.online_api?.has_key

  return (
    <header className="border-b border-[#e6e3dc] pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#6b6862]">Ask AI</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#1d1d1b] sm:text-3xl">
            Chat with your <span className="font-serif font-normal italic">knowledge base</span>
          </h1>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-[#6b6862]">
            Answers are grounded in your uploaded documents, with sources cited.
          </p>
        </div>

        {/* Local vs Online Switch */}
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <div className="inline-flex items-center rounded-2xl border border-[#d8d5cc] bg-[#f2efe9] p-1 shadow-inner">
            <button
              type="button"
              onClick={() => onModeChange('local')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                mode === 'local'
                  ? 'bg-[#1d1d1b] text-white shadow-sm'
                  : 'text-[#6b6862] hover:text-[#1d1d1b]'
              }`}
            >
              <Laptop className="size-3.5" />
              <span>Locally</span>
              <span
                className={`size-1.5 rounded-full ${
                  localOnline ? 'bg-[#4a8a5c]' : 'bg-[#b9b6ae]'
                }`}
                title={localOnline ? 'Ollama running' : 'Ollama offline'}
              />
            </button>
            <button
              type="button"
              onClick={() => onModeChange('online')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                mode === 'online'
                  ? 'bg-[#1d1d1b] text-white shadow-sm'
                  : 'text-[#6b6862] hover:text-[#1d1d1b]'
              }`}
            >
              <Globe className="size-3.5" />
              <span>Online (Gemini)</span>
              <span
                className={`size-1.5 rounded-full ${
                  onlineReady ? 'bg-[#4a8a5c]' : hasKey ? 'bg-amber-400' : 'bg-[#b9b6ae]'
                }`}
                title={onlineReady ? 'Gemini ready' : 'Gemini key needed'}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#6b6862]">
            {mode === 'online' ? (
              hasKey ? (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[#3f6b45]">
                    <Check className="size-3" /> Gemini ready ({llm?.online_api?.model || 'active'})
                  </span>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={onOpenKeyModal}
                    className="underline hover:text-[#1d1d1b]"
                  >
                    Change key
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenKeyModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2d5bc] bg-[#fbf6ea] px-2 py-0.5 text-[11px] font-medium text-[#876527] hover:bg-[#f6eed8]"
                >
                  <KeyRound className="size-3" />
                  Attach Gemini key
                </button>
              )
            ) : (
              <span>
                {localOnline
                  ? `Ollama local (${llm?.local?.model || 'active'})`
                  : 'Ollama offline (start via ollama serve)'}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function EmptyState({
  mode,
  isAvailable,
  hasGeminiKey,
  onOpenKeyModal,
  onPick,
}: {
  mode: 'local' | 'online'
  isAvailable: boolean
  hasGeminiKey: boolean
  onOpenKeyModal: () => void
  onPick: (q: string) => void
}) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f4f2ec]">
          {mode === 'online' ? (
            <Globe className="size-6 text-[#20211f]" aria-hidden />
          ) : (
            <Sparkles className="size-6 text-[#20211f]" aria-hidden />
          )}
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#1d1d1b]">
          Ask anything about your documents
        </h2>

        {mode === 'online' && !hasGeminiKey ? (
          <div className="mt-3 rounded-2xl border border-[#e6dccb] bg-[#fdfaf3] p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#876527]">
              Gemini API Key Required
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#6b6862]">
              Attach your Google Gemini key once to enable real-time questions over your documents.
            </p>
            <button
              type="button"
              onClick={onOpenKeyModal}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#1d1d1b] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#3c3b37]"
            >
              <KeyRound className="size-3.5" /> Attach Gemini Key
            </button>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-[#6b6862]">
            {isAvailable
              ? `Ready using ${mode === 'online' ? 'Gemini (Online)' : 'Ollama (Local)'}. Try one of these:`
              : mode === 'online'
              ? 'Checking Gemini connectivity…'
              : 'The local Ollama model is offline right now. Switch to "Online (Gemini)" or start `ollama serve`.'}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => onPick(ex)}
              className="rounded-2xl border border-[#dcdad3] bg-[#fffdfa] px-4 py-3 text-left text-sm text-[#4f4d47] transition hover:border-[#c9c6bd] hover:bg-white"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Bubble({
  index,
  msg,
  streaming,
  onRate,
  lang,
}: {
  index: number
  msg: Message
  streaming: boolean
  onRate?: (rating: 1 | -1) => void
  lang?: 'en' | 'ur'
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-[#1d1d1b] px-4 py-3 text-sm leading-relaxed text-white">
          {msg.content}
        </div>
        <span className="mt-1 px-2 text-[10px] text-[#8c8a83]">
          {msg.mode === 'online' ? '🌐 via Gemini' : '💻 via Local Ollama'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        {msg.content || streaming ? (
          <div
            className={`rounded-3xl rounded-bl-lg border px-4 py-3 text-sm leading-relaxed ${
              msg.error
                ? 'border-[#f0c8c0] bg-[#fbe4e0] text-[#9a3b2c]'
                : 'border-[#dcdad3] bg-[#fffdfa] text-[#20211f]'
            }`}
          >
            {msg.content ? (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            ) : streaming ? (
              <span className="inline-flex items-center gap-2 text-[#6b6862]">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking…
              </span>
            ) : null}
          </div>
        ) : null}

        {msg.flag ? <FlagBanner flag={msg.flag} /> : null}
        {msg.workflow ? <WorkflowCard wf={msg.workflow} /> : null}

        {/* Sources & Rating footer */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {msg.sources && msg.sources.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#6b6862]">
                {t('sources', lang)}
              </span>
              {msg.sources.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-[#f4f2ec] px-2 py-0.5 text-[11px] text-[#65645f]"
                >
                  <FileText className="size-3" aria-hidden /> {s}
                </span>
              ))}
            </div>
          ) : (
            <div />
          )}

          {/* Rating Buttons */}
          {msg.id && !streaming && onRate && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onRate(1)}
                title={t('helpful', lang)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition ${
                  msg.rating === 1
                    ? 'bg-[#dcebdd] font-medium text-[#2f5b36]'
                    : 'text-[#8c8a83] hover:bg-[#f2efe9] hover:text-[#1d1d1b]'
                }`}
              >
                <ThumbsUp className="size-3" />
                <span>{t('helpful', lang)}</span>
              </button>
              <button
                type="button"
                onClick={() => onRate(-1)}
                title={t('notHelpful', lang)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition ${
                  msg.rating === -1
                    ? 'bg-[#fbe4e0] font-medium text-[#9a3b2c]'
                    : 'text-[#8c8a83] hover:bg-[#f2efe9] hover:text-[#1d1d1b]'
                }`}
              >
                <ThumbsDown className="size-3" />
                <span>{t('notHelpful', lang)}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FlagBanner({ flag }: { flag: { message: string; categories: string[] } }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-2xl border border-[#f0d7a8] bg-[#fdf6e6] px-3.5 py-2.5 text-xs text-[#8a6516]">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{flag.message}</p>
        {flag.categories.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {flag.categories.map((c) => (
              <span
                key={c}
                className="rounded-full bg-[#f6e9c9] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#8a6516]"
              >
                {c.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function WorkflowCard({ wf }: { wf: WorkflowResult }) {
  if (wf.status === 'error') {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-2xl border border-[#f0c8c0] bg-[#fbe4e0] px-3.5 py-2.5 text-xs text-[#9a3b2c]">
        <X className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{wf.message || 'The assistant could not complete that action.'}</p>
      </div>
    )
  }
  if (wf.action === 'leave_request') return <LeaveFormCard wf={wf} />
  if (wf.action === 'schedule_meeting') return <MeetingCard wf={wf} />
  return (
    <div className="mt-2 rounded-2xl border border-[#cfe0d0] bg-[#f1f7f0] px-3.5 py-2.5 text-xs text-[#2f5b36]">
      {wf.message}
    </div>
  )
}

function LeaveFormCard({ wf }: { wf: WorkflowResult }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onDownload() {
    if (!wf.download_url) return
    setBusy(true)
    setErr('')
    try {
      await downloadGeneratedForm(wf.download_url, wf.filename)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 rounded-2xl border border-[#cfe0d0] bg-[#f1f7f0] p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#dcebdd] text-[#2f5b36]">
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#20211f]">Leave application ready</p>
          <p className="mt-0.5 text-xs text-[#5c6b5e]">
            {wf.message}
            {wf.leave_date ? ` (${wf.leave_date})` : ''}
          </p>
          <button
            type="button"
            onClick={onDownload}
            disabled={busy || !wf.download_url}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[#2f5b36] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#274b2d] disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {busy ? 'Preparing…' : 'Download .docx'}
          </button>
          {err ? <p className="mt-1.5 text-[11px] text-[#9a3b2c]">{err}</p> : null}
        </div>
      </div>
    </div>
  )
}

function MeetingCard({ wf }: { wf: WorkflowResult }) {
  const booked = wf.status === 'ok' && wf.calendar?.status === 'created'
  const emailSent = wf.email?.status === 'sent'
  return (
    <div className="mt-2 rounded-2xl border border-[#cdd8ea] bg-[#f0f4fb] p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#dbe4f5] text-[#2f4a7a]">
          <CalendarCheck className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#20211f]">{wf.title || 'Meeting'}</p>
          <p className="mt-0.5 text-xs text-[#55617a]">{wf.message}</p>
          {wf.when ? (
            <p className="mt-1 text-xs text-[#55617a]">
              <span className="font-medium text-[#2f4a7a]">When:</span> {wf.when}
            </p>
          ) : null}
          {wf.participants && wf.participants.length > 0 ? (
            <p className="mt-0.5 text-xs text-[#55617a]">
              <span className="font-medium text-[#2f4a7a]">With:</span> {wf.participants.join(', ')}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill ok={!!booked} okText="Added to calendar" offText="Calendar sync simulated" />
            <StatusPill ok={!!emailSent} okText="Confirmation emailed" offText="Email not sent" mail />
          </div>
          {booked && wf.calendar?.html_link ? (
            <a
              href={wf.calendar.html_link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-[#2f4a7a] underline hover:text-[#20335c]"
            >
              Open in Google Calendar
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatusPill({
  ok,
  okText,
  offText,
  mail,
}: {
  ok: boolean
  okText: string
  offText: string
  mail?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        ok ? 'bg-[#dcebdd] text-[#2f5b36]' : 'bg-[#eceadf] text-[#6b6862]'
      }`}
    >
      {mail ? (
        <Mail className="size-3" aria-hidden />
      ) : ok ? (
        <Check className="size-3" aria-hidden />
      ) : null}
      {ok ? okText : offText}
    </span>
  )
}

function Composer({
  value,
  mode,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder,
}: {
  value: string
  mode: 'local' | 'online'
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  disabled: boolean
  placeholder?: string
}) {
  return (
    <div className="mt-4 border-t border-[#e6e3dc] pt-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
        className="flex items-end gap-2 rounded-3xl border border-[#dcdad3] bg-[#fffdfa] p-2 focus-within:border-[#c9c6bd]"
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={placeholder || (mode === 'online' ? 'Ask anything using online Gemini model…' : 'Ask anything using local Ollama model…')}
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[#1d1d1b] outline-none placeholder:text-[#6b6862]"
          aria-label="Your question"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#efece6] text-[#4f4d47] transition hover:bg-[#e6e3dc]"
            aria-label="Stop generating"
          >
            <Square className="size-4" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#1d1d1b] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        )}
      </form>
      <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-[#6b6862]">
        <span>Enter to send · Shift+Enter for new line</span>
        <span className="font-mono text-[10px]">
          Target: {mode === 'online' ? 'Gemini API' : 'Local Ollama'}
        </span>
      </div>
    </div>
  )
}

function GeminiKeyModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [key, setKey] = useState('')
  const [model, setModel] = useState('gemini-2.5-flash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim()) {
      setError('Please provide a Gemini API key.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await settingsApi.updateLlmConfig({
        provider: 'gemini',
        api_key: key.trim(),
        chat_model: model,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Gemini key.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e6e3dc] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-[#e8f2e8] text-[#3f6b45]">
              <Globe className="size-4" />
            </span>
            <h2 className="text-base font-semibold text-[#1d1d1b]">Configure Gemini API</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#6b6862] hover:bg-[#f2efe9]"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6b6862]">Gemini API Key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste AI Studio key (e.g. AIzaSy...)"
              className="mt-1 h-11 w-full rounded-xl border border-[#d8d5cc] bg-white px-3 text-sm outline-none focus:border-[#1d1d1b]"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-[#6b6862]">
              Get a key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[#1d1d1b]"
              >
                Google AI Studio
              </a>
              . Only one API key is needed.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6b6862]">Gemini Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[#d8d5cc] bg-white px-3 text-sm outline-none focus:border-[#1d1d1b]"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Fastest / Ultra-low latency)</option>
            </select>
          </div>

          {error && (
            <p className="rounded-xl bg-[#fbe4e0] px-3 py-2 text-xs text-[#9a3b2c]">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#dcdad3] px-4 py-2 text-xs font-medium text-[#6b6862] hover:bg-[#f2efe9]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1b] px-4 py-2 text-xs font-medium text-white hover:bg-[#3c3b37] disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save & Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
