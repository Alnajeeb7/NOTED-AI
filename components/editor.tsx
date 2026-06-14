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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
        setTimeout(() => {
          const empties = (editor.document as any[]).filter(
            (b: any) => b.type === 'youtube' && !b.props?.url && b.id !== block.id
          )
          if (empties.length) editor.removeBlocks(empties.map((b: any) => b.id) as any)
        }, 100)
      }

      if (!block.props.url || !videoId) {
        return (
          <div contentEditable={false} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0' }}>
            <input
              autoFocus
              value={inputUrl}
              placeholder="Paste YouTube URL and press Enter..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1.5px solid #333', background: '#1a1a1a', color: '#e5e5e5', fontSize: 13, outline: 'none' }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setInputUrl(e.target.value)}
              onPaste={(e) => {
                e.stopPropagation()
                const val = e.clipboardData.getData('text/plain').trim()
                if (extractYouTubeId(val)) { e.preventDefault(); submit(val) }
              }}
              onKeyDown={(e) => {
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

// ─── Video Block ──────────────────────────────────────────────────────────────

const VideoBlock = createReactBlockSpec(
  { type: 'video' as const, propSchema: { url: { default: '' }, name: { default: '' } }, content: 'none' },
  {
    render: ({ block }) => {
      const [uploading, setUploading] = useState(false)
      if (!block.props.url) {
        return (
          <div contentEditable={false}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: uploading ? 'not-allowed' : 'pointer', padding: '12px 16px', borderRadius: 8, border: '1.5px dashed #d1d5db', background: '#fafafa', fontSize: 13, color: '#6b7280', opacity: uploading ? 0.6 : 1 }}>
              <span style={{ fontSize: 18 }}>🎬</span>
              <span>{uploading ? 'Uploading…' : 'Click to upload video (mp4, webm — max 100 MB)'}</span>
              <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" style={{ display: 'none' }} disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  try {
                    const fd = new FormData()
                    fd.append('file', file)
                    const res = await fetch('/api/upload', { method: 'POST', body: fd })
                    if (!res.ok) throw new Error('Upload failed')
                    const { url } = await res.json()
                    window.dispatchEvent(new CustomEvent('video-uploaded', { detail: { url, name: file.name, blockId: block.id } }))
                  } catch { alert('Video upload failed.') }
                  finally { setUploading(false) }
                }}
              />
            </label>
          </div>
        )
      }
      return (
        <div contentEditable={false} style={{ width: '100%', margin: '4px 0' }}>
          <video controls style={{ width: '100%', borderRadius: 8, maxHeight: 480, background: '#000' }} src={block.props.url} />
          {block.props.name && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{block.props.name}</p>}
        </div>
      )
    },
    toExternalHTML: ({ block }) => <div><a href={block.props.url}>{block.props.name || block.props.url}</a></div>,
  }
)

// ─── Divider Block ────────────────────────────────────────────────────────────

const DividerBlock = createReactBlockSpec(
  { type: 'divider' as const, propSchema: { style: { default: 'solid' } }, content: 'none' },
  {
    render: ({ block }) => (
      <div contentEditable={false} style={{ padding: '8px 0', userSelect: 'none' }}>
        <hr style={{
          border: 'none',
          borderTop: block.props.style === 'dashed' ? '1.5px dashed rgba(255,255,255,0.15)' : block.props.style === 'dotted' ? '2px dotted rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.12)',
          margin: 0,
        }} />
      </div>
    ),
    toExternalHTML: () => <hr />,
  }
)

// ─── Callout Block ────────────────────────────────────────────────────────────

const CALLOUT_TYPES = {
  info:    { emoji: 'ℹ️', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)' },
  warning: { emoji: '⚠️', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)' },
  success: { emoji: '✅', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)'  },
  error:   { emoji: '❌', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)'  },
  tip:     { emoji: '💡', bg: 'rgba(168,85,247,0.10)', border: 'rgba(168,85,247,0.25)' },
}

