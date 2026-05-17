'use client'

import { useState, useRef } from 'react'
import { X, Brain, Upload, Trash2, Settings2, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { generateContextId } from '@/lib/personalization'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { UploadedContext } from '@/types'

interface PersonalizationPanelProps {
  open: boolean
  onClose: () => void
  workspaceId: string
}

export function PersonalizationPanel({ open, onClose, workspaceId }: PersonalizationPanelProps) {
  const { userMemory, updateUserMemory, setPersonalizationOpen } = useAppStore()
  const [uploading, setUploading] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(true)
  const [contextsOpen, setContextsOpen] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const mem = userMemory

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const text = await file.text()
      const res = await fetch('/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_context',
          text,
          name: file.name,
          type: file.type.includes('image') ? 'screenshot' : 'notes',
        }),
      })
      const data = await res.json()
      if (data.context) {
        const existing = mem?.uploadedContexts || []
        updateUserMemory({ uploadedContexts: [...existing, data.context as UploadedContext] })
        toast.success(`Context "${file.name}" added`)
      }
    } catch {
      toast.error('Failed to process file')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeContext = (id: string) => {
    const existing = mem?.uploadedContexts || []
    updateUserMemory({ uploadedContexts: existing.filter((c) => c.id !== id) })
  }

  const SectionHeader = ({ label, state, toggle }: { label: string; state: boolean; toggle: () => void }) => (
    <button onClick={toggle} className="w-full flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
      {label}
      {state ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Brain className="w-5 h-5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">AI Personalization</h2>
            <p className="text-[11px] text-muted-foreground">Train AI to your niche and preferences</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ── Preferences ── */}
          <div className="space-y-3">
            <SectionHeader label="Style Preferences" state={prefsOpen} toggle={() => setPrefsOpen(v => !v)} />
            {prefsOpen && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Explanation Depth</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => updateUserMemory({ preferredDepth: d })}
                        className={cn(
                          'py-1.5 rounded-lg text-[10px] font-medium border capitalize transition-all',
                          mem?.preferredDepth === d ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Tone</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['concise', 'detailed', 'casual', 'formal'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => updateUserMemory({ preferredTone: t })}
                        className={cn(
                          'py-1.5 rounded-lg text-[10px] font-medium border capitalize transition-all',
                          mem?.preferredTone === t ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Response Style</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['bullet', 'prose', 'step-by-step', 'visual'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateUserMemory({ preferredStyle: s })}
                        className={cn(
                          'py-1.5 rounded-lg text-[10px] font-medium border capitalize transition-all',
                          mem?.preferredStyle === s ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {s === 'step-by-step' ? 'Steps' : s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Memory Status ── */}
          {mem && (mem.weakAreas.length > 0 || mem.strongAreas.length > 0) && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Persistent Memory</p>
              <div className="space-y-2">
                {mem.weakAreas.length > 0 && (
                  <div className="px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <p className="text-[10px] font-medium text-amber-600 mb-1">Identified Weak Areas</p>
                    <div className="flex flex-wrap gap-1">
                      {mem.weakAreas.map((a) => (
                        <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {mem.strongAreas.length > 0 && (
                  <div className="px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-[10px] font-medium text-emerald-600 mb-1">Strong Areas</p>
                    <div className="flex flex-wrap gap-1">
                      {mem.strongAreas.map((a) => (
                        <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Interactions tracked: {mem.interactionCount}</p>
            </div>
          )}

          {/* ── Uploaded Contexts ── */}
          <div className="space-y-3">
            <SectionHeader label="Personal Knowledge Base" state={contextsOpen} toggle={() => setContextsOpen(v => !v)} />
            {contextsOpen && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.pdf,.csv,.json,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-foreground/40 hover:bg-muted/30 transition-all text-sm text-muted-foreground"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Processing...' : 'Upload notes, screenshots, or datasets'}
                </button>

                {mem?.uploadedContexts && mem.uploadedContexts.length > 0 ? (
                  <div className="space-y-2">
                    {mem.uploadedContexts.map((ctx) => (
                      <div key={ctx.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{ctx.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{ctx.type} · {ctx.content.length} chars</p>
                        </div>
                        <button onClick={() => removeContext(ctx.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-2">No context uploaded yet. AI will use workspace pages only.</p>
                )}
              </>
            )}
          </div>

          {/* Reset */}
          <button
            onClick={() => {
              updateUserMemory({ weakAreas: [], strongAreas: [], uploadedContexts: [], interactionCount: 0 })
              toast.success('Memory cleared')
            }}
            className="w-full text-xs text-muted-foreground hover:text-red-500 transition-colors py-1"
          >
            Clear all memory & context
          </button>
        </div>
      </div>
    </div>
  )
}
