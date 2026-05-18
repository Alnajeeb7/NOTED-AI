'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Bot, Send, Loader2, RotateCcw, ChevronRight, ChevronDown, Zap, Wand2,
  AlertTriangle, Check, Brain, BarChart3, Key, Paperclip, Database,
  FileText, Image as ImageIcon, X as XIcon, Info,
} from 'lucide-react'
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

interface AttachedFile {
  id: string
  name: string
  type: string
  content: string   // extracted text
  size: number
  isImage: boolean
}

interface KBItem {
  id: string
  name: string
  file_type: string
  extracted_text: string
  created_at?: string
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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [kbItems, setKbItems] = useState<KBItem[]>([])
  const [kbOpen, setKbOpen] = useState(false)
  const [kbLoading, setKbLoading] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const kbFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [aiMessages, loading])
  useEffect(() => { inputRef.current?.focus() }, [])

  // Load KB items on mount
  useEffect(() => {
    loadKBItems()
  }, [workspaceId])

  // Auto-clear rate limits
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      Object.entries(rateLimitedModels).forEach(([id, ts]) => {
        if (now - (ts as number) > RATE_LIMIT_COOLDOWN_MS) clearModelRateLimit(id)
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [rateLimitedModels, clearModelRateLimit])

  const isRateLimited = (id: string) => !!rateLimitedModels[id]
  const getRateLimitSecondsLeft = (id: string) => {
    const ts = rateLimitedModels[id] as number | undefined
    if (!ts) return 0
    return Math.ceil((RATE_LIMIT_COOLDOWN_MS - (Date.now() - ts)) / 1000)
  }

  const loadKBItems = async () => {
    try {
      const res = await fetch(`/api/knowledge-base?workspaceId=${workspaceId}`)
      if (res.ok) {
        const data = await res.json()
        setKbItems(data.items || [])
      }
    } catch { /* ignore */ }
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

  // ── File reading helper ────────────────────────────────────────────────────
  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader()
      reader.onerror = () => resolve(`[Could not read file: ${file.name}]`)
      if (file.type.startsWith('image/')) {
        // Read as base64 data URL so the AI can actually see the image
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsText(file)
      }
    })


  // ── Prompt enhancer ────────────────────────────────────────────────────────
  const enhancePrompt = async () => {
    const raw = input.trim()
    if (!raw || enhancing) return
    setEnhancing(true)
    try {
      const hasImages = attachedFiles.some((f) => f.isImage)
      const hasFiles  = attachedFiles.some((f) => !f.isImage)

      const context = [
        hasImages ? 'The user has attached image file(s).' : '',
        hasFiles  ? 'The user has attached non-image file(s) (PDF/text/CSV).' : '',
        kbItems.length > 0 ? `The user has ${kbItems.length} Knowledge Base file(s) active.` : '',
        aiMode !== 'chat' ? `Current AI mode: ${aiMode}.` : '',
      ].filter(Boolean).join(' ')

      const sysPrompt = [
        'You are a prompt engineering expert for an AI note-taking assistant called Noted AI.',
        'Your job: rewrite the user rough input into a clear, specific, actionable prompt.',
        'Rules:',
        '- Keep the user intent 100% intact, do NOT change what they want',
        '- Make it specific and unambiguous',
        '- If the user asks for code or text from an image, say explicitly: Look at the attached image and extract all visible code/text exactly as written',
        '- If KB files are active, reference them: Using the Knowledge Base files...',
        '- If the user wants to save to a page, say: Save this to my current page: ...',
        '- Do NOT add things the user did not ask for',
        '- Output ONLY the improved prompt text, no quotes, no explanation, no preamble',
      ].join('\n')

      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw, context, sysPrompt })
      })
      const data = await res.json()
      const enhanced = data?.enhanced?.trim()
      if (enhanced) {
        setInput(enhanced)
        toast.success('Prompt enhanced ✨', { duration: 1500 })
      }
    } catch {
      toast.error('Enhancement failed')
    } finally {
      setEnhancing(false)
    }
  }

  // ── Attach file directly in chat ───────────────────────────────────────────
  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10 MB)`)
        continue
      }
      const content = await readFileAsText(file)
      setAttachedFiles((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          type: file.type,
          content,
          size: file.size,
          isImage: file.type.startsWith('image/'),
        },
      ])
    }
    e.target.value = ''
  }

  // ── Upload to Knowledge Base ───────────────────────────────────────────────
  const handleKBUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingFile(true)

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('workspaceId', workspaceId)
        formData.append('name', file.name)

        const res = await fetch('/api/knowledge-base', { method: 'POST', body: formData })
        const data = await res.json()

        if (data.success) {
          toast.success(`Added "${file.name}" to Knowledge Base`)
          // Add to local state immediately for in-session use
          const newItem: KBItem = {
            id: data.id,
            name: data.name || file.name,
            file_type: file.type,
            extracted_text: data.extractedText || '',
            created_at: new Date().toISOString(),
          }
          setKbItems((prev) => [newItem, ...prev])
        } else {
          toast.error(data.error || `Failed to upload ${file.name}`)
        }
      } catch {
        toast.error(`Upload failed for ${file.name}`)
      }
    }
    setUploadingFile(false)
    e.target.value = ''
  }

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const removeKBItem = async (id: string) => {
    setKbItems((prev) => prev.filter((k) => k.id !== id))
    try {
      await fetch(`/api/knowledge-base?id=${id}`, { method: 'DELETE' })
    } catch { /* ignore */ }
  }

  // ── Send message ───────────────────────────────────────────────────────────
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
      content: attachedFiles.length
        ? `${text}\n\n[Attached files: ${attachedFiles.map((f) => f.name).join(', ')}]`
        : text,
      timestamp: new Date().toISOString(),
      mode: aiMode,
    }
    addAiMessage(userMsg)
    const filesForSend = [...attachedFiles]
    setAttachedFiles([])
    setInput('')
    setLoading(true)
    incrementSessionMessages()

    try {
      const endpoint = aiMode === 'chat' ? '/api/ai' : '/api/ai-modes'

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
        // RAG: pass KB items and attached files
        kbItems: kbItems.map((k) => ({
          id: k.id,
          name: k.name,
          extracted_text: k.extracted_text,
          file_type: k.file_type,
        })),
        attachedFiles: filesForSend.map((f) => ({
          name: f.name,
          type: f.type,
          content: f.content,
        })),
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
          fallback ? `Rate-limited. Switch to ${fallback.name}?` : 'All models rate-limited. Wait ~60s.',
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
        // @ts-ignore — extended field for source display
        sourcesUsed: data.sourcesUsed,
      }
      addAiMessage(assistantMsg)
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

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-3 h-3" />
    return <FileText className="w-3 h-3" />
  }

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

          {apiKeySource === 'user' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-medium">
              YOUR KEY
            </span>
          )}

          <button onClick={() => setKbOpen((v) => !v)}
            className={cn('p-1.5 rounded hover:bg-accent transition-colors relative', kbOpen ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-foreground')}
            title="Knowledge Base"
          >
            <Database className="w-3.5 h-3.5" />
            {kbItems.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                {kbItems.length > 9 ? '9+' : kbItems.length}
              </span>
            )}
          </button>
          <button onClick={() => setAnalyticsOpen(true)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Learning Analytics">
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setPersonalizationOpen(true)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Personalize AI">
            <Brain className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setApiKeyModalOpen(true)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="API Keys">
            <Key className="w-3.5 h-3.5" />
          </button>
          <button onClick={clearAiMessages} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Clear chat">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setAiOpen(false); onClose?.() }} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Knowledge Base Panel ── */}
        {kbOpen && (
          <div className="border-b border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Database className="w-3 h-3" /> Knowledge Base
                <span className="text-[10px] text-muted-foreground font-normal">({kbItems.length} files)</span>
              </span>
              <button
                onClick={() => kbFileInputRef.current?.click()}
                disabled={uploadingFile}
                className="text-[10px] px-2 py-0.5 rounded bg-foreground text-background hover:opacity-80 disabled:opacity-50 transition flex items-center gap-1"
              >
                {uploadingFile ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '+'}
                Add file
              </button>
              <input
                ref={kbFileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md,.csv,.json,image/*"
                multiple
                onChange={handleKBUpload}
              />
            </div>

            {kbItems.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-[10px] text-muted-foreground">No KB files yet.</p>
                <p className="text-[10px] text-muted-foreground opacity-70">Upload PDFs, notes, or images — AI will use them for every answer.</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {kbItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-background border border-border/50">
                    {getFileIcon(item.file_type)}
                    <span className="text-[10px] flex-1 truncate text-foreground">{item.name}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Active in context" />
                    <button onClick={() => removeKBItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[9px] text-muted-foreground mt-2 opacity-70 flex items-center gap-1">
              <Info className="w-2.5 h-2.5" />
              KB files are auto-injected as context for every message
            </p>
          </div>
        )}

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
              <p className="text-xs opacity-70 mb-2">Select a mode above to get started.</p>
              {kbItems.length > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{kbItems.length} KB file{kbItems.length > 1 ? 's' : ''} active</span>
                </div>
              )}
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
                {msg.role === 'user' && (msg as any).mode && (msg as any).mode !== 'chat' && (
                  <span className={cn('inline-block text-[9px] px-1.5 py-0.5 rounded-full border mb-1 mr-auto font-medium', MODE_BADGE[(msg as any).mode]?.color || '')}>
                    {MODE_BADGE[(msg as any).mode]?.label}
                  </span>
                )}
                {msg.content}

                {/* Sources used badge */}
                {msg.role === 'assistant' && (msg as any).sourcesUsed?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(msg as any).sourcesUsed.slice(0, 3).map((s: { source: string; type: string }, i: number) => (
                      <span key={i} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {s.type === 'kb_file' ? '📎' : '📄'} {s.source.slice(0, 20)}{s.source.length > 20 ? '…' : ''}
                      </span>
                    ))}
                  </div>
                )}

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
                {kbItems.length > 0 && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Searching KB…</span>}
                {aiMode === 'agentic' && <span className="text-[10px] text-muted-foreground">Executing autonomously…</span>}
                {aiMode === 'plan' && <span className="text-[10px] text-muted-foreground">Building plan…</span>}
                {aiMode === 'explore' && <span className="text-[10px] text-muted-foreground">Exploring…</span>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Attached Files Preview ── */}
        {attachedFiles.length > 0 && (
          <div className="px-3 py-2 border-t border-border bg-muted/30">
            <div className="flex flex-wrap gap-1.5">
              {attachedFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-background border border-border text-[10px]">
                  {getFileIcon(f.type)}
                  <span className="max-w-[80px] truncate text-foreground">{f.name}</span>
                  <button onClick={() => removeAttachedFile(f.id)} className="text-muted-foreground hover:text-destructive ml-0.5">
                    <XIcon className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Input ── */}
        <div className="p-3 border-t border-border">
          <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2">
            {/* File attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-0.5"
              title="Attach file to this message"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,.csv,.json,image/*"
              multiple
              onChange={handleAttachFile}
            />

            {/* Prompt enhancer button */}
            <button
              onClick={enhancePrompt}
              disabled={!input.trim() || enhancing}
              className="p-1 text-muted-foreground hover:text-violet-500 transition-colors shrink-0 mb-0.5 disabled:opacity-30"
              title="Enhance prompt with AI ✨"
            >
              {enhancing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                : <Wand2 className="w-3.5 h-3.5" />}
            </button>

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
                  : kbItems.length > 0 ? `Ask anything — ${kbItems.length} KB file${kbItems.length > 1 ? 's' : ''} active…`
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
            {currentModel.name} · {aiMode !== 'chat' ? `${aiMode} mode · ` : ''}{kbItems.length > 0 ? `📎 KB: ${kbItems.length} · ` : ''}Enter ↵ to send
          </p>
        </div>
      </aside>

      {/* ── Overlays ── */}
      <PersonalizationPanel open={personalizationOpen} onClose={() => setPersonalizationOpen(false)} workspaceId={workspaceId} />
      <LearningAnalytics open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
      <ApiKeysModal open={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
    </>
  )
}