const CalloutBlock = createReactBlockSpec(
  {
    type: 'callout' as const,
    propSchema: {
      emoji: { default: 'ℹ️' },
      kind: { default: 'info' },
      text: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const kind = (block.props.kind as keyof typeof CALLOUT_TYPES) || 'info'
      const cfg = CALLOUT_TYPES[kind] || CALLOUT_TYPES.info
      const [editing, setEditing] = useState(false)
      const [text, setText] = useState(block.props.text || '')

      const save = () => {
        editor.updateBlock(block.id, { props: { ...block.props, text } } as any)
        setEditing(false)
      }

      return (
        <div
          contentEditable={false}
          style={{
            display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8,
            background: cfg.bg, border: `1px solid ${cfg.border}`, margin: '2px 0',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: '24px', flexShrink: 0 }}>{cfg.emoji}</span>
          <div style={{ flex: 1 }}>
            {editing ? (
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } if (e.key === 'Escape') setEditing(false) }}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.6, resize: 'none', fontFamily: 'inherit' }}
                rows={2}
              />
            ) : (
              <p
                onClick={() => setEditing(true)}
                style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: text ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', cursor: 'text', minHeight: 24 }}
              >
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

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    youtube: YouTubeBlock,
    video: VideoBlock,
    divider: DividerBlock,
    callout: CalloutBlock,
  },
})

async function uploadToSupabase(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Upload failed') }
  const { url } = await res.json()
  return url
}

// ─── Slash Menu Items ─────────────────────────────────────────────────────────

const insertVideoItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: 'Video',
  subtext: 'Upload or embed a video file',
  onItemClick: () => { insertOrUpdateBlock(editor as any, { type: 'video', props: { url: '', name: '' } } as any) },
  aliases: ['video', 'mp4', 'webm', 'film', 'media', 'upload'],
  group: 'Media',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>
    </svg>
  ),
})

const insertYouTubeItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: 'YouTube',
  subtext: 'Embed a YouTube video',
  onItemClick: () => { insertOrUpdateBlock(editor as any, { type: 'youtube', props: { url: '' } } as any) },
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
  subtext: 'Visual separator between blocks',
  onItemClick: () => { insertOrUpdateBlock(editor as any, { type: 'divider', props: { style: 'solid' } } as any) },
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
  const labels: Record<string, string> = { info: 'Info callout', warning: 'Warning callout', success: 'Success callout', error: 'Error callout', tip: 'Tip callout' }
  return {
    title: labels[kind],
    subtext: `${cfg.emoji} Highlighted callout block`,
    onItemClick: () => {
      insertOrUpdateBlock(editor as any, {
        type: 'callout',
        props: { kind, emoji: cfg.emoji, text: '' },
      } as any)
    },
    aliases: ['callout', kind, 'note', 'alert', cfg.emoji],
    group: 'Advanced',
    icon: <span style={{ fontSize: 16 }}>{cfg.emoji}</span>,
  }
}

const insertTableItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: 'Table',
  subtext: 'Insert a structured table',
  onItemClick: () => { insertOrUpdateBlock(editor as any, { type: 'table' } as any) },
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

// ─── AI helper ────────────────────────────────────────────────────────────────

async function callAI(prompt: string, text: string): Promise<string> {
  const res = await fetch('/api/ai-inline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, text }),
  })
  if (!res.ok) throw new Error('AI request failed')
  const data = await res.json()
  return data.content || ''
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  blockId: string
  editor: typeof schema.BlockNoteEditor
  position: { x: number; y: number }
  onClose: () => void
}

const TURN_INTO_TYPES = [
  { label: 'Text',           icon: 'T',   type: 'paragraph'        },
  { label: 'Heading 1',      icon: 'H₁',  type: 'heading', level: 1 },
  { label: 'Heading 2',      icon: 'H₂',  type: 'heading', level: 2 },
  { label: 'Heading 3',      icon: 'H₃',  type: 'heading', level: 3 },
  { label: 'Bullet list',    icon: '•',   type: 'bulletListItem'   },
  { label: 'Numbered list',  icon: '1.',  type: 'numberedListItem' },
  { label: 'To-do list',     icon: '☐',   type: 'checkListItem'    },
  { label: 'Toggle list',    icon: '▶',   type: 'toggleListItem'   },
  { label: 'Code',           icon: '</>',  type: 'codeBlock'        },
  { label: 'Quote',          icon: '"',   type: 'quote'            },
]

