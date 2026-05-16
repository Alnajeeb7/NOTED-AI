'use client'

import { useEffect, useRef } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  insertOrUpdateBlock,
} from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import type { Block } from '@blocknote/core'

// ─── YouTube custom block ─────────────────────────────────────────────────────

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

const YouTubeBlock = createReactBlockSpec(
  {
    type: 'youtube' as const,
    propSchema: { url: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block }) => {
      const videoId = extractYouTubeId(block.props.url)
      if (!videoId) {
        return (
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
            Invalid YouTube URL
          </div>
        )
      }
      return (
        <div contentEditable={false} style={{ width: '100%', margin: '4px 0' }}>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8, background: '#000' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            />
          </div>
          <a href={block.props.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'inline-block' }}>
            Open on YouTube ↗
          </a>
        </div>
      )
    },
    toExternalHTML: ({ block }) => {
      const videoId = extractYouTubeId(block.props.url)
      if (!videoId) return <div />
      return <div><a href={block.props.url}>{block.props.url}</a></div>
    },
  }
)

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, youtube: YouTubeBlock },
})

// ─── Upload handler ───────────────────────────────────────────────────────────

async function uploadToSupabase(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Upload failed')
  }
  const { url } = await res.json()
  return url
}

function isYouTubeUrl(text: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(text)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EditorProps {
  initialContent?: Block[] | null
  onChange?: (content: Block[]) => void
}

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

  // Auto-embed YouTube on paste
  useEffect(() => {
    if (!editor) return
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')?.trim()
      if (!text || !isYouTubeUrl(text)) return
      e.preventDefault()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // @ts-ignore
      insertOrUpdateBlock(editor as any, {
        type: 'youtube',
        props: { url: text },
      })
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const unsubscribe = editor.onChange(() => {
      changeRef.current?.(editor.document as Block[])
    })
    return () => unsubscribe?.()
  }, [editor])

  return (
    <div id="bn-editor-focus" tabIndex={-1}>
      <BlockNoteView editor={editor} theme="light" />
    </div>
  )
}
