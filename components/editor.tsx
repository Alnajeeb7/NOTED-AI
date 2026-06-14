'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
  insertOrUpdateBlock,
  BlockNoteEditor as BNEditor,
} from '@blocknote/core'
import {
  createReactBlockSpec,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  SideMenuController,
  SideMenu,
  AddBlockButton,
  DragHandleButton,
  FormattingToolbar,
  FormattingToolbarController,
  useBlockNoteEditor,
} from '@blocknote/react'
import type { Block } from '@blocknote/core'
import toast from 'react-hot-toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function isYouTubeUrl(text: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(text)
}

// Convert markdown string → BlockNote Block array
function markdownToBlocks(md: string): any[] {
  const lines = md.split('\n')
  const blocks: any[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue

    // Headings
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: trimmed.slice(4), styles: {} }] })
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: trimmed.slice(3), styles: {} }] })
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: trimmed.slice(2), styles: {} }] })
    }
    // Checklist
    else if (/^-\s\[x\]\s/.test(trimmed)) {
      blocks.push({ type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: trimmed.replace(/^-\s\[x\]\s/, ''), styles: {} }] })
    } else if (/^-\s\[ \]\s/.test(trimmed)) {
      blocks.push({ type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: trimmed.replace(/^-\s\[ \]\s/, ''), styles: {} }] })
    }
    // Numbered list
    else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({ type: 'numberedListItem', content: [{ type: 'text', text: trimmed.replace(/^\d+\.\s/, ''), styles: {} }] })
    }
    // Bullet list
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ type: 'bulletListItem', content: [{ type: 'text', text: trimmed.slice(2), styles: {} }] })
    }
    // Blockquote
    else if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'quote', content: [{ type: 'text', text: trimmed.slice(2), styles: {} }] })
    }
    // Code block (``` fenced)
    else if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'codeBlock', props: { language: 'text' }, content: [{ type: 'text', text: codeLines.join('\n'), styles: {} }] })
    }
    // Bold/italic inline — just produce paragraph with inline styles
    else {
      // Handle inline bold/italic
      const inlineContent = parseInline(trimmed)
      blocks.push({ type: 'paragraph', content: inlineContent })
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', content: [{ type: 'text', text: md, styles: {} }] }]
}

// Parse inline bold/italic into BlockNote inline content array
function parseInline(text: string): any[] {
  const result: any[] = []
  // Simple regex: **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) result.push({ type: 'text', text: match[2], styles: { bold: true } })
    else if (match[3]) result.push({ type: 'text', text: match[3], styles: { italic: true } })
    else if (match[4]) result.push({ type: 'text', text: match[4], styles: { code: true } })
    else if (match[5]) result.push({ type: 'text', text: match[5], styles: {} })
  }
  return result.length > 0 ? result : [{ type: 'text', text, styles: {} }]
}

// Get plain text content from a block
function getBlockPlainText(block: any): string {
  if (!block?.content) return ''
  if (Array.isArray(block.content)) {
    return block.content.map((c: any) => c.text || '').join('')
  }
  return ''
}

// ─── YouTube Block ────────────────────────────────────────────────────────────

const YouTubeBlock = createReactBlockSpec(
  { type: 'youtube' as const, propSchema: { url: { default: '' } }, content: 'none' },
  {
    render: ({ block, editor }) => {
      const [inputUrl, setInputUrl] = useState('')
      const videoId = extractYouTubeId(block.props.url)

      const submit = (val: string) => {
        if (!val || !extractYouTubeId(val)) return
        editor.updateBlock(block.id, { type: 'youtube', props: { url: val } } as any)
      }

      if (!block.props.url || !videoId) {
        return (
          <div contentEditable={false} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0' }}>
            <input
              autoFocus
              value={inputUrl}
              placeholder="Paste YouTube URL and press Enter..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1.5px solid #333', background: '#1a1a1a', color: '#e5e5e5', fontSize: 13, outline: 'none' }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => setInputUrl(e.target.value)}
              onPaste={e => {
                e.stopPropagation()
                const val = e.clipboardData.getData('text/plain').trim()
                if (extractYouTubeId(val)) { e.preventDefault(); submit(val) }
              }}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter') submit(inputUrl)
                if (e.key === 'Escape') editor.removeBlocks([block.id] as any)
              }}
            />
            <span style={{ fontSize: 11, color: '#666' }}>Enter ↵</span>
          </div>
        )
      }

      return (
        <div contentEditable={false} style={{ width: '100%', margin: '4px 0' }}>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8, background: '#000' }}>
            <iframe src={`https://www.youtube.com/embed/${videoId}`} title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
          </div>
          <a href={block.props.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'inline-block' }}>Open on YouTube ↗</a>
        </div>
      )
    },
    toExternalHTML: ({ block }) => <div><a href={block.props.url}>{block.props.url}</a></div>,
  }
)