const COLORS = [
  { label: 'Default', color: 'default', bg: undefined      },
  { label: 'Gray',    color: 'gray',    bg: '#9ca3af'      },
  { label: 'Red',     color: 'red',     bg: '#f87171'      },
  { label: 'Orange',  color: 'orange',  bg: '#fb923c'      },
  { label: 'Yellow',  color: 'yellow',  bg: '#fbbf24'      },
  { label: 'Green',   color: 'green',   bg: '#4ade80'      },
  { label: 'Blue',    color: 'blue',    bg: '#60a5fa'      },
  { label: 'Purple',  color: 'purple',  bg: '#c084fc'      },
  { label: 'Pink',    color: 'pink',    bg: '#f472b6'      },
]

// All context menu AI actions
const AI_CONTEXT_ACTIONS = [
  { label: 'Improve writing',  icon: '✨', prompt: 'Improve the writing quality of this text, making it clearer and more polished:' },
  { label: 'Summarize',        icon: '📝', prompt: 'Summarize this text concisely in 1-2 sentences:' },
  { label: 'Make it shorter',  icon: '✂️', prompt: 'Make this text more concise without losing meaning:' },
  { label: 'Make it longer',   icon: '📖', prompt: 'Expand this text with more detail and depth:' },
  { label: 'Fix grammar',      icon: '🔍', prompt: 'Fix all grammar, spelling, and punctuation errors in this text:' },
  { label: 'Translate to EN',  icon: '🌐', prompt: 'Translate this text to English:' },
  { label: 'Add action items', icon: '☑️', prompt: 'Extract and list action items from this text as - [ ] checkboxes:' },
  { label: 'Explain simply',   icon: '💡', prompt: 'Explain this text in simple, easy-to-understand terms:' },
]

