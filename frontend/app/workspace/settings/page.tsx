'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Sparkles,
} from 'lucide-react'
import {
  settingsApi,
  type LlmConfig,
  type LlmProvider,
  type LlmTestResult,
} from '@/lib/api'
import { useAuth } from '@/lib/auth'

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]'
const inputClass =
  'h-12 w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] px-4 text-sm text-[#1d1d1b] outline-none transition-colors placeholder:text-[#9b9890] focus:border-[#1d1d1b]'
const selectClass =
  `h-12 w-full appearance-none rounded-xl border border-[#d8d5cc] bg-[#fffdfa] pl-4 pr-10 text-sm text-[#1d1d1b] outline-none transition-colors hover:border-[#1d1d1b] focus:border-[#1d1d1b] ${focusRing}`
const primaryBtn =
  `inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-5 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`
const ghostBtn =
  `inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-5 text-sm text-[#1d1d1b] transition-colors hover:border-[#1d1d1b] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`
const label = 'mb-1.5 block text-sm font-medium text-[#1d1d1b]'

// The four backends the provider layer (backend/core/providers.py) supports.
const PROVIDERS: {
  value: LlmProvider
  label: string
  blurb: string
  keyLabel?: string
  modelHint: string
  usesBaseUrl?: boolean
}[] = [
  {
    value: 'ollama',
    label: 'Local model (Ollama)',
    blurb: 'Runs entirely on your own machine or server: no API key, fully private. Point the URL at localhost or your EC2 IP.',
    modelHint: 'e.g. qwen2.5:1.5b',
    usesBaseUrl: true,
  },
  {
    value: 'openai',
    label: 'OpenAI / OpenAI-compatible',
    blurb: 'OpenAI, or any OpenAI-compatible endpoint (vLLM, Groq, LM Studio). Paste one key to test.',
    keyLabel: 'OpenAI API key',
    modelHint: 'e.g. gpt-4o-mini',
    usesBaseUrl: true,
  },
  {
    value: 'anthropic',
    label: 'Anthropic (Claude)',
    blurb: 'Claude models. Anthropic has no embeddings API, so retrieval falls back to keyword search automatically.',
    keyLabel: 'Anthropic API key',
    modelHint: 'e.g. claude-3-5-haiku-latest',
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    blurb: 'Gemini chat and embeddings via a Google AI Studio key.',
    keyLabel: 'Gemini API key',
    modelHint: 'e.g. gemini-1.5-flash',
  },
]

