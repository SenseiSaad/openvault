'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, FileText, Loader2, Sparkles, Square } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { askStream, workApi, type LlmStatus } from '@/lib/api'

// A single turn in the conversation. `sources` are the document names the
// answer was grounded in; `error` marks a failed turn (shown in a red bubble).
type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  error?: boolean
}

const EXAMPLES = [
  'Summarise our key policies in a few bullet points.',
  'What does the onboarding process look like?',
  'Who should I contact about expenses?',
]

// Chat with the company knowledge base. Answers are grounded ONLY in documents
// this user may see (their company's files plus anything shared with them), and
// stream in token-by-token from POST /api/ask.
export default function WorkspaceChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [llm, setLlm] = useState<LlmStatus | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    workApi.llmStatus().then(setLlm).catch(() => setLlm(null))
  }, [])

  // Keep the newest message in view as tokens stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || streaming) return
      setInput('')
      setStreaming(true)
      // push the user turn + an empty assistant turn we'll fill as tokens arrive
      setMessages((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '' }])

      const controller = new AbortController()
      abortRef.current = controller
      try {
        await askStream(
          q,
          (e) => {
            // Pure updater: build a NEW last message rather than mutating the
            // existing one, so React's dev double-invoke can't duplicate tokens.
            setMessages((m) => {
              const last = m[m.length - 1]
              if (last?.role !== 'assistant') return m
              const updated: Message = { ...last }
              if (e.type === 'sources') updated.sources = e.sources
              else if (e.type === 'token') updated.content += e.token
              else if (e.type === 'error') {
                updated.content = e.message
                updated.error = true
              }
              return [...m.slice(0, -1), updated]
            })
          },
          controller.signal,
        )
      } catch (err) {
        if (!controller.signal.aborted) {
          setMessages((m) => {
            const last = m[m.length - 1]
            if (last?.role !== 'assistant' || last.content) return m
            return [
              ...m.slice(0, -1),
              { ...last, content: err instanceof Error ? err.message : 'Something went wrong.', error: true },
            ]
          })
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [streaming],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const online = !!llm?.online

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-3xl flex-col lg:h-[calc(100vh-5rem)]">
      <ChatHeader llm={llm} />

      <div ref={scrollRef} className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <EmptyState online={online} onPick={send} />
        ) : (
          messages.map((m, i) => <Bubble key={i} msg={m} streaming={streaming && i === messages.length - 1} />)
        )}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => send(input)}
        onStop={stop}
        streaming={streaming}
        disabled={!user}
      />
    </div>
  )
}

function ChatHeader({ llm }: { llm: LlmStatus | null }) {
  const online = !!llm?.online
  return (
    <header className="flex items-end justify-between gap-4 border-b border-[#e6e3dc] pb-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8c8a83]">Ask AI</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1d1d1b] sm:text-3xl">
          Chat with your <span className="font-serif font-normal italic">knowledge base</span>
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[#77746c]">
          Answers come only from your company&apos;s documents — with the sources cited.
        </p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium ${
          online ? 'border-[#cfe3d1] bg-[#e8f2e8] text-[#3f6b45]' : 'border-[#e6e3dc] bg-[#f2f0ec] text-[#77746c]'
        }`}
      >
        <span className={`size-1.5 rounded-full ${online ? 'bg-[#4a8a5c]' : 'bg-[#b9b6ae]'}`} aria-hidden />
        {online ? `AI online · ${llm?.model || 'model'}` : 'AI offline'}
      </span>
    </header>
  )
}

function EmptyState({ online, onPick }: { online: boolean; onPick: (q: string) => void }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f4f2ec]">
          <Sparkles className="size-6 text-[#20211f]" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#1d1d1b]">Ask anything about your documents</h2>
        <p className="mt-1.5 text-sm text-[#77746c]">
          {online
            ? 'Try one of these to get started:'
            : 'The AI model looks offline right now — you can still type a question, but it may not answer until the model is reachable.'}
        </p>
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

function Bubble({ msg, streaming }: { msg: Message; streaming: boolean }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-[#1d1d1b] px-4 py-3 text-sm leading-relaxed text-white">
          {msg.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
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
            <span className="inline-flex items-center gap-2 text-[#98958c]">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking…
            </span>
          ) : null}
        </div>
        {msg.sources && msg.sources.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#98958c]">Sources</span>
            {msg.sources.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-[#f4f2ec] px-2 py-0.5 text-[11px] text-[#65645f]"
              >
                <FileText className="size-3" aria-hidden /> {s}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  disabled: boolean
}) {
  return (
    <div className="mt-4 border-t border-[#e6e3dc] pt-4">
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
          placeholder="Ask about your company's documents…"
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[#1d1d1b] outline-none placeholder:text-[#a8a59d]"
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
      <p className="mt-2 px-2 text-[11px] text-[#a8a59d]">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  )
}