function BlockContextMenu({ blockId, editor, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState<'turnInto' | 'color' | 'ai' | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [activeAiLabel, setActiveAiLabel] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Close on outside click or Escape
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  // Smart position: clamp to viewport
  const menuW = 224
  const menuH = 480
  const x = Math.min(Math.max(position.x, 8), window.innerWidth - menuW - 8)
  const y = Math.min(Math.max(position.y, 8), window.innerHeight - menuH - 8)
  const style: React.CSSProperties = { position: 'fixed', left: x, top: y, zIndex: 99999 }

  const getBlockText = () => {
    try {
      const block = (editor.document as any[]).find((b: any) => b.id === blockId)
      if (!block) return ''
      return block.content?.map((c: any) => c.text || '').join('') || ''
    } catch { return '' }
  }

  const turnInto = (type: string, level?: number) => {
    try {
      if (type === 'heading') {
        editor.updateBlock(blockId as any, { type: 'heading', props: { level: level || 1 } } as any)
      } else {
        editor.updateBlock(blockId as any, { type } as any)
      }
    } catch { /* ignore unsupported block types */ }
    onClose()
  }

  const copyLink = () => {
    const url = `${window.location.href.split('#')[0]}#block-${blockId}`
    navigator.clipboard.writeText(url).then(() => toast.success('Block link copied!'))
    onClose()
  }

  const copyText = () => {
    const text = getBlockText()
    if (!text) { toast('Block has no text'); return }
    navigator.clipboard.writeText(text).then(() => toast.success('Text copied!'))
    onClose()
  }

  const duplicate = () => {
    try {
      const block = (editor.document as any[]).find((b: any) => b.id === blockId)
      if (block) editor.insertBlocks([{ ...block, id: undefined }] as any, blockId as any, 'after')
      toast.success('Block duplicated')
    } catch { }
    onClose()
  }

  const deleteBlock = () => {
    try { editor.removeBlocks([blockId] as any) } catch { }
    onClose()
  }

  const insertBelow = () => {
    try {
      editor.insertBlocks([{ type: 'paragraph', content: [] }] as any, blockId as any, 'after')
    } catch { }
    onClose()
  }

  const runAI = async (label: string, prompt: string) => {
    const text = getBlockText()
    if (!text.trim()) { toast('Block has no text'); onClose(); return }
    setAiLoading(true)
    setActiveAiLabel(label)
    try {
      const result = await callAI(prompt, text)
      editor.updateBlock(blockId as any, {
        content: [{ type: 'text', text: result, styles: {} }],
      } as any)
      toast.success(`✦ ${label} done!`)
    } catch { toast.error('AI request failed') }
    setAiLoading(false)
    setActiveAiLabel('')
    onClose()
  }

  // Filtered top-level items for search
  const allTopItems = [
    { icon: '↺',  label: 'Turn into',     action: () => setSub(sub === 'turnInto' ? null : 'turnInto'), hasSub: true },
    { icon: 'A',  label: 'Color',          action: () => setSub(sub === 'color' ? null : 'color'),       hasSub: true },
    { icon: '✦',  label: 'AI actions',     action: () => setSub(sub === 'ai' ? null : 'ai'),             hasSub: true },
    { icon: '⊕',  label: 'Insert below',   action: insertBelow  },
    { icon: '🔗',  label: 'Copy link',      action: copyLink     },
    { icon: '⧉',  label: 'Copy text',      action: copyText     },
    { icon: '⧉',  label: 'Duplicate',      action: duplicate    },
    { icon: '💬',  label: 'Comment',        action: () => { toast('Comments coming soon!'); onClose() } },
    { icon: '🗑',  label: 'Delete',         action: deleteBlock, danger: true },
  ]

  const filtered = searchQuery
    ? allTopItems.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : allTopItems

  const menuItem = (
    icon: React.ReactNode,
    label: string,
    shortcut?: string,
    onClick?: () => void,
    danger = false,
    hasSub = false
  ) => (
    <button
      key={label}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.() }}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[13px] rounded-md transition-colors ${danger ? 'hover:bg-red-500/15 text-red-400' : 'hover:bg-white/8 text-[#e5e5e5]'}`}
    >
      <span className="w-4 text-center text-[11px] text-[#888] shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-[#555] font-mono">{shortcut}</span>}
      {hasSub && <span className="text-[#555] text-xs ml-1">›</span>}
    </button>
  )

  return (
    <div ref={menuRef} style={style} onMouseDown={(e) => e.stopPropagation()}>
      <div className="w-56 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl shadow-black/60 overflow-visible py-1.5 text-[13px]">

        {/* Search bar */}
        <div className="px-2.5 pb-1.5">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search actions…"
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[12px] text-[#ccc] placeholder-[#444] outline-none focus:border-[#444]"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        <div className="h-px bg-[#2a2a2a] my-1" />

        {/* If searching, show flat filtered list */}
        {searchQuery ? (
          <div>
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-[#555] text-center">No actions found</p>
            )}
            {filtered.map((item) => menuItem(item.icon, item.label, undefined, item.action, item.danger, item.hasSub))}
          </div>
        ) : (
          <>
            {/* Turn into */}
            <div className="relative">
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSub(sub === 'turnInto' ? null : 'turnInto') }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/8 text-[#e5e5e5] rounded-md"
              >
                <span className="w-4 text-center text-[11px] text-[#888]">↺</span>
                <span className="flex-1">Turn into</span>
                <span className="text-[#555] text-xs">›</span>
              </button>
              {sub === 'turnInto' && (
                <div className="absolute left-full top-0 ml-1 w-44 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl py-1.5" style={{ zIndex: 100000 }}>
                  {TURN_INTO_TYPES.map((t) => (
                    <button
                      key={t.label}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); turnInto(t.type, (t as any).level) }}
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
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSub(sub === 'color' ? null : 'color') }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/8 text-[#e5e5e5] rounded-md"
              >
                <span className="w-4 text-center text-[11px] text-[#888]">A</span>
                <span className="flex-1">Color</span>
                <span className="text-[#555] text-xs">›</span>
              </button>
              {sub === 'color' && (
                <div className="absolute left-full top-0 ml-1 w-48 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl py-1.5" style={{ zIndex: 100000 }}>
                  <p className="px-3 py-1 text-[10px] text-[#555] uppercase tracking-wider">Text color</p>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.label}
                        title={c.label}
                        onMouseDown={(e) => {
                          e.preventDefault(); e.stopPropagation()
                          try {
                            editor.updateBlock(blockId as any, { props: { textColor: c.color } } as any)
                            toast.success(`Text: ${c.label}`, { duration: 1000 })
                          } catch { toast.error('Color not supported here') }
                          onClose()
                        }}
                        style={{ width: 22, height: 22, borderRadius: 4, background: c.bg || '#e5e5e5', border: '2px solid #444', cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                  <p className="px-3 py-1 text-[10px] text-[#555] uppercase tracking-wider">Background</p>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                    {COLORS.map((c) => (
                      <button
                        key={`bg-${c.label}`}
                        title={`${c.label} background`}
                        onMouseDown={(e) => {
                          e.preventDefault(); e.stopPropagation()
                          try {
                            editor.updateBlock(blockId as any, { props: { backgroundColor: c.color } } as any)
                            toast.success(`Background: ${c.label}`, { duration: 1000 })
                          } catch { toast.error('Color not supported here') }
                          onClose()
                        }}
                        style={{ width: 22, height: 22, borderRadius: 4, background: c.bg ? c.bg + '55' : '#2a2a2a', border: `2px solid ${c.bg || '#444'}`, cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI Actions submenu */}
            <div className="relative">
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSub(sub === 'ai' ? null : 'ai') }}
                disabled={aiLoading}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-violet-500/10 text-violet-400 rounded-md disabled:opacity-50"
              >
                <span className="w-4 text-center text-[11px]">✦</span>
                <span className="flex-1">{aiLoading ? `${activeAiLabel}…` : 'AI actions'}</span>
                {aiLoading
                  ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  : <span className="text-[#555] text-xs">›</span>
                }
              </button>
              {sub === 'ai' && !aiLoading && (
                <div className="absolute left-full top-0 ml-1 w-52 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-2xl py-1.5" style={{ zIndex: 100000 }}>
                  <p className="px-3 py-1 text-[10px] text-[#555] uppercase tracking-wider">AI Actions</p>
                  {AI_CONTEXT_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); runAI(action.label, action.prompt) }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-violet-500/10 text-[#e5e5e5] text-[13px] rounded-md transition-colors"
                    >
                      <span className="text-[12px] shrink-0">{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                  <div className="h-px bg-[#2a2a2a] my-1" />
                  <p className="px-3 py-1 text-[10px] text-[#444]">Ctrl+J to open here</p>
                </div>
              )}
            </div>

            <div className="h-px bg-[#2a2a2a] my-1" />

            {menuItem('⊕',  'Insert below',  undefined, insertBelow)}
            {menuItem('🔗', 'Copy link',      'Alt+⇧+L', copyLink)}
            {menuItem('⧉',  'Copy text',      'Ctrl+C',  copyText)}
            {menuItem('⧉',  'Duplicate',      'Ctrl+D',  duplicate)}
            {menuItem('→',  'Move to',        undefined, () => { toast('Use drag & drop to move blocks'); onClose() })}

            <div className="h-px bg-[#2a2a2a] my-1" />

            {menuItem('💬', 'Comment',        'Ctrl+⇧+M', () => { toast('Comments coming soon!'); onClose() })}
            {menuItem('🗑', 'Delete',          'Del',      deleteBlock, true)}
          </>
        )}
      </div>
    </div>
  )
}

// ─── AI Formatting Toolbar ─────────────────────────────────────────────────────

const AI_SKILLS = [
  { label: 'Improve writing',  prompt: 'Improve the writing quality of this text, making it clearer and more polished:', icon: '✨' },
  { label: 'Proofread',        prompt: 'Fix all grammar, spelling, and punctuation errors in this text:', icon: '🔍' },
  { label: 'Summarize',        prompt: 'Summarize this text concisely in 2-3 sentences:', icon: '📝' },
  { label: 'Make shorter',     prompt: 'Make this text more concise without losing key meaning:', icon: '✂️' },
  { label: 'Explain simply',   prompt: 'Explain this text in simple, plain English terms:', icon: '💡', append: true },
  { label: 'Reformat',         prompt: 'Reformat this text with better structure using headings and bullet points:', icon: '⚙️' },
  { label: 'Add emoji',        prompt: 'Enhance this text by adding relevant emojis naturally throughout:', icon: '🎨' },
  { label: 'Action items',     prompt: 'Extract and list action items as - [ ] checkboxes:', icon: '☑️', append: true },
]

function AIFormattingToolbar() {
  const editor = useBlockNoteEditor()
  const [aiOpen, setAiOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSkill, setActiveSkill] = useState<string | null>(null)

  const getSelectedText = useCallback((): string => {
    const sel = window.getSelection()
    return sel?.toString().trim() || ''
  }, [])

  const replaceSelectedText = useCallback((newText: string) => {
    try {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(newText))
      sel.removeAllRanges()
    } catch {
      toast.error('Could not replace text')
    }
  }, [])

  const runSkill = async (prompt: string, label: string, append = false) => {
    const text = getSelectedText()
    if (!text) { toast('Select some text first'); return }
    setLoading(true)
    setActiveSkill(label)
    try {
      const result = await callAI(prompt, text)
      if (append) {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          range.collapse(false)
          const node = document.createTextNode('\n\n' + result)
          range.insertNode(node)
        }
      } else {
        replaceSelectedText(result)
      }
      toast.success(`✦ ${label} done!`)
    } catch { toast.error('AI request failed') }
    setLoading(false)
    setActiveSkill(null)
    setAiOpen(false)
  }

  const runEditWithAI = async () => {
    if (!editPrompt.trim()) return
    const text = getSelectedText()
    if (!text) { toast('Select some text first'); return }
    setLoading(true)
    try {
      const result = await callAI(editPrompt, text)
      replaceSelectedText(result)
      toast.success('✦ Done!')
    } catch { toast.error('AI request failed') }
    setLoading(false)
    setEditOpen(false)
    setEditPrompt('')
    setAiOpen(false)
  }

  return (
    <div className="flex items-center gap-0.5 relative" onMouseDown={(e) => e.stopPropagation()}>
      <div className="relative">
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setAiOpen((v) => !v); setEditOpen(false) }}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-violet-400 hover:bg-violet-500/15 transition-colors disabled:opacity-50 border border-violet-500/20"
          title="AI Writing Skills (select text first)"
        >
          <span className="text-[11px]">✦</span>
          <span>{loading ? (activeSkill?.split(' ')[0] + '…') : 'AI'}</span>
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
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="px-3 py-1 text-[10px] text-[#555] uppercase tracking-wider">AI Skills</p>
            {AI_SKILLS.map((skill) => (
              <button
                key={skill.label}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); runSkill(skill.prompt, skill.label, skill.append) }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-violet-500/10 text-[#e5e5e5] text-[13px] rounded-md transition-colors"
              >
                <span className="text-[12px] w-4 shrink-0">{skill.icon}</span>
                <span>{skill.label}</span>
              </button>
            ))}

            <div className="h-px bg-[#2a2a2a] my-1" />

            {/* Custom prompt */}
            <div className="px-2 pb-1.5">
              {!editOpen ? (
                <button
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditOpen(true) }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:bg-violet-500/10 text-violet-400 rounded-md text-[13px] transition-colors"
                >
                  <span className="text-[12px]">✎</span>
                  <span>Custom prompt</span>
                  <span className="ml-auto text-[10px] text-[#555] font-mono">Alt+⇧+E</span>
                </button>
              ) : (
                <div onMouseDown={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runEditWithAI(); if (e.key === 'Escape') setEditOpen(false) }}
                    placeholder="Tell AI what to do…"
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-2.5 py-1.5 text-[12px] text-[#ccc] placeholder-[#444] outline-none focus:border-violet-500/50"
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); runEditWithAI() }}
                      className="flex-1 text-[11px] py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                    >Apply</button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setEditOpen(false) }}
                      className="px-2 text-[11px] py-1 rounded-md bg-[#2a2a2a] hover:bg-[#333] text-[#aaa] transition-colors"
                    >✕</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
    ...groupOrder.filter((g) => grouped[g]),
    ...Object.keys(grouped).filter((g) => !groupOrder.includes(g)),
  ]

  return (
    <div
      className="notion-slash-menu"
      style={{
        background: '#191919',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        width: 310,
        maxHeight: 420,
        overflowY: 'auto',
        padding: '6px 0',
        zIndex: 9999,
      }}
    >
      {sortedGroups.map((group) => (
        <div key={group}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(255,255,255,0.28)',
            padding: '8px 14px 4px',
          }}>
            {group}
          </div>
          {grouped[group].map(({ item, flatIdx }) => {
            const isSelected = flatIdx === selectedIndex
            return (
              <button
                key={item.title}
                onMouseDown={(e) => { e.preventDefault(); onItemClick?.(item) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: 'calc(100% - 8px)',
                  padding: '5px 10px',
                  background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 6,
                  margin: '1px 4px',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  borderRadius: 6,
                  background: isSelected ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  color: isSelected ? '#a78bfa' : 'rgba(255,255,255,0.75)',
                  transition: 'all 0.1s',
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: isSelected ? '#fff' : 'rgba(255,255,255,0.88)',
                    lineHeight: 1.3,
                  }}>
                    {item.title}
                  </div>
                  {item.subtext && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.subtext}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ padding: '16px', fontSize: 13, color: 'rgba(255,255,255,0.28)', textAlign: 'center' }}>
          No results — try a different keyword
        </div>
      )}
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
    initialContent: initialContent && initialContent.length > 0 ? (initialContent as typeof schema.Block[]) : undefined,
    uploadFile: uploadToSupabase,
  })

  const changeRef = useRef(onChange)
  changeRef.current = onChange

  const [contextMenu, setContextMenu] = useState<{
    blockId: string
    position: { x: number; y: number }
  } | null>(null)

  // ── YouTube paste detection ───────────────────────────────────────────────
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

  // ── Video upload event ────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const handleVideoUploaded = (e: Event) => {
      const { url, name, blockId } = (e as CustomEvent).detail
      try { editor.updateBlock(blockId, { type: 'video', props: { url, name } } as any) } catch { }
    }
    window.addEventListener('video-uploaded', handleVideoUploaded)
    return () => window.removeEventListener('video-uploaded', handleVideoUploaded)
  }, [editor])

  // ── Content change ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const unsubscribe = editor.onChange(() => { changeRef.current?.(editor.document as Block[]) })
    return () => unsubscribe?.()
  }, [editor])

  // ── Right-click context menu ──────────────────────────────────────────────
  // Strategy: walk up the DOM from the target to find a block with [data-id].
  // Fall back to the cursor position if the DOM walk fails.
  useEffect(() => {
    const getBlockIdFromTarget = (target: HTMLElement): string | null => {
      let el: HTMLElement | null = target
      while (el && el !== document.body) {
        const id =
          el.dataset.id ||
          el.dataset.nodeId ||
          el.dataset.blockId ||
          (el.classList.contains('bn-block-outer') ? el.getAttribute('data-id') : null)
        if (id) return id
        el = el.parentElement
      }
      // Fallback: use editor cursor position
      try {
        const pos = (editor as any)?.getTextCursorPosition?.()
        return pos?.block?.id || null
      } catch { return null }
    }

    const handleContextMenu = (e: MouseEvent) => {
      const editorEl = document.getElementById('bn-editor-focus')
      if (!editorEl?.contains(e.target as Node)) return
      e.preventDefault()
      const blockId = getBlockIdFromTarget(e.target as HTMLElement)
      const finalId = blockId || (editor as any)?.getTextCursorPosition?.()?.block?.id
      if (!finalId) return
      setContextMenu({ blockId: finalId, position: { x: e.clientX, y: e.clientY } })
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [editor])

  // ── Ctrl+J → open AI context menu on cursor block ────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault()
        const block = editor?.getTextCursorPosition()?.block
        if (!block) return
        const el = document.querySelector(`[data-id="${block.id}"]`) as HTMLElement | null
        const rect = el?.getBoundingClientRect()
        setContextMenu({ blockId: block.id, position: { x: rect?.left || 200, y: (rect?.bottom || 200) + 8 } })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editor])

  // ── Slash menu keyboard: Escape closes context menu ───────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contextMenu) {
        setContextMenu(null)
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [contextMenu])

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
          {/* Formatting toolbar with AI skills */}
          <FormattingToolbarController
            formattingToolbar={() => (
              <FormattingToolbar>
                <AIFormattingToolbar />
              </FormattingToolbar>
            )}
          />

          {/* Side menu — drag handle only (context menu via right-click) */}
          <SideMenuController
            sideMenu={(props) => (
              <SideMenu {...props}>
                <AddBlockButton {...props} />
                <DragHandleButton
                  {...props}
                  dragHandleMenu={() => <div style={{ display: 'none' }} />}
                />
              </SideMenu>
            )}
          />

          {/* Slash menu with all block types */}
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                [
                  ...getDefaultReactSlashMenuItems(editor),
                  insertTableItem(editor),
                  insertDividerItem(editor),
                  insertVideoItem(editor),
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

      {/* Right-click context menu */}
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
