'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import {
  ArrowUp,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Copy,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  Download,
  FileText,
  Globe,
  History,
  Laptop,
  Loader2,
  Mail,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  Server,
  ShieldAlert,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  askStream,
  artifactDownloadUrl,
  artifactsApi,
  chatApi,
  docgenApi,
  downloadGeneratedForm,
  workApi,
  type ChatMode,
  type Conversation,
  type Artifact,
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
  mode?: ChatMode
  flag?: { message: string; categories: string[] }
  workflow?: WorkflowResult
  artifacts?: Artifact[]
  missingFields?: string[]
  question?: string
}

function modeLabel(mode?: ChatMode): string {
  if (mode === 'online') return 'AWS Bedrock'
  if (mode === 'gemini') return 'Google Gemini'
  if (mode === 'selfhosted') return 'Self-Hosted EC2'
  return 'Local Ollama'
}

const EXAMPLES = [
  'Summarise our key documents in a few bullet points.',
  'What information is available in the uploaded files?',
  'What are the key technical or business takeaways?',
]

const DOCUMENT_EXAMPLES = [
  { label: 'Expense claim', prompt: 'Give me an expense claim form.' },
  { label: 'Leave request', prompt: 'Give me a leave request form.' },
  { label: 'IT access request', prompt: 'Give me an IT access request form.' },
]