export default function SettingsPage() {
  const { user } = useAuth()

  const [cfg, setCfg] = useState<LlmConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // editable form state
  const [provider, setProvider] = useState<LlmProvider>('ollama')
  const [chatModel, setChatModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [temperature, setTemperature] = useState('0.2')
  const [maxTokens, setMaxTokens] = useState('512')

  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState('')
  const [saveError, setSaveError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null)

  const hydrate = useCallback((c: LlmConfig) => {
    setCfg(c)
    setProvider(c.provider)
    setChatModel(c.chat_model)
    setBaseUrl(c.base_url)
    setTemperature(String(c.temperature))
    setMaxTokens(String(c.max_tokens))
    setApiKey('') // never returned by the API; blank means "keep existing"
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setLoadError('')
    settingsApi
      .llmConfig()
      .then(hydrate)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load AI settings.'))
      .finally(() => setLoading(false))
  }, [hydrate])

  useEffect(() => {
    load()
  }, [load])

  const active = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0]

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaveOk('')
    setSaveError('')
    setTestResult(null)
    setSaving(true)
    try {
      const updated = await settingsApi.updateLlmConfig({
        provider,
        chat_model: chatModel.trim(),
        base_url: baseUrl.trim(),
        temperature: Number(temperature) || 0,
        max_tokens: Number(maxTokens) || 0,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      })
      hydrate(updated)
      setSaveOk('Saved. New chats use these settings immediately; no restart needed.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function onTest() {
    setTestResult(null)
    setSaveError('')
    setTesting(true)
    try {
      setTestResult(await settingsApi.llmTest())
    } catch (err) {
      setTestResult({
        ok: false,
        provider,
        model: chatModel,
        detail: err instanceof Error ? err.message : 'Test failed.',
      })
    } finally {
      setTesting(false)
    }
  }

  if (!user) return null

  return (
    <div className="pb-6">
      <header className="border-b border-[#e6e3dc] pb-8">
        <p className={eyebrow}>Platform configuration</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl sm:tracking-[-0.06em]">
          AI <span className="font-serif font-normal italic">settings.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#77746c]">
          Choose the model that answers questions across the platform: run one locally with Ollama, or
          plug in an API key for OpenAI, Anthropic, or Gemini. This is the one place you put your key;
          changes take effect on the next question, with no restart.
        </p>
      </header>

      {loading ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-[#77746c]">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading settings…
        </p>
      ) : loadError ? (
        <div role="alert" className="mt-8 rounded-3xl border border-[#e6c9c1] bg-[#fbe4e0] p-10 text-center">
          <AlertCircle className="mx-auto size-6 text-[#9a3b2c]" aria-hidden />
          <p className="mt-3 text-sm font-medium text-[#9a3b2c]">{loadError}</p>
          <button type="button" onClick={load} className={`mt-5 ${ghostBtn}`}>Try again</button>
        </div>
      ) : (
        <form onSubmit={onSave} className="mt-8 max-w-2xl space-y-6">
          <div>
            <label htmlFor="provider" className={label}>Provider</label>
            <div className="relative">
              <select
                id="provider"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as LlmProvider)
                  setTestResult(null)
                }}
                className={selectClass}
              >
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8c8a83]" aria-hidden />
            </div>
            <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-[#8c8a83]">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {active.blurb}
            </p>
          </div>

          <div>
            <label htmlFor="chat-model" className={label}>Model</label>
            <input id="chat-model" value={chatModel} onChange={(e) => setChatModel(e.target.value)} placeholder={active.modelHint} className={inputClass} />
            <p className="mt-1.5 text-xs text-[#8c8a83]">Leave blank to use the provider default ({active.modelHint.replace('e.g. ', '')}).</p>
          </div>

          {active.usesBaseUrl && (
            <div>
              <label htmlFor="base-url" className={label}>
                {provider === 'ollama' ? 'Ollama URL' : 'Base URL (optional)'}
              </label>
              <input id="base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'} className={inputClass} />
            </div>
          )}

          {active.keyLabel && (
            <div>
              <label htmlFor="api-key" className={label}>{active.keyLabel}</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c8a83]" aria-hidden />
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={cfg?.has_api_key ? '•••••••• (a key is saved, type to replace)' : 'Paste your key'}
                  autoComplete="off"
                  className={`${inputClass} pl-11`}
                />
              </div>
              <p className="mt-1.5 text-xs text-[#8c8a83]">
                {cfg?.has_api_key ? 'A key is already stored. Leave blank to keep it.' : 'Stored server-side; never shown again after saving.'}
                {' '}For local testing only; in production keep keys in the backend .env.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="temperature" className={label}>Temperature</label>
              <input id="temperature" type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(e.target.value)} className={inputClass} />
              <p className="mt-1.5 text-xs text-[#8c8a83]">Lower = more grounded.</p>
            </div>
            <div>
              <label htmlFor="max-tokens" className={label}>Max answer tokens</label>
              <input id="max-tokens" type="number" step="16" min="16" max="4096" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} className={inputClass} />
              <p className="mt-1.5 text-xs text-[#8c8a83]">Caps reply length.</p>
            </div>
          </div>

          {saveError && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {saveError}
            </p>
          )}
          {saveOk && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-[#e6f1e4] px-4 py-3 text-sm text-[#3f6b4f]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {saveOk}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} aria-busy={saving} className={primaryBtn}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button type="button" onClick={onTest} disabled={testing || saving} className={ghostBtn}>
              {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlugZap className="size-4" aria-hidden />}
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          </div>

          {testResult && (
            <div
              role="status"
              className={`rounded-2xl border p-4 text-sm ${testResult.ok ? 'border-[#c9e2c4] bg-[#eef6ec] text-[#3f6b4f]' : 'border-[#e6c9c1] bg-[#fbe4e0] text-[#9a3b2c]'}`}
            >
              <p className="flex items-center gap-2 font-medium">
                {testResult.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertCircle className="size-4" aria-hidden />}
                {testResult.ok ? 'Connected' : 'Not reachable'} · {testResult.provider} / {testResult.model}
              </p>
              {testResult.ok && testResult.sample && (
                <p className="mt-1 text-[#5d5b55]">Model replied: “{testResult.sample}”</p>
              )}
              {!testResult.ok && testResult.detail && (
                <p className="mt-1 break-words">{testResult.detail}</p>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  )
}
