'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Bot, Send, Loader2, RotateCcw, ChevronRight, ChevronDown, Zap, AlertTriangle, Check, Brain, BarChart3, Key } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { getPageUrl } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { GROQ_MODELS } from '@/lib/groq'
import type { GroqModelId } from '@/lib/groq'
import type { AIMessage } from '@/types'
import toast from 'react-hot-toast'
import { AiModesPanel } from './ai-modes-panel'
import { PersonalizationPanel } from './personalization-panel'
import { LearningAnalytics } from './learning-analytics'
import { ApiKeysModal } from './api-keys-modal'

const RATE_LIMIT_COOLDOWN_MS = 60_000

const TAG_STYLES: Record<string, string> = {
  Recommended: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Fast:        'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  New:         'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Reasoning:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'High RPM':  'bg-sky-500/10 text-sky-600 dark:text-sky-400',
}

const MODE_BADGE: Record<string, { label: string; color: string }> = {
  agentic: { label: '⚡ Agentic', color: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
  plan:    { label: '🗺️ Plan',    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20'     },
  explore: { label: '🔭 Explore', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
}

interface AiPanelProps {
  workspaceId: string
  width?: number
  onClose?: () => void
}

export function AiPanel({ workspaceId, width = 320, onClose }: AiPanelProps) {
  const router = useRouter()
  const {
    aiMessages, addAiMessage, clearAiMessages, setAiOpen, currentPageId, setPages,
    selectedModel, setSelectedModel, rateLimitedModels, setModelRateLimited, clearModelRateLimit,
    aiMode, userMemory, updateUserMemory,
    apiKeySource, activeUserKeyId, userApiKeys,
    incrementSessionMessages,
    personalizationOpen, setPersonalizationOpen,
    analyticsOpen, setAnalyticsOpen,
    apiKeyModalOpen, setApiKeyModalOpen,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, loading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-clear rate limits
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      Object.entries(rateLimitedModels).forEach(([id, ts]) => {
        if (now - ts > RATE_LIMIT_COOLDOWN_MS) clearModelRateLimit(id)
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [rateLimitedModels, clearModelRateLimit])

  const isRateLimited = (id: string) => !!rateLimitedModels[id]
  const getRateLimitSecondsLeft = (id: string) => {
    const ts = rateLimitedModels[id]
    if (!ts) return 0
    return Math.ceil((RATE_LIMIT_COOLDOWN_MS - (Date.now() - ts)) / 1000)
  }

  const refreshPages = async () => {
    try {
      const res = await fetch(`/api/pages?workspaceId=${workspaceId}`)
      if (res.ok) {
        const pages = await res.json()
        if (Array.isArray(pages)) setPages(pages)
      }
    } catch { /* ignore */ }
  }

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || input).trim()
    if (!text || loading) return

    let modelToUse = selectedModel
    if (isRateLimited(selectedModel)) {
      const fallback = GROQ_MODELS.find((m) => !isRateLimited(m.id))
      if (fallback) {
        setSelectedModel(fallback.id as GroqModelId)
        modelToUse = fallback.id as GroqModelId
        toast(`Switched to ${fallback.name}`, { icon: '🔄' })
      } else {
        toast.error('All models rate-limited. Please wait.')
        return
      }
    }

    const userMsg: AIMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      mode: aiMode,
    }
    addAiMessage(userMsg)
    setInput('')
    setLoading(true)
    incrementSessionMessages()

    try {
      // Determine endpoint based on mode
      const endpoint = aiMode === 'chat' ? '/api/ai' : '/api/ai-modes'

      // Get user API key if set
      let userKeyValue: string | null = null
      if (apiKeySource === 'user' && activeUserKeyId) {
        userKeyValue = sessionStorage.getItem(`apikey_${activeUserKeyId}`)
      }

      const body: Record<string, unknown> = {
        messages: [...aiMessages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        workspaceId,
        currentPageId,
        model: modelToUse,
        mode: aiMode,
        memory: userMemory || undefined,
      }
      if (userKeyValue) body.userApiKey = userKeyValue

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.status === 429) {
        setModelRateLimited(modelToUse)
        const fallback = GROQ_MODELS.find((m) => !isRateLimited(m.id) && m.id !== modelToUse)
        toast.error(
          fallback
            ? `Rate-limited. Switch to ${fallback.name}?`
            : 'All models rate-limited. Wait ~60s.',
          { duration: 5000 }
        )
        return
      }

      if (!res.ok) throw new Error(data.error || 'AI request failed')

      const assistantMsg: AIMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString(),
        action: data.action,
        mode: aiMode,
      }
      addAiMessage(assistantMsg)

      // Update interaction count in memory
      updateUserMemory({ interactionCount: (userMemory?.interactionCount || 0) + 1 })

      if (data.action) {
        await refreshPages()
        if (data.action.type === 'page_created' && data.action.pageId) {
          toast.success(`Created "${data.action.title}"`, { duration: 4000 })
        } else if (data.action.type === 'page_updated') {
          toast.success('Page updated')
        } else if (data.action.type === 'plan_generated') {
          toast.success('Learning plan generated! 🗺️', { duration: 3000 })
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const currentModel = GROQ_MODELS.find((m) => m.id === selectedModel) ?? GROQ_MODELS[0]
  const modeBadge = MODE_BADGE[aiMode]

  return (
    <>
      <aside
        className="flex flex-col h-full border-l border-border bg-background overflow-hidden shrink-0"
        style={{ width, minWidth: width }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Bot className="w-4 h-4 text-foreground" />
          <span className="text-sm font-semibold flex-1">AI Assistant</span>

          {/* API source indicator */}
          {apiKeySource === 'user' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-medium">
              YOUR KEY
            </span>
          )}

          <button
            onClick={() => setAnalyticsOpen(true)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Learning Analytics"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPersonalizationOpen(true)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Personalize AI"
          >
            <Brain className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setApiKeyModalOpen(true)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="API Keys"
          >
            <Key className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={clearAiMessages}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Clear chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setAiOpen(false); onClose?.() }}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Modes Panel ── */}
        <AiModesPanel onSuggestionClick={(s) => sendMessage(s)} />

        {/* ── Model selector ── */}
        <div className="px-3 py-2 border-b border-border">
          <button
            onClick={() => setModelOpen((v) => !v)}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors text-left',
              isRateLimited(selectedModel) ? 'border-amber-500/40 bg-amber-500/5' : 'border-border hover:bg-accent'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full shrink-0', isRateLimited(selectedModel) ? 'bg-amber-500' : 'bg-emerald-500')} />
            <span className="text-xs font-medium flex-1 truncate">{currentModel.name}</span>
            {isRateLimited(selectedModel) && (
              <span className="text-[10px] text-amber-500 shrink-0">{getRateLimitSecondsLeft(selectedModel)}s</span>
            )}
            <ChevronDown className={cn('w-3 h-3 text-muted-foreground shrink-0 transition-transform', modelOpen && 'rotate-180')} />
          </button>

          {modelOpen && (
            <div className="mt-1.5 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
              {GROQ_MODELS.map((m) => {
                const limited = isRateLimited(m.id)
                const secsLeft = getRateLimitSecondsLeft(m.id)
                const active = m.id === selectedModel
                return (
                  <button
                    key={m.id}
                    onClick={() => { if (!limited) { setSelectedModel(m.id as GroqModelId); setModelOpen(false) } }}
                    disabled={limited}
                    className={cn(
                      'w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-border last:border-0',
                      active ? 'bg-accent' : 'hover:bg-accent/60',
                      limited && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', limited ? 'bg-amber-500' : 'bg-emerald-500')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium">{m.name}</span>
                        <span className={cn('text-[9px] font-semibold px-1 py-0.5 rounded uppercase tracking-wider', TAG_STYLES[m.tag])}>{m.tag}</span>
                        {active && <Check className="w-3 h-3 text-foreground ml-auto" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{m.desc}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-muted-foreground">{m.rpm} rpm</span>
                        <span className="text-[9px] text-muted-foreground">{m.rpd >= 10000 ? `${(m.rpd/1000).toFixed(1)}K` : m.rpd} rpd</span>
                        <span className={cn('text-[9px]', m.speed === 'Fast' ? 'text-emerald-500' : m.speed === 'Slow' ? 'text-amber-500' : 'text-muted-foreground')}>
                          <Zap className="w-2.5 h-2.5 inline" /> {m.speed}
                        </span>
                        {limited && <span className="text-[9px] text-amber-500 ml-auto flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> {secsLeft}s</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {aiMessages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium mb-1">How can I help?</p>
              <p className="text-xs opacity-70">Select a mode above to get started.</p>
            </div>
          )}

          {aiMessages.map((msg) => (
            <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user' ? 'bg-foreground text-background' : 'bg-muted text-foreground'
              )}>
                {/* Mode badge on user messages */}
                {msg.role === 'user' && msg.mode && msg.mode !== 'chat' && (
                  <span className={cn('inline-block text-[9px] px-1.5 py-0.5 rounded-full border mb-1 mr-auto font-medium', MODE_BADGE[msg.mode]?.color || '')}>
                    {MODE_BADGE[msg.mode]?.label}
                  </span>
                )}
                {msg.content}
                {msg.action?.type === 'page_created' && msg.action.pageId && (
                  <button
                    onClick={() => router.push(getPageUrl(workspaceId, msg.action!.pageId!))}
                    className="mt-1.5 flex items-center gap-1 text-xs underline opacity-70 hover:opacity-100"
                  >
                    <ChevronRight className="w-3 h-3" />
                    Open page
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                {aiMode === 'agentic' && <span className="text-[10px] text-muted-foreground">Executing autonomously…</span>}
                {aiMode === 'plan' && <span className="text-[10px] text-muted-foreground">Building plan…</span>}
                {aiMode === 'explore' && <span className="text-[10px] text-muted-foreground">Exploring…</span>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="p-3 border-t border-border">
          <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2">
            <textarea
              ref={inputRef}
              id="ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRateLimited(selectedModel)
                  ? 'Model rate-limited — switch above…'
                  : aiMode === 'agentic' ? 'Give a goal — I\'ll handle the rest…'
                  : aiMode === 'plan' ? 'Tell me your topics & timeline…'
                  : aiMode === 'explore' ? 'What do you want to explore?'
                  : 'Ask Noted AI…'
              }
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none outline-none max-h-28 overflow-y-auto placeholder:text-muted-foreground"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 112) + 'px'
              }}
            />
            <button
              id="ai-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg bg-foreground text-background hover:opacity-80 disabled:opacity-40 transition shrink-0"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5 opacity-50">
            {currentModel.name} · {aiMode !== 'chat' ? `${aiMode} mode · ` : ''}Enter ↵ to send
          </p>
        </div>
      </aside>

      {/* ── Overlays ── */}
      <PersonalizationPanel
        open={personalizationOpen}
        onClose={() => setPersonalizationOpen(false)}
        workspaceId={workspaceId}
      />
      <LearningAnalytics
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
      />
      <ApiKeysModal
        open={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </>
  )
}