export default function WorkspaceChatPage() {
  const { user, language } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [llm, setLlm] = useState<LlmStatus | null>(null)
  const [mode, setMode] = useState<ChatMode>('local')
  const [modeInit, setModeInit] = useState(false)

  // Chat conversation history state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loadingConv, setLoadingConv] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // History is a drawer on phones; start collapsed so the chat is readable.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setSidebarOpen(false)
    }
  }, [])

  const refreshLlm = useCallback(() => {
    workApi.llmStatus().then((status) => {
      setLlm(status)
      if (!modeInit && status) {
        setModeInit(true)
        if (status.provider === 'bedrock' && status.online_api?.online) setMode('online')
        else if (status.provider === 'gemini' && status.gemini?.online) setMode('gemini')
        else if (status.provider === 'selfhosted' && status.selfhosted?.online) setMode('selfhosted')
        else if (status.local?.online) setMode('local')
        else if (status.online_api?.online) setMode('online')
        else if (status.gemini?.online) setMode('gemini')
        else if (status.selfhosted?.online) setMode('selfhosted')
      }
    }).catch(() => setLlm(null))
  }, [modeInit])

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

  const onlineAvailable =
    llm?.online_api?.provider === 'bedrock' && !!llm.online_api.online
  const localAvailable = llm?.local?.provider === 'ollama' && !!llm.local.online
  const geminiAvailable = !!llm?.gemini?.online
  const selfhostedAvailable = !!llm?.selfhosted?.online

  const isModeAvailable = useCallback(
    (m: ChatMode) => {
      if (m === 'online') return onlineAvailable
      if (m === 'gemini') return geminiAvailable
      if (m === 'selfhosted') return selfhostedAvailable
      return localAvailable
    },
    [onlineAvailable, geminiAvailable, selfhostedAvailable, localAvailable],
  )

  const selectConversation = useCallback(
    async (id: number) => {
      if (streaming) return
      setCurrentConversationId(id)
      if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false)
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
      if (!isModeAvailable(mode)) {
        toast.error(`${modeLabel(mode)} is not connected or reachable. Check AI settings or switch models.`)
        return
      }
      setInput('')
      setStreaming(true)

      setMessages((m) => [
        ...m,
        { role: 'user', content: q, mode },
        { role: 'assistant', content: '', mode, question: q },
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
              else if (e.type === 'artifact') {
                updated.artifacts = [...(updated.artifacts || []), e.artifact]
                // Artifact-only answers have no token stream: show the finished
                // document as the message so copy/download works immediately.
                if (!updated.content) updated.content = e.artifact.content_md
                else if (updated.artifacts.length > 1)
                  updated.content += '\n\n---\n\n' + e.artifact.content_md
              } else if (e.type === 'missing_fields')
                updated.missingFields = e.fields
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
    [streaming, mode, currentConversationId, loadConversations, isModeAvailable],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  return (
    <div className="relative flex h-[calc(100dvh-13rem)] min-h-0 overflow-hidden rounded-[28px] border border-[#e6e3dc] bg-[#fffdfa] shadow-sm lg:h-[calc(100dvh-5rem)] lg:min-h-[34rem]">
      <HistorySidebar
        open={sidebarOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        currentId={currentConversationId}
        streaming={streaming}
        onNewChat={handleNewChat}
        onSelect={selectConversation}
        onDelete={handleDeleteConversation}
        lang={language}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#fffdfa]">
        <ChatHeader
          llm={llm}
          mode={mode}
          onModeChange={setMode}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
            {loadingConv ? (
              <div className="grid h-full place-items-center text-sm text-[#6b6862]">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Loading thread…
                </span>
              </div>
            ) : messages.length === 0 ? (
              <EmptyState
                mode={mode}
                isAvailable={isModeAvailable(mode)}
                onPick={send}
              />
            ) : (
              <div className="space-y-5 pb-2">
                {messages.map((m, i) => (
                  <Bubble
                    key={i}
                    index={i}
                    msg={m}
                    streaming={streaming && i === messages.length - 1}
                    documentRequest={m.role === 'user' && !!messages[i + 1]?.artifacts?.length}
                    onRate={(r) => m.id && handleRate(i, m.id, r)}
                    lang={language}
                  />
                ))}
              </div>
            )}
          </div>
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
      </div>
    </div>
  )
}

function HistorySidebar({
  open,
  onOpen,
  onClose,
  conversations,
  currentId,
  streaming,
  onNewChat,
  onSelect,
  onDelete,
  lang,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  conversations: Conversation[]
  currentId: number | null
  streaming: boolean
  onNewChat: () => void
  onSelect: (id: number) => void
  onDelete: (id: number, e: React.MouseEvent) => void
  lang: 'en' | 'ur'
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close conversation history"
          onClick={onClose}
          className="absolute inset-0 z-30 bg-[#1d1d1b]/20 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <aside
        className={`z-40 flex shrink-0 flex-col border-r border-[#e6e3dc] bg-[#f4f2ec] transition-[width] duration-200 ${
          open ? 'flex w-72' : 'hidden lg:flex lg:w-14'
        } max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:w-[min(19rem,86vw)] max-lg:shadow-2xl`}
      >
        {open ? (
          <>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b6862]">
                <History className="size-3.5" />
                {t('history', lang)}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="grid size-8 place-items-center rounded-xl text-[#6b6862] transition hover:bg-[#ece8df] hover:text-[#1d1d1b]"
                title="Collapse history"
                aria-label="Collapse conversation history"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </div>

            <div className="px-3">
              <button
                type="button"
                onClick={() => {
                  onNewChat()
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) onClose()
                }}
                disabled={streaming}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-3 py-2.5 text-xs font-medium text-white transition hover:bg-[#3c3b37] disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                {t('newChat', lang)}
              </button>
            </div>

            <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
              {conversations.length === 0 ? (
                <p className="mt-8 px-3 text-center text-xs leading-relaxed text-[#8c8a83]">
                  No past conversations yet.
                  <br />
                  Ask a question or create a document.
                </p>
              ) : (
                conversations.map((c) => {
                  const isSelected = c.id === currentId
                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelect(c.id)}
                      className={`group flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition ${
                        isSelected
                          ? 'bg-[#1d1d1b] font-medium text-white'
                          : 'text-[#4f4d47] hover:bg-[#ece8df]'
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
                        onClick={(e) => onDelete(c.id, e)}
                        className={`rounded p-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100 ${
                          isSelected
                            ? 'text-white/80 hover:bg-white/10 hover:text-white'
                            : 'text-[#9a3b2c] hover:bg-[#fbe4e0]'
                        }`}
                        title="Delete thread"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t border-[#e6e3dc] px-3 py-3 text-[10px] leading-relaxed text-[#8c8a83]">
              History is private to your account and company.
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <button
              type="button"
              onClick={() => {
                onNewChat()
                onOpen()
              }}
              disabled={streaming}
              className="grid size-9 place-items-center rounded-xl bg-[#1d1d1b] text-white transition hover:bg-[#3c3b37] disabled:opacity-50"
              title={t('newChat', lang)}
              aria-label={t('newChat', lang)}
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="grid size-9 place-items-center rounded-xl text-[#6b6862] transition hover:bg-[#ece8df] hover:text-[#1d1d1b]"
              title="Open conversation history"
              aria-label="Open conversation history"
            >
              <PanelLeftOpen className="size-4" />
            </button>
            <span className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#a29e94] [writing-mode:vertical-rl]">
              {t('history', lang)}
            </span>
          </div>
        )}
      </aside>
    </>
  )
}

function ChatHeader({
  llm,
  mode,
  onModeChange,
  sidebarOpen,
  onOpenSidebar,
}: {
  llm: LlmStatus | null
  mode: ChatMode
  onModeChange: (m: ChatMode) => void
  sidebarOpen: boolean
  onOpenSidebar: () => void
}) {
  const localOnline = !!llm?.local?.online
  const onlineReady = llm?.online_api?.provider === 'bedrock' && !!llm.online_api.online
  const geminiReady = !!llm?.gemini?.online
  const selfhostedReady = !!llm?.selfhosted?.online

  const options: { id: ChatMode; label: string; ready: boolean; icon: typeof Laptop; model?: string }[] = [
    { id: 'local', label: 'Local (Ollama)', ready: localOnline, icon: Laptop, model: llm?.local?.model },
    { id: 'online', label: 'Bedrock (AWS)', ready: onlineReady, icon: Globe, model: llm?.online_api?.model },
    { id: 'gemini', label: 'Gemini', ready: geminiReady, icon: Sparkles, model: llm?.gemini?.model },
    { id: 'selfhosted', label: 'Self-Hosted EC2', ready: selfhostedReady, icon: Server, model: llm?.selfhosted?.model },
  ]
  const currentOpt = options.find((o) => o.id === mode) || options[0]
  const CurrentIcon = currentOpt.icon

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#e6e3dc] px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {!sidebarOpen ? (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="hidden size-8 shrink-0 place-items-center rounded-xl text-[#6b6862] transition hover:bg-[#f2efe9] hover:text-[#1d1d1b] lg:grid"
            title="Open conversation history"
            aria-label="Open conversation history"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="grid size-8 shrink-0 place-items-center rounded-xl text-[#6b6862] transition hover:bg-[#f2efe9] hover:text-[#1d1d1b] lg:hidden"
          title="Open conversation history"
          aria-label="Open conversation history"
        >
          <History className="size-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-[#1d1d1b]">
            Ask AI
          </h1>
          <p className="hidden truncate text-[11px] text-[#6b6862] sm:block">
            Grounded in your documents · sources cited
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${currentOpt.ready ? 'bg-[#4a8a5c]' : 'bg-[#b9b6ae]'}`}
          title={currentOpt.ready ? `${currentOpt.label} ready` : `${currentOpt.label} offline`}
        />
        <label className="relative min-w-0">
          <span className="sr-only">AI model</span>
          <CurrentIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#6b6862]" />
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as ChatMode)}
            title={currentOpt.model ? `${currentOpt.label} · ${currentOpt.model}` : currentOpt.label}
            className="max-w-[11.5rem] appearance-none truncate rounded-full border border-[#d8d5cc] bg-[#f4f2ec] py-1.5 pl-8 pr-8 text-[11px] font-medium text-[#1d1d1b] outline-none transition hover:border-[#c9c6bd] focus:border-[#1d1d1b] sm:max-w-[15rem]"
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id} disabled={!opt.ready && opt.id !== mode}>
                {opt.label}
                {opt.ready ? '' : ' · offline'}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#6b6862]" />
        </label>
      </div>
    </header>
  )
}

function EmptyState({
  mode,
  isAvailable,
  onPick,
}: {
  mode: ChatMode
  isAvailable: boolean
  onPick: (q: string) => void
}) {
  return (
    <div className="grid h-full place-items-center py-6 text-center">
      <div className="w-full max-w-2xl">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-[#f4f2ec]">
          {mode === 'online' ? (
            <Globe className="size-5 text-[#20211f]" aria-hidden />
          ) : mode === 'selfhosted' ? (
            <Server className="size-5 text-[#20211f]" aria-hidden />
          ) : (
            <Sparkles className="size-5 text-[#20211f]" aria-hidden />
          )}
        </span>
        <h2 className="mt-3 text-lg font-semibold text-[#1d1d1b]">
          Ask your documents, or create one
        </h2>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#6b6862]">
          {isAvailable
            ? `Answers use ${modeLabel(mode)} and cite your files. Documents use your profile and details in the request; missing fields are asked.`
            : `${modeLabel(mode)} is not configured or reachable right now.`}
        </p>

        <div className="mt-6 text-left">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
            Create a document
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {DOCUMENT_EXAMPLES.map((doc) => (
              <button
                key={doc.label}
                type="button"
                onClick={() => onPick(doc.prompt)}
                className="group flex items-center gap-2.5 rounded-2xl border border-[#dcdad3] bg-white px-3.5 py-3 text-left transition hover:border-[#1d1d1b] hover:shadow-sm"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#f4f2ec] text-[#4f4d47] transition group-hover:bg-[#1d1d1b] group-hover:text-white">
                  <FileText className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-[#1d1d1b]">{doc.label}</span>
                  <span className="block text-[10px] text-[#8c8a83]">Auto-filled form</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 text-left">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
            Or ask a question
          </p>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onPick(ex)}
                className="rounded-xl border border-[#e6e3dc] bg-[#fffdfa] px-3.5 py-2.5 text-left text-xs text-[#4f4d47] transition hover:border-[#c9c6bd] hover:bg-white"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function plainText(md: string): string {
  return md
    .replace(/<<<INTENT_JSON>>>[\s\S]*?<<<END_INTENT_JSON>>>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/^\s*\|/gm, '')
    .replace(/^\s*_{1,2}(.*?)_{1,2}\s*$/gm, '$1')
    .trim()
}

function FormattedMessage({
  content,
  onNode,
}: {
  content: string
  onNode?: (el: HTMLDivElement | null) => void
}) {
  // remark-gfm renders tables/lists/headings; rehype-sanitize strips any raw
  // HTML that a template or an LLM answer might contain before it reaches the
  // DOM. No Markdown symbols are ever shown to the user.
  return (
    <div ref={onNode} className="ov-md text-sm text-[#20211f]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

type FieldInput = {
  raw: string
  label: string
  type: 'text' | 'date' | 'time' | 'number' | 'email' | 'tel' | 'textarea' | 'select'
  options?: string[]
  placeholder?: string
  hint?: string
}

function fieldInput(raw: string): FieldInput {
  const stripped = raw.replace(/^\[|\]$/g, '').trim()
  const key = stripped.toLowerCase().replace(/\s+/g, ' ')
  let label = stripped.split(',')[0].replace(/^e\.g\.,?\s*/i, '').trim()
  if (!label || /^(yyyy[- ]?mm[- ]?dd|\d{1,2}:\d{2}\s*(am|pm))$/i.test(label)) {
    label = /time|am|pm/i.test(label) ? 'Time' : 'Date'
  }
  label = label.replace(/\b(yyyy[- ]?mm[- ]?dd|hh:mm|am|pm)\b/gi, '').trim() || 'Detail'
  label = label.charAt(0).toUpperCase() + label.slice(1)

  if (/currency/.test(key)) {
    return {
      raw, label: 'Currency', type: 'select',
      options: ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'Other'],
    }
  }
  if (/receipt/.test(key)) {
    return { raw, label: 'Receipt attached', type: 'select', options: ['Yes', 'No'] }
  }
  if (/expense category|category/.test(key)) {
    return {
      raw, label: 'Expense category', type: 'select',
      options: ['Travel', 'Meals', 'Accommodation', 'Office supplies', 'Software', 'Training', 'Other'],
    }
  }
  if (/leave type/.test(key) || /full day.*half day/.test(key)) {
    return {
      raw, label: 'Leave type', type: 'select',
      options: ['Full-day', 'Half-day (first half)', 'Half-day (second half)', 'Sick', 'Casual / annual', 'Other'],
    }
  }
  if (/start date|end date|date/.test(key)) {
    return { raw, label, type: 'date', hint: 'YYYY-MM-DD' }
  }
  if (/time/.test(key) || /\b(am|pm)\b/.test(key)) {
    return { raw, label, type: 'time', hint: 'HH:MM' }
  }
  if (/amount|total|cost|salary/.test(key)) {
    return { raw, label, type: 'number', placeholder: '0.00' }
  }
  if (/email/.test(key)) return { raw, label, type: 'email', placeholder: 'name@company.com' }
  if (/phone|mobile|contact number/.test(key)) {
    return { raw, label, type: 'tel', placeholder: '+92 300 0000000' }
  }
  if (/reason|description|justification|notes|handover|urgent|brief|purpose/.test(key)) {
    return { raw, label, type: 'textarea', placeholder: 'Add a short, factual explanation' }
  }
  return { raw, label, type: 'text' }
}

function prettyFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, 'ID')
    .replace(/\bHr\b/g, 'HR')
    .replace(/\bUrl\b/g, 'URL')
}

function ArtifactCard({ a }: { a: Artifact }) {
  const s = a.structured || {}
  const hasStructured = !!s.sections?.length || !!s.table?.length
  const [view, setView] = useState<'form' | 'text'>(hasStructured ? 'form' : 'text')
  const [busy, setBusy] = useState<'docx' | 'pdf' | null>(null)
  const missing = a.missing_fields?.length || 0
  const filled = (a.filled_fields || []).map(prettyFieldName)

  async function download(fmt: 'docx' | 'pdf') {
    const url = a.downloads?.[fmt] || artifactDownloadUrl(a.id, fmt)
    try {
      setBusy(fmt)
      await downloadGeneratedForm(url, `${a.title || 'document'}.${fmt}`)
    } catch {
      toast.error('Could not prepare the download.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#d9e5d9] bg-white shadow-sm">
      <div className="flex items-start gap-3 bg-[#e8f2e8] px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#dcebdd] text-[#2f5b36]">
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-[#20211f]" title={a.title}>
              {a.title || 'Generated document'}
            </p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#5c6b5e] ring-1 ring-[#cfe0d0]">
              {a.kind}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#5c6b5e]">
            {missing > 0 ? `${missing} detail${missing === 1 ? '' : 's'} still needed` : 'Ready to download'}
          </p>
          {filled.length > 0 ? (
            <p className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-[#5c6b5e]">
              <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-[#3f6b45]" aria-hidden />
              <span>Already filled: {filled.slice(0, 6).join(', ')}{filled.length > 6 ? '…' : ''}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => download('docx')}
            className="inline-flex items-center gap-1 rounded-lg border border-[#cfe0d0] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#2f5b36] transition hover:bg-[#f1f7f0] disabled:opacity-50"
          >
            {busy === 'docx' ? <Loader2 className="size-3 animate-spin" /> : <FileDown className="size-3" />}
            DOCX
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => download('pdf')}
            className="inline-flex items-center gap-1 rounded-lg border border-[#cfe0d0] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#2f5b36] transition hover:bg-[#f1f7f0] disabled:opacity-50"
          >
            {busy === 'pdf' ? <Loader2 className="size-3 animate-spin" /> : <FileSpreadsheet className="size-3" />}
            PDF
          </button>
        </div>
      </div>

      <div className="border-t border-[#e6efe5] px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-[#f2efe9] p-0.5">
            {hasStructured ? (
              <button
                type="button"
                onClick={() => setView('form')}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                  view === 'form' ? 'bg-white text-[#1d1d1b] shadow-sm' : 'text-[#6b6862]'
                }`}
              >
                Form view
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setView('text')}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                view === 'text' ? 'bg-white text-[#1d1d1b] shadow-sm' : 'text-[#6b6862]'
              }`}
            >
              Text view
            </button>
          </div>
          <span className="text-[10px] text-[#8c8a83]">
            {a.kind === 'email' ? 'Email draft' : 'Preview before download'}
          </span>
        </div>

        {view === 'form' && hasStructured ? (
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {s.table?.length ? (
              <table className="w-full text-left text-xs">
                <tbody>
                  {s.table.map((row, i) => (
                    <tr key={i} className="border-b border-[#f0ede6] last:border-0">
                      {row.map((cell, j) =>
                        i === 0 ? (
                          <th key={j} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#6b6862]">{cell}</th>
                        ) : (
                          <td key={j} className="px-2 py-1.5 text-[#20211f]">{cell}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {s.sections?.map((sec, i) => (
              <div key={i} className="rounded-xl border border-[#f0ede6] bg-[#fffdfa] px-3 py-2.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6862]">
                  {sec.heading}
                </h4>
                <dl className="mt-1.5 space-y-1">
                  {sec.fields.map((f, j) => (
                    <div key={j} className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-2 text-xs">
                      <dt className="text-[#6b6862]">{f.label}</dt>
                      <dd className={f.placeholder ? 'font-medium text-[#a66a12]' : 'text-[#20211f]'}>
                        {f.value || '—'}
                      </dd>
                    </div>
                  ))}
                  {sec.checkboxes?.map((cb, j) => (
                    <div key={`cb-${j}`} className="text-xs text-[#4f4d47]">
                      {cb.checked ? '☑' : '☐'} {cb.label}
                    </div>
                  ))}
                  {sec.lines?.map((l, j) => (
                    <p key={`l-${j}`} className="whitespace-pre-wrap text-xs text-[#4f4d47]">{l}</p>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-[#f0ede6] bg-[#fffdfa] px-3 py-2.5 pr-2">
            <FormattedMessage content={a.content_md} />
          </div>
        )}
      </div>
    </div>
  )
}

function MissingFieldsCard({
  fields,
  busy,
  onFill,
}: {
  fields: string[]
  busy: boolean
  onFill: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const defs = fields.map(fieldInput)
  const filledCount = defs.filter((f) => (values[f.raw] || '').trim()).length

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const filled: Record<string, string> = {}
        defs.forEach((f) => {
          const value = (values[f.raw] || '').trim()
          if (value) filled[f.raw] = value
        })
        onFill(filled)
      }}
      className="mt-3 rounded-2xl border border-[#f0d7a8] bg-[#fdf6e6] p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f6e9c9] text-[#8a6516]">
          <ReceiptText className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#8a6516]">Complete your document</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#8a6516]">
            We used your profile and any details in the request. Add the {defs.length} remaining detail{defs.length === 1 ? '' : 's'} below —
            nothing is invented, and anything you leave blank stays as a placeholder.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {defs.map((f) => {
          const common =
            'w-full rounded-xl border border-[#e6dcc0] bg-white px-3 py-2 text-xs text-[#20211f] outline-none transition placeholder:text-[#a9a396] focus:border-[#b8860b] focus:ring-2 focus:ring-[#f0d7a8]'
          return (
            <label
              key={f.raw}
              className={`block ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}
            >
              <span className="mb-1 block text-[11px] font-medium text-[#8a6516]">{f.label}</span>
              {f.type === 'select' ? (
                <select
                  value={values[f.raw] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.raw]: e.target.value }))}
                  className={common}
                >
                  <option value="">Select {f.label.toLowerCase()}…</option>
                  {f.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={values[f.raw] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.raw]: e.target.value }))}
                  rows={3}
                  placeholder={f.placeholder}
                  className={`${common} resize-y`}
                />
              ) : (
                <input
                  type={f.type}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  step={f.type === 'number' ? '0.01' : undefined}
                  value={values[f.raw] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.raw]: e.target.value }))}
                  placeholder={f.placeholder || f.hint}
                  className={common}
                />
              )}
              {f.hint && f.type !== 'text' ? (
                <span className="mt-1 block text-[10px] text-[#a9a396]">{f.hint}</span>
              ) : null}
            </label>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1b] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#3c3b37] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          {busy ? 'Updating…' : 'Update document'}
        </button>
        <span className="text-[10px] text-[#a9a396]">
          {filledCount}/{defs.length} added · you can come back and edit after generating
        </span>
      </div>
    </form>
  )
}

function Bubble({
  index,
  msg,
  streaming,
  documentRequest,
  onRate,
  lang,
}: {
  index: number
  msg: Message
  streaming: boolean
  documentRequest?: boolean
  onRate?: (rating: 1 | -1) => void
  lang?: 'en' | 'ur'
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [artifactId, setArtifactId] = useState<number | null>(null)
  const [localContent, setLocalContent] = useState(msg.content || '')
  const [localArtifacts, setLocalArtifacts] = useState<Artifact[]>(msg.artifacts || [])
  const [localMissing, setLocalMissing] = useState<string[]>(msg.missingFields || [])
  const [filling, setFilling] = useState(false)
  const mdRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setLocalContent(msg.content || ''), [msg.content])
  useEffect(() => setLocalArtifacts(msg.artifacts || []), [msg.artifacts])
  useEffect(() => setLocalMissing(msg.missingFields || []), [msg.missingFields])

  const content = localContent
  const artifacts = localArtifacts
  const isDocument = artifacts.length > 0
  const documentIntro = isDocument
    ? artifacts.length > 1
      ? `I've prepared ${artifacts.length} documents for you. ${localMissing.length ? 'Add the missing details below, then generate them again.' : 'Review them below and download when ready.'}`
      : `I've prepared your ${artifacts[0]?.title || 'document'}. ${localMissing.length ? 'Add the missing details below, then generate it again.' : 'Review it below and download when ready.'}`
    : ''
  const visibleContent = isDocument ? documentIntro : content
  const emailArtifact = artifacts.find((a) => a.kind === 'email')
  const isEmail =
    !!emailArtifact || /(^|\n)\*{0,2}subject:\*{0,2}\s+/i.test(content)
  const subject =
    emailArtifact?.subject ||
    content.match(/^\*{0,2}Subject:\*{0,2}\s*(.+)$/im)?.[1] ||
    ''
  const body = emailArtifact
    ? emailArtifact.content_md.replace(/^\*{0,2}Subject:.*$/im, '').trim()
    : content

  function flash(what: string) {
    setCopied(what)
    setTimeout(() => setCopied(null), 1800)
  }

  async function copyPlain() {
    await navigator.clipboard.writeText(plainText(content))
    flash('plain')
  }

  async function copyRich() {
    const html = mdRef.current?.innerHTML || ''
    const plain = plainText(content)
    try {
      if (html && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(plain)
      }
      flash('rich')
    } catch {
      await navigator.clipboard.writeText(plain)
      flash('plain')
    }
  }

  async function ensureArtifact(): Promise<number> {
    if (artifactId) return artifactId
    if (artifacts[0]) {
      setArtifactId(artifacts[0].id)
      return artifacts[0].id
    }
    const created = await artifactsApi.fromText(
      content,
      isEmail ? 'email' : 'text',
      'OpenVault answer',
    )
    setArtifactId(created.id)
    return created.id
  }

  async function download(fmt: 'docx' | 'pdf') {
    try {
      setBusy(true)
      const id = await ensureArtifact()
      await downloadGeneratedForm(
        artifactDownloadUrl(id, fmt),
        `${isEmail ? 'email' : 'document'}.${fmt}`,
      )
      flash(fmt)
    } catch {
      toast.error('Could not prepare the download.')
    } finally {
      setBusy(false)
    }
  }

  async function regenerateWithFields(values: Record<string, string>) {
    try {
      setFilling(true)
      const outputs = Array.from(new Set(artifacts.map((a) => a.kind)))
      const res = await docgenApi.generate(
        msg.question || '',
        outputs.length ? outputs : ['form', 'email'],
        values,
      )
      setLocalArtifacts(res.artifacts)
      setLocalContent(res.artifacts.map((a) => a.content_md).join('\n\n---\n\n'))
      setLocalMissing(res.missing_fields || [])
      setArtifactId(null)
      toast.success('Document updated with your details.')
    } catch {
      toast.error('Could not update the document.')
    } finally {
      setFilling(false)
    }
  }

  function openMailApp() {
    const to = ''
    const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      plainText(body),
    )}`
    window.location.href = href
  }

  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-[#1d1d1b] px-4 py-3 text-sm leading-relaxed text-white">
          {msg.content}
        </div>
        <span className="mt-1 px-2 text-[10px] text-[#8c8a83]">
          {documentRequest ? 'Document request · profile and request details' : `via ${modeLabel(msg.mode)}`}
        </span>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        {visibleContent || streaming ? (
          <div
            className={`rounded-3xl rounded-bl-lg border px-4 py-3 text-sm leading-relaxed ${
              msg.error
                ? 'border-[#f0c8c0] bg-[#fbe4e0] text-[#9a3b2c]'
                : 'border-[#dcdad3] bg-[#fffdfa] text-[#20211f]'
            }`}
          >
            {visibleContent ? (
              <FormattedMessage
                content={visibleContent}
                onNode={isDocument ? undefined : (el) => {
                  mdRef.current = el
                }}
              />
            ) : streaming ? (
              <span className="inline-flex items-center gap-2 text-[#6b6862]">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking…
              </span>
            ) : null}
          </div>
        ) : null}

        {isDocument ? (
          // Keep the full document available to the rich-copy button without
          // rendering it as a wall of text in the conversation.
          <div className="hidden" aria-hidden>
            <FormattedMessage
              content={content}
              onNode={(el) => {
                mdRef.current = el
              }}
            />
          </div>
        ) : null}

        {msg.flag ? <FlagBanner flag={msg.flag} /> : null}
        {msg.workflow ? <WorkflowCard wf={msg.workflow} /> : null}
        {artifacts.map((a) => (
          <ArtifactCard key={a.id} a={a} />
        ))}
        {localMissing.length > 0 ? (
          <MissingFieldsCard
            key={localMissing.join('|')}
            fields={localMissing}
            busy={filling}
            onFill={regenerateWithFields}
          />
        ) : null}

        {/* Sources & Actions footer */}
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

          {!isDocument && content && !streaming ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={copyRich}
                title="Copy formatted (rich) text"
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] text-[#6b6862] transition hover:border-[#dcdad3] hover:bg-[#f2efe9] hover:text-[#1d1d1b]"
              >
                {copied === 'rich' ? <Check className="size-3 text-emerald-600" /> : <ClipboardCopy className="size-3" />}
                <span>{copied === 'rich' ? 'Copied!' : 'Copy formatted'}</span>
              </button>
              <button
                type="button"
                onClick={copyPlain}
                title="Copy as plain text"
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] text-[#6b6862] transition hover:border-[#dcdad3] hover:bg-[#f2efe9] hover:text-[#1d1d1b]"
              >
                {copied === 'plain' ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span>{copied === 'plain' ? 'Copied!' : 'Copy plain'}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => download('docx')}
                title="Download as DOCX"
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] text-[#6b6862] transition hover:border-[#dcdad3] hover:bg-[#f2efe9] hover:text-[#1d1d1b] disabled:opacity-40"
              >
                <FileDown className="size-3" /> <span>DOCX</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => download('pdf')}
                title="Download as PDF"
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] text-[#6b6862] transition hover:border-[#dcdad3] hover:bg-[#f2efe9] hover:text-[#1d1d1b] disabled:opacity-40"
              >
                <FileSpreadsheet className="size-3" /> <span>PDF</span>
              </button>
              {isEmail ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(subject)
                      flash('subject')
                    }}
                    title="Copy email subject"
                    className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] text-[#6b6862] transition hover:border-[#dcdad3] hover:bg-[#f2efe9] hover:text-[#1d1d1b]"
                  >
                    {copied === 'subject' ? <Check className="size-3 text-emerald-600" /> : <Mail className="size-3" />}
                    <span>Subject</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(plainText(body))
                      flash('body')
                    }}
                    title="Copy email body"
                    className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] text-[#6b6862] transition hover:border-[#dcdad3] hover:bg-[#f2efe9] hover:text-[#1d1d1b]"
                  >
                    {copied === 'body' ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>Body</span>
                  </button>
                  <button
                    type="button"
                    onClick={openMailApp}
                    title="Open in your mail app"
                    className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] text-[#6b6862] transition hover:border-[#dcdad3] hover:bg-[#f2efe9] hover:text-[#1d1d1b]"
                  >
                    <ExternalLink className="size-3" /> <span>Mail app</span>
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {msg.id && !streaming && onRate ? (
            <div className="flex items-center gap-1 border-l border-[#e6e3dc] pl-1.5">
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
          ) : null}
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
  mode: ChatMode
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  disabled: boolean
  placeholder?: string
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  return (
    <div className="border-t border-[#e6e3dc] bg-[#fffdfa]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
        className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-2xl border border-[#dcdad3] bg-white p-1.5 shadow-sm transition focus-within:border-[#1d1d1b] focus-within:ring-2 focus-within:ring-[#1d1d1b]/5"
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          rows={2}
          disabled={disabled}
          placeholder={placeholder || 'Ask about your documents, or request a form…'}
          className="max-h-40 min-h-[3rem] flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-[#1d1d1b] outline-none placeholder:text-[#8c8a83]"
          aria-label="Your question"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#efece6] text-[#4f4d47] transition hover:bg-[#e6e3dc]"
            aria-label="Stop generating"
          >
            <Square className="size-4" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#1d1d1b] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        )}
      </form>
      <div className="mx-auto mt-2 flex w-full max-w-4xl flex-wrap items-center justify-between gap-1 px-1 text-[10px] text-[#8c8a83]">
        <span>Enter to send · Shift+Enter for a new line</span>
        <span className="inline-flex items-center gap-1">
          <span className={`size-1.5 rounded-full ${streaming ? 'animate-pulse bg-[#4a8a5c]' : 'bg-[#b9b6ae]'}`} />
          {streaming ? 'Generating…' : modeLabel(mode)}
        </span>
      </div>
    </div>
  )
}