// ─── Callout Block ────────────────────────────────────────────────────────────

const CALLOUT_TYPES = {
  info:    { emoji: 'ℹ️', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.25)'  },
  warning: { emoji: '⚠️', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.30)'  },
  success: { emoji: '✅', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)'   },
  error:   { emoji: '❌', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)'   },
  tip:     { emoji: '💡', bg: 'rgba(168,85,247,0.10)',  border: 'rgba(168,85,247,0.25)'  },
}

const CalloutBlock = createReactBlockSpec(
  {
    type: 'callout' as const,
    propSchema: { emoji: { default: 'ℹ️' }, kind: { default: 'info' }, text: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const kind = (block.props.kind as keyof typeof CALLOUT_TYPES) || 'info'
      const cfg = CALLOUT_TYPES[kind] || CALLOUT_TYPES.info
      const [editing, setEditing] = useState(false)
      const [text, setText] = useState(block.props.text || '')
      const save = () => { editor.updateBlock(block.id, { props: { ...block.props, text } } as any); setEditing(false) }
      return (
        <div contentEditable={false} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}`, margin: '2px 0' }}>
          <span style={{ fontSize: 16, lineHeight: '24px', flexShrink: 0 }}>{cfg.emoji}</span>
          <div style={{ flex: 1 }}>
            {editing ? (
              <textarea autoFocus value={text} onChange={e => setText(e.target.value)} onBlur={save}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } if (e.key === 'Escape') setEditing(false) }}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.6, resize: 'none', fontFamily: 'inherit' }}
                rows={2}
              />
            ) : (
              <p onClick={() => setEditing(true)} style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: text ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', cursor: 'text', minHeight: 24 }}>
                {text || 'Click to add callout text…'}
              </p>
            )}
          </div>
        </div>
      )
    },
    toExternalHTML: ({ block }) => <blockquote>{block.props.text}</blockquote>,
  }
)

// ─── Divider Block ────────────────────────────────────────────────────────────

const DividerBlock = createReactBlockSpec(
  { type: 'divider' as const, propSchema: { style: { default: 'solid' } }, content: 'none' },
  {
    render: ({ block }) => (
      <div contentEditable={false} style={{ padding: '8px 0', userSelect: 'none' }}>
        <hr style={{ border: 'none', borderTop: block.props.style === 'dashed' ? '1.5px dashed rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.12)', margin: 0 }} />
      </div>
    ),
    toExternalHTML: () => <hr />,
  }
)

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    youtube: YouTubeBlock,
    callout: CalloutBlock,
    divider: DividerBlock,
  },
})

async function uploadToSupabase(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Upload failed')
  const { url } = await res.json()
  return url
}

// ─── AI helper ────────────────────────────────────────────────────────────────

async function callAI(prompt: string, text: string): Promise<string> {
  const res = await fetch('/api/ai-inline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, text }),
  })
  if (!res.ok) throw new Error('AI request failed')
  const data = await res.json()
  return data.content || text
}

// Apply AI result back to a block as proper BlockNote blocks
function applyAIResultToEditor(
  editor: typeof schema.BlockNoteEditor,
  blockId: string,
  result: string
) {
  const blocks = markdownToBlocks(result)
  if (blocks.length === 0) return

  // Update current block with first result block
  const [first, ...rest] = blocks
  try {
    editor.updateBlock(blockId as any, first)
  } catch {
    // fallback: plain text
    editor.updateBlock(blockId as any, {
      type: 'paragraph',
      content: [{ type: 'text', text: result, styles: {} }],
    } as any)
    return
  }

  // Insert remaining blocks after
  if (rest.length > 0) {
    try {
      editor.insertBlocks(rest as any, blockId as any, 'after')
    } catch { /* ignore */ }
  }
}

// ─── Slash Menu Items ─────────────────────────────────────────────────────────

const insertYouTubeItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: 'YouTube',
  subtext: 'Embed a YouTube video',
  onItemClick: () => insertOrUpdateBlock(editor as any, { type: 'youtube', props: { url: '' } } as any),
  aliases: ['youtube', 'yt', 'embed', 'video'],
  group: 'Media',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  ),
})

const insertDividerItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: 'Divider',
  subtext: 'A visual separator',
  onItemClick: () => insertOrUpdateBlock(editor as any, { type: 'divider', props: { style: 'solid' } } as any),
  aliases: ['divider', 'separator', 'hr', 'line', '---'],
  group: 'Basic blocks',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12"/>
    </svg>
  ),
})

const insertCalloutItem = (editor: typeof schema.BlockNoteEditor, kind: keyof typeof CALLOUT_TYPES) => {
  const cfg = CALLOUT_TYPES[kind]
  return {
    title: `${cfg.emoji} ${kind.charAt(0).toUpperCase() + kind.slice(1)} callout`,
    subtext: 'Highlighted callout block',
    onItemClick: () => insertOrUpdateBlock(editor as any, { type: 'callout', props: { kind, emoji: cfg.emoji, text: '' } } as any),
    aliases: ['callout', kind, 'note', 'alert'],
    group: 'Advanced',
    icon: <span style={{ fontSize: 16 }}>{cfg.emoji}</span>,
  }
}

const insertTableItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: 'Table',
  subtext: 'Insert a structured table',
  onItemClick: () => insertOrUpdateBlock(editor as any, { type: 'table' } as any),
  aliases: ['table', 'grid', 'spreadsheet', 'rows', 'columns'],
  group: 'Advanced',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
    </svg>
  ),
})

// ─── Notion-style Slash Menu ──────────────────────────────────────────────────

function NotionSlashMenu(props: any) {
  const { items, loadingState, selectedIndex, onItemClick } = props
  if (loadingState === 'loading-initial') return null

  const groupOrder = ['Headings', 'Basic blocks', 'Advanced', 'Media', 'Other']
  const grouped: Record<string, Array<{ item: any; flatIdx: number }>> = {}
  items.forEach((item: any, flatIdx: number) => {
    const g = item.group || 'Other'
    if (!grouped[g]) grouped[g] = []
    grouped[g].push({ item, flatIdx })
  })
  const sortedGroups = [
    ...groupOrder.filter(g => grouped[g]),
    ...Object.keys(grouped).filter(g => !groupOrder.includes(g)),
  ]

  return (
    <div style={{ background: '#191919', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.85)', width: 310, maxHeight: 420, overflowY: 'auto', padding: '6px 0' }}>
      {sortedGroups.map(group => (
        <div key={group}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.28)', padding: '8px 14px 4px' }}>
            {group}
          </div>
          {grouped[group].map(({ item, flatIdx }) => {
            const isSelected = flatIdx === selectedIndex
            return (
              <button key={item.title} onMouseDown={e => { e.preventDefault(); onItemClick?.(item) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 8px)', padding: '5px 10px', background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6, margin: '1px 4px' }}>
                <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: 6, background: isSelected ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: isSelected ? '#a78bfa' : 'rgba(255,255,255,0.75)' }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? '#fff' : 'rgba(255,255,255,0.88)', lineHeight: 1.3 }}>{item.title}</div>
                  {item.subtext && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtext}</div>}
                </div>
              </button>
            )
          })}
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ padding: 16, fontSize: 13, color: 'rgba(255,255,255,0.28)', textAlign: 'center' }}>No results</div>
      )}
    </div>
  )
}

// ─── AI Formatting Toolbar ────────────────────────────────────────────────────
// KEY FIX: We store selection BEFORE the button causes blur using onMouseDown
// capturing the selection range, then restore it before calling the AI.

const AI_SKILLS = [
  { label: 'Improve writing', prompt: 'Improve the writing quality, making it clearer and more polished. Return only the improved text:', icon: '✨' },
  { label: 'Proofread',       prompt: 'Fix all grammar, spelling, and punctuation errors. Return only the corrected text:', icon: '🔍' },
  { label: 'Summarize',       prompt: 'Summarize this text concisely in 2-3 sentences. Return only the summary:', icon: '📝' },
  { label: 'Make shorter',    prompt: 'Make this text more concise without losing key meaning. Return only the shortened text:', icon: '✂️' },
  { label: 'Make longer',     prompt: 'Expand this text with more detail. Return only the expanded text:', icon: '📖' },
  { label: 'Fix grammar',     prompt: 'Fix all grammar and spelling errors. Return only the corrected text:', icon: '🔍' },
  { label: 'Explain simply',  prompt: 'Explain this in simple plain English. Return only the explanation:', icon: '💡' },
  { label: 'Action items',    prompt: 'Extract action items as a markdown checklist using - [ ] syntax. Return only the checklist:', icon: '☑️' },
]

function AIFormattingToolbar() {
  const editor = useBlockNoteEditor()
  const [aiOpen, setAiOpen] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeLabel, setActiveLabel] = useState('')
  // Store the saved selection range so blur doesn't lose it
  const savedRangeRef = useRef<Range | null>(null)

  // Save selection on mousedown of the AI button (before blur fires)
  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const getSavedText = (): string => {
    if (!savedRangeRef.current) return ''
    return savedRangeRef.current.toString().trim()
  }

  const replaceWithBlocks = useCallback((resultText: string) => {
    try {
      // Get cursor block from editor
      const cursorPos = editor.getTextCursorPosition()
      if (!cursorPos?.block) return

      const blockId = cursorPos.block.id
      const blocks = markdownToBlocks(resultText)

      if (blocks.length === 0) return

      const [first, ...rest] = blocks
      editor.updateBlock(blockId as any, first)
      if (rest.length > 0) {
        editor.insertBlocks(rest as any, blockId as any, 'after')
      }
    } catch {
      // Fallback: just paste as paragraph
      const sel = window.getSelection()
      if (sel && savedRangeRef.current) {
        sel.removeAllRanges()
        sel.addRange(savedRangeRef.current)
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(resultText))
      }
    }
  }, [editor])

  const runSkill = async (prompt: string, label: string) => {
    const text = getSavedText()
    if (!text) { toast.error('Select some text first'); return }
    setLoading(true)
    setActiveLabel(label)
    try {
      const result = await callAI(prompt, text)
      replaceWithBlocks(result)
      toast.success(`✦ ${label} applied!`)
    } catch { toast.error('AI request failed') }
    setLoading(false)
    setActiveLabel('')
    setAiOpen(false)
    savedRangeRef.current = null
  }

  const runCustom = async () => {
    if (!customPrompt.trim()) return
    const text = getSavedText()
    if (!text) { toast.error('Select some text first'); return }
    setLoading(true)
    try {
      const result = await callAI(customPrompt, text)
      replaceWithBlocks(result)
      toast.success('✦ Done!')
    } catch { toast.error('AI request failed') }
    setLoading(false)
    setShowCustom(false)
    setCustomPrompt('')
    setAiOpen(false)
    savedRangeRef.current = null
  }

  return (
    <div className="relative flex items-center" onMouseDown={e => e.stopPropagation()}>
      <button
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); saveSelection(); setAiOpen(v => !v) }}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-violet-400 hover:bg-violet-500/15 transition-colors disabled:opacity-50 border border-violet-500/20"
        title="AI Writing Tools (select text first)"
      >
        <span className="text-[11px]">✦</span>
        <span>{loading ? activeLabel + '…' : 'AI'}</span>
        {loading && (
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        )}
      </button>

      {aiOpen && !loading && (
        <div
          className="absolute bottom-full left-0 mb-1 w-52 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl py-1.5 text-[13px]"
          style={{ zIndex: 99999 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <p className="px-3 py-1 text-[10px] text-[#555] uppercase tracking-wider">AI Skills</p>
          {AI_SKILLS.map(skill => (
            <button
              key={skill.label}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); runSkill(skill.prompt, skill.label) }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-violet-500/10 text-[#e5e5e5] text-[13px] rounded-md transition-colors"
            >
              <span className="text-[12px] w-4 shrink-0">{skill.icon}</span>
              <span>{skill.label}</span>
            </button>
          ))}
          <div className="h-px bg-[#2a2a2a] my-1" />
          {!showCustom ? (
            <button
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setShowCustom(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-violet-500/10 text-violet-400 rounded-md text-[13px]"
            >
              <span>✎</span><span>Custom prompt</span>
            </button>
          ) : (
            <div className="px-2 pb-1.5" onMouseDown={e => e.stopPropagation()}>
              <input
                autoFocus
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') runCustom(); if (e.key === 'Escape') setShowCustom(false) }}
                placeholder="Tell AI what to do…"
                className="w-full bg-[#111] border border-[#333] rounded-lg px-2.5 py-1.5 text-[12px] text-[#ccc] placeholder-[#444] outline-none focus:border-violet-500/50"
              />
              <div className="flex gap-1 mt-1">
                <button onMouseDown={e => { e.preventDefault(); runCustom() }} className="flex-1 text-[11px] py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white">Apply</button>
                <button onMouseDown={e => { e.preventDefault(); setShowCustom(false) }} className="px-2 text-[11px] py-1 rounded-md bg-[#2a2a2a] text-[#aaa]">✕</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

const TURN_INTO_TYPES = [
  { label: 'Text',          icon: 'T',  type: 'paragraph'       },
  { label: 'Heading 1',     icon: 'H₁', type: 'heading', level: 1 },
  { label: 'Heading 2',     icon: 'H₂', type: 'heading', level: 2 },
  { label: 'Heading 3',     icon: 'H₃', type: 'heading', level: 3 },
  { label: 'Bullet list',   icon: '•',  type: 'bulletListItem'  },
  { label: 'Numbered list', icon: '1.', type: 'numberedListItem'},
  { label: 'To-do list',    icon: '☐',  type: 'checkListItem'   },
  { label: 'Quote',         icon: '"',  type: 'quote'           },
  { label: 'Code',          icon: '</>', type: 'codeBlock'       },
]

const COLOR_OPTIONS = [
  { label: 'Default', value: 'default', hex: '#e5e5e5' },
  { label: 'Red',     value: 'red',     hex: '#f87171' },
  { label: 'Orange',  value: 'orange',  hex: '#fb923c' },
  { label: 'Yellow',  value: 'yellow',  hex: '#fbbf24' },
  { label: 'Green',   value: 'green',   hex: '#4ade80' },
  { label: 'Blue',    value: 'blue',    hex: '#60a5fa' },
  { label: 'Purple',  value: 'purple',  hex: '#c084fc' },
  { label: 'Gray',    value: 'gray',    hex: '#9ca3af' },
]

const AI_CTX_ACTIONS = [
  { label: 'Improve writing',  icon: '✨', prompt: 'Improve the writing quality. Return only the improved text:' },
  { label: 'Summarize',        icon: '📝', prompt: 'Summarize concisely in 2-3 sentences. Return only the summary:' },
  { label: 'Make shorter',     icon: '✂️', prompt: 'Make more concise without losing meaning. Return only the result:' },
  { label: 'Make longer',      icon: '📖', prompt: 'Expand with more detail. Return only the result:' },
  { label: 'Fix grammar',      icon: '🔍', prompt: 'Fix all grammar, spelling, punctuation. Return only the corrected text:' },
  { label: 'Action items',     icon: '☑️', prompt: 'Extract action items as - [ ] checklist. Return only the checklist:' },
  { label: 'Explain simply',   icon: '💡', prompt: 'Explain in simple terms. Return only the explanation:' },
  { label: 'Translate to EN',  icon: '🌐', prompt: 'Translate to English. Return only the translation:' },
]

interface ContextMenuProps {
  blockId: string
  editor: typeof schema.BlockNoteEditor
  position: { x: number; y: number }
  onClose: () => void
}

function BlockContextMenu({ blockId, editor, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState<'turnInto' | 'color' | 'ai' | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [activeAI, setActiveAI] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    document.addEventListener('keydown', keyHandler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler) }
  }, [onClose])

  const menuW = 230, menuH = 520
  const x = Math.min(Math.max(position.x, 8), window.innerWidth - menuW - 8)
  const y = Math.min(Math.max(position.y, 8), window.innerHeight - menuH - 8)

  const getBlockText = (): string => {
    try {
      const block = (editor.document as any[]).find((b: any) => b.id === blockId)
      return getBlockPlainText(block)
    } catch { return '' }
  }

  const turnInto = (type: string, level?: number) => {
    try {
      if (type === 'heading') {
        editor.updateBlock(blockId as any, { type: 'heading', props: { level: level || 1 } } as any)
      } else {
        editor.updateBlock(blockId as any, { type } as any)
      }
    } catch { toast.error('Cannot convert this block type') }
    onClose()
  }

  const duplicate = () => {
    try {
      const block = (editor.document as any[]).find((b: any) => b.id === blockId)
      if (block) editor.insertBlocks([{ ...block, id: undefined }] as any, blockId as any, 'after')
      toast.success('Duplicated')
    } catch { }
    onClose()
  }

  const deleteBlock = () => {
    try { editor.removeBlocks([blockId] as any) } catch { }
    onClose()
  }

  const copyText = () => {
    const text = getBlockText()
    if (!text) { toast('No text to copy'); return }
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'))
    onClose()
  }

  const insertBelow = () => {
    try { editor.insertBlocks([{ type: 'paragraph', content: [] }] as any, blockId as any, 'after') } catch { }
    onClose()
  }

  const runAI = async (label: string, prompt: string) => {
    const text = getBlockText()
    if (!text.trim()) { toast.error('Block has no text'); onClose(); return }
    setAiLoading(true)
    setActiveAI(label)
    try {
      const result = await callAI(prompt, text)
      applyAIResultToEditor(editor, blockId, result)
      toast.success(`✦ ${label} done!`)
    } catch { toast.error('AI request failed') }
    setAiLoading(false)
    setActiveAI('')
    onClose()
  }

  const Row = ({ icon, label, shortcut, onClick, danger = false, hasSub = false }: any) => (
    <button
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onClick?.() }}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[13px] rounded-md transition-colors ${danger ? 'hover:bg-red-500/15 text-red-400' : 'hover:bg-white/8 text-[#e5e5e5]'}`}
    >
      <span className="w-4 text-center text-[11px] text-[#888] shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-[#555] font-mono">{shortcut}</span>}
      {hasSub && <span className="text-[#555] ml-1 text-xs">›</span>}
    </button>
  )

  const allActions = [
    { icon: '↺',  label: 'Turn into',    onClick: () => setSub('turnInto'), hasSub: true },
    { icon: 'A',  label: 'Color',         onClick: () => setSub('color'),   hasSub: true },
    { icon: '✦',  label: 'AI actions',   onClick: () => setSub('ai'),       hasSub: true },
    { icon: '⊕',  label: 'Insert below', onClick: insertBelow },
    { icon: '⧉',  label: 'Copy text',    onClick: copyText },
    { icon: '⧉',  label: 'Duplicate',    onClick: duplicate },
    { icon: '🗑',  label: 'Delete',       onClick: deleteBlock, danger: true },
  ]

  const filtered = search
    ? allActions.filter(a => a.label.toLowerCase().includes(search.toLowerCase()))
    : null

  return (
    <div ref={menuRef} style={{ position: 'fixed', left: x, top: y, zIndex: 99999 }} onMouseDown={e => e.stopPropagation()}>
      <div className="w-[230px] rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl shadow-black/60 py-1.5 overflow-visible">

        {/* Search */}
        <div className="px-2.5 pb-1.5">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search actions…"
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[12px] text-[#ccc] placeholder-[#444] outline-none focus:border-[#444]"
            onMouseDown={e => e.stopPropagation()}
          />
        </div>
        <div className="h-px bg-[#2a2a2a] mb-1" />

        {filtered ? (
          <>
            {filtered.length === 0 && <p className="px-3 py-2 text-[12px] text-[#555] text-center">No actions found</p>}
            {filtered.map(a => <Row key={a.label} {...a} />)}
          </>
        ) : (
          <>
            {/* Turn into */}
            <div className="relative">
              <Row icon="↺" label="Turn into" hasSub onClick={() => setSub(sub === 'turnInto' ? null : 'turnInto')} />
              {sub === 'turnInto' && (
                <div className="absolute left-full top-0 ml-1 w-44 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl py-1.5" style={{ zIndex: 100000 }}>
                  {TURN_INTO_TYPES.map(t => (
                    <button key={t.label}
                      onMouseDown={e => { e.preventDefault(); turnInto(t.type, (t as any).level) }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/8 text-[#e5e5e5] text-[13px] rounded-md"
                    >
                      <span className="w-5 text-center text-[11px] text-[#888] font-mono">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color */}
            <div className="relative">
              <Row icon="A" label="Color" hasSub onClick={() => setSub(sub === 'color' ? null : 'color')} />
              {sub === 'color' && (
                <div className="absolute left-full top-0 ml-1 w-48 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl py-1.5" style={{ zIndex: 100000 }}>
                  <p className="px-3 py-1 text-[10px] text-[#555] uppercase tracking-wider">Text color</p>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                    {COLOR_OPTIONS.map(c => (
                      <button key={c.value} title={c.label}
                        onMouseDown={e => {
                          e.preventDefault()
                          try { editor.updateBlock(blockId as any, { props: { textColor: c.value } } as any) } catch { }
                          onClose()
                        }}
                        style={{ width: 22, height: 22, borderRadius: 4, background: c.hex, border: '2px solid #444', cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                  <p className="px-3 py-1 text-[10px] text-[#555] uppercase tracking-wider">Background</p>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                    {COLOR_OPTIONS.map(c => (
                      <button key={`bg-${c.value}`} title={`${c.label} bg`}
                        onMouseDown={e => {
                          e.preventDefault()
                          try { editor.updateBlock(blockId as any, { props: { backgroundColor: c.value } } as any) } catch { }
                          onClose()
                        }}
                        style={{ width: 22, height: 22, borderRadius: 4, background: c.hex + '55', border: `2px solid ${c.hex}`, cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI Actions */}
            <div className="relative">
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setSub(sub === 'ai' ? null : 'ai') }}
                disabled={aiLoading}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-violet-500/10 text-violet-400 rounded-md disabled:opacity-50"
              >
                <span className="w-4 text-center text-[11px]">✦</span>
                <span className="flex-1">{aiLoading ? activeAI + '…' : 'AI actions'}</span>
                {aiLoading
                  ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  : <span className="text-[#555] text-xs">›</span>}
              </button>
              {sub === 'ai' && !aiLoading && (
                <div className="absolute left-full top-0 ml-1 w-52 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl py-1.5" style={{ zIndex: 100000 }}>
                  <p className="px-3 py-1 text-[10px] text-[#555] uppercase tracking-wider">AI Actions</p>
                  {AI_CTX_ACTIONS.map(action => (
                    <button key={action.label}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); runAI(action.label, action.prompt) }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-violet-500/10 text-[#e5e5e5] text-[13px] rounded-md"
                    >
                      <span className="text-[12px] shrink-0">{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-[#2a2a2a] my-1" />
            <Row icon="⊕"  label="Insert below" onClick={insertBelow} />
            <Row icon="⧉"  label="Copy text"    onClick={copyText} />
            <Row icon="⧉"  label="Duplicate"    onClick={duplicate} />
            <div className="h-px bg-[#2a2a2a] my-1" />
            <Row icon="🗑"  label="Delete"       onClick={deleteBlock} danger />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Editor Props ─────────────────────────────────────────────────────────────

interface EditorProps {
  initialContent?: Block[] | null
  onChange?: (content: Block[]) => void
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function Editor({ initialContent, onChange }: EditorProps) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent && initialContent.length > 0
      ? (initialContent as typeof schema.Block[])
      : undefined,
    uploadFile: uploadToSupabase,
  })

  const changeRef = useRef(onChange)
  changeRef.current = onChange

  const [contextMenu, setContextMenu] = useState<{ blockId: string; position: { x: number; y: number } } | null>(null)

  // ── YouTube paste ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')?.trim()
      if (!text || !isYouTubeUrl(text)) return
      e.preventDefault()
      insertOrUpdateBlock(editor as any, { type: 'youtube', props: { url: text } } as any)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [editor])

  // ── Content change ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const unsub = editor.onChange(() => { changeRef.current?.(editor.document as Block[]) })
    return () => unsub?.()
  }, [editor])

  // ── Right-click context menu ──────────────────────────────────────────────
  useEffect(() => {
    const getBlockId = (target: HTMLElement): string | null => {
      let el: HTMLElement | null = target
      // Walk up DOM looking for block id attribute
      while (el && el !== document.body) {
        const id = el.dataset?.id || el.dataset?.nodeId || el.dataset?.blockId
        if (id) return id
        // BlockNote uses data-id on outer block divs
        if (el.hasAttribute('data-id')) return el.getAttribute('data-id')
        el = el.parentElement
      }
      // Final fallback: editor cursor position
      try { return (editor as any)?.getTextCursorPosition?.()?.block?.id || null } catch { return null }
    }

    const handleContextMenu = (e: MouseEvent) => {
      const editorEl = document.getElementById('bn-editor-focus')
      if (!editorEl?.contains(e.target as Node)) return
      e.preventDefault()
      const blockId = getBlockId(e.target as HTMLElement)
      if (!blockId) return
      setContextMenu({ blockId, position: { x: e.clientX, y: e.clientY } })
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [editor])

  // ── Ctrl+J shortcut to open context menu ─────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault()
        const block = editor?.getTextCursorPosition()?.block
        if (!block) return
        const el = document.querySelector(`[data-id="${block.id}"]`) as HTMLElement | null
        const rect = el?.getBoundingClientRect()
        setContextMenu({ blockId: block.id, position: { x: rect?.left ?? 200, y: (rect?.bottom ?? 200) + 8 } })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editor])

  return (
    <>
      <div id="bn-editor-focus" tabIndex={-1}>
        <BlockNoteView
          editor={editor}
          theme="dark"
          slashMenu={false}
          formattingToolbar={false}
          sideMenu={false}
        >
          {/* Formatting toolbar + AI button */}
          <FormattingToolbarController
            formattingToolbar={() => (
              <FormattingToolbar>
                <AIFormattingToolbar />
              </FormattingToolbar>
            )}
          />

          {/* Side menu */}
          <SideMenuController
            sideMenu={props => (
              <SideMenu {...props}>
                <AddBlockButton {...props} />
                <DragHandleButton {...props} dragHandleMenu={() => <div style={{ display: 'none' }} />} />
              </SideMenu>
            )}
          />

          {/* Slash menu with all block types */}
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async query =>
              filterSuggestionItems(
                [
                  ...getDefaultReactSlashMenuItems(editor),
                  insertTableItem(editor),
                  insertDividerItem(editor),
                  insertYouTubeItem(editor),
                  insertCalloutItem(editor, 'info'),
                  insertCalloutItem(editor, 'warning'),
                  insertCalloutItem(editor, 'success'),
                  insertCalloutItem(editor, 'error'),
                  insertCalloutItem(editor, 'tip'),
                ],
                query
              )
            }
            suggestionMenuComponent={NotionSlashMenu}
          />
        </BlockNoteView>
      </div>

      {contextMenu && (
        <BlockContextMenu
          blockId={contextMenu.blockId}
          editor={editor as any}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
