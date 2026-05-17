'use client'

import { useState, useEffect } from 'react'
import { X, Key, Plus, Trash2, Eye, EyeOff, RefreshCw, ToggleLeft, ToggleRight, Copy, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { ApiKeyProvider, UserApiKey } from '@/types'

const PROVIDERS: { id: ApiKeyProvider; name: string; color: string; docsUrl: string; placeholder: string }[] = [
  { id: 'groq',    name: 'Groq',         color: 'text-orange-500',  docsUrl: 'https://console.groq.com/keys',          placeholder: 'gsk_...' },
  { id: 'openai',  name: 'OpenAI',       color: 'text-green-500',   docsUrl: 'https://platform.openai.com/api-keys',   placeholder: 'sk-...' },
  { id: 'claude',  name: 'Anthropic',    color: 'text-violet-500',  docsUrl: 'https://console.anthropic.com/',          placeholder: 'sk-ant-...' },
  { id: 'gemini',  name: 'Gemini',       color: 'text-blue-500',    docsUrl: 'https://aistudio.google.com/apikey',     placeholder: 'AIza...' },
  { id: 'platform',name: 'Platform Key', color: 'text-foreground',  docsUrl: '',                                        placeholder: 'Auto-generated' },
]

interface ApiKeysModalProps {
  open: boolean
  onClose: () => void
}

export function ApiKeysModal({ open, onClose }: ApiKeysModalProps) {
  const {
    apiKeySource, setApiKeySource,
    userApiKeys, addUserApiKey, removeUserApiKey, setUserApiKeys,
    activeUserKeyId, setActiveUserKeyId,
  } = useAppStore()

  const [newKeyProvider, setNewKeyProvider] = useState<ApiKeyProvider>('groq')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [validating, setValidating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'user' | 'platform' | 'usage'>('user')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  const handleAddKey = async () => {
    if (!newKeyValue.trim()) return toast.error('Enter a key value')
    setValidating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', provider: newKeyProvider, key: newKeyValue }),
      })
      const data = await res.json()
      if (!data.valid) {
        toast.error(data.message || 'Invalid key format')
        return
      }
      const newKey: UserApiKey = {
        id: `key_${Date.now()}`,
        userId: '',
        provider: newKeyProvider,
        label: newKeyLabel || `${PROVIDERS.find(p => p.id === newKeyProvider)?.name} Key`,
        keyPrefix: data.keyPrefix,
        isActive: true,
        usageCount: 0,
        lastUsed: null,
        createdAt: new Date().toISOString(),
      }
      // Store actual key in sessionStorage (not persisted across sessions for security)
      sessionStorage.setItem(`apikey_${newKey.id}`, newKeyValue)
      addUserApiKey(newKey)
      setNewKeyValue('')
      setNewKeyLabel('')
      toast.success('API key added successfully')
    } finally {
      setValidating(false)
    }
  }

  const handleGeneratePlatformKey = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_platform_key' }),
      })
      const data = await res.json()
      if (data.key) {
        await navigator.clipboard.writeText(data.key)
        toast.success('Platform key generated and copied!')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleRemoveKey = (id: string) => {
    sessionStorage.removeItem(`apikey_${id}`)
    removeUserApiKey(id)
    if (activeUserKeyId === id) setActiveUserKeyId(null)
    toast.success('Key removed')
  }

  const handleToggleSource = () => {
    const next = apiKeySource === 'platform' ? 'user' : 'platform'
    if (next === 'user' && userApiKeys.length === 0) {
      toast.error('Add a user API key first')
      return
    }
    setApiKeySource(next)
    toast.success(`Switched to ${next === 'platform' ? 'Platform' : 'Your'} API`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Key className="w-5 h-5 text-foreground" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">API Keys & Developer Access</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage platform and external API keys</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source toggle */}
        <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium">AI Source</p>
            <p className="text-[11px] text-muted-foreground">
              {apiKeySource === 'platform' ? 'Using Noted platform AI (free tier)' : 'Using your own API key'}
            </p>
          </div>
          <button onClick={handleToggleSource} className="flex items-center gap-2 text-xs">
            <span className={cn('font-medium', apiKeySource === 'platform' ? 'text-foreground' : 'text-muted-foreground')}>Platform</span>
            {apiKeySource === 'user'
              ? <ToggleRight className="w-8 h-8 text-emerald-500" />
              : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
            <span className={cn('font-medium', apiKeySource === 'user' ? 'text-foreground' : 'text-muted-foreground')}>Your API</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['user', 'platform', 'usage'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium capitalize transition-colors',
                tab === t ? 'border-b-2 border-foreground text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'user' ? 'Your Keys' : t === 'platform' ? 'Platform Key' : 'Usage'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── USER KEYS TAB ── */}
          {tab === 'user' && (
            <>
              {/* Add new key */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add External Key</p>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.filter(p => p.id !== 'platform').map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setNewKeyProvider(p.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                        newKeyProvider === p.id ? 'border-foreground/40 bg-muted' : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full bg-current', p.color)} />
                      <span className={newKeyProvider === p.id ? 'text-foreground' : 'text-muted-foreground'}>{p.name}</span>
                      {p.docsUrl && (
                        <a href={p.docsUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="ml-auto opacity-40 hover:opacity-100">
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </button>
                  ))}
                </div>

                <input
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-full bg-muted rounded-lg px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
                />

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder={PROVIDERS.find(p => p.id === newKeyProvider)?.placeholder || 'API Key...'}
                    className="w-full bg-muted rounded-lg px-3 py-2 pr-9 text-xs outline-none placeholder:text-muted-foreground font-mono"
                  />
                  <button
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={handleAddKey}
                  disabled={!newKeyValue.trim() || validating}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-40 hover:opacity-90 transition"
                >
                  {validating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {validating ? 'Validating...' : 'Add Key'}
                </button>
              </div>

              {/* Existing keys */}
              {userApiKeys.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saved Keys</p>
                  {userApiKeys.map((key) => {
                    const provider = PROVIDERS.find(p => p.id === key.provider)
                    const isActive = activeUserKeyId === key.id && apiKeySource === 'user'
                    return (
                      <div key={key.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all', isActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-muted/30')}>
                        <div className={cn('w-2 h-2 rounded-full bg-current shrink-0', provider?.color || 'text-foreground')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{key.label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{key.keyPrefix}</p>
                        </div>
                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        <button
                          onClick={() => {
                            setActiveUserKeyId(isActive ? null : key.id)
                            if (!isActive) setApiKeySource('user')
                          }}
                          className={cn('text-[10px] px-2 py-1 rounded border transition-colors', isActive ? 'border-emerald-500/40 text-emerald-600' : 'border-border text-muted-foreground hover:text-foreground')}
                        >
                          {isActive ? 'Active' : 'Use'}
                        </button>
                        <button onClick={() => handleRemoveKey(key.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/50 border border-border">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground">Keys are stored locally in your browser session and never sent to Noted servers unencrypted.</p>
              </div>
            </>
          )}

          {/* ── PLATFORM KEY TAB ── */}
          {tab === 'platform' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Generate a Noted Platform API key to integrate Noted AI into your own applications and workflows.</p>
              <button
                onClick={handleGeneratePlatformKey}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-40 hover:opacity-90 transition"
              >
                {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                {generating ? 'Generating...' : 'Generate Platform Key'}
              </button>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Key Capabilities</p>
                {['Access your workspace via API', 'Create & edit pages programmatically', 'Query AI with your workspace context', 'Build custom integrations'].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate Limits by Tier</p>
                {[
                  { tier: 'Free', limit: '100 calls/day', color: 'text-muted-foreground' },
                  { tier: 'Pro', limit: '1,000 calls/day', color: 'text-blue-500' },
                  { tier: 'Enterprise', limit: 'Unlimited', color: 'text-violet-500' },
                ].map((t) => (
                  <div key={t.tier} className="flex justify-between text-xs">
                    <span className={t.color}>{t.tier}</span>
                    <span className="text-muted-foreground">{t.limit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── USAGE TAB ── */}
          {tab === 'usage' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Keys Added', value: userApiKeys.length, icon: Key },
                  { label: 'Active Source', value: apiKeySource === 'platform' ? 'Platform' : 'User Key', icon: CheckCircle2 },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="px-3 py-3 rounded-lg border border-border bg-muted/30">
                    <Icon className="w-4 h-4 text-muted-foreground mb-2" />
                    <p className="text-lg font-bold">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="px-3 py-3 rounded-lg border border-border bg-muted/30 space-y-2">
                <p className="text-xs font-medium">Platform Usage (Today)</p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[12%] rounded-full bg-foreground" />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>12 / 100 calls</span>
                  <span>Resets in 11h 24m</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">Detailed usage logs coming soon in Pro plan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
