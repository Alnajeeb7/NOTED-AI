'use client'

import { useEffect, useRef, useState } from 'react'
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
} from '@blocknote/react'
import type { Block } from '@blocknote/core'

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
  { type: 'youtube' as const, propSchema: { url: { default: '' } }, content: 'none' },
  {
    render: ({ block }) => {
      const videoId = extractYouTubeId(block.props.url)
      if (!videoId) return <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>Invalid YouTube URL</div>
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

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, youtube: YouTubeBlock, video: VideoBlock },
})

async function uploadToSupabase(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Upload failed') }
  const { url } = await res.json()
  return url
}

function isYouTubeUrl(text: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(text)
}

const insertVideoItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: 'Video',
  subtext: 'Insert a video file',
  onItemClick: () => { insertOrUpdateBlock(editor as any, { type: 'video', props: { url: '', name: '' } } as any) },
  aliases: ['video', 'mp4', 'webm', 'film', 'media'],
  group: 'Media',
  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>,
})

const insertYouTubeItem = (editor: typeof schema.BlockNoteEditor) => ({
  title: 'YouTube',
  subtext: 'Embed a YouTube video',
  onItemClick: () => {
    const url = prompt('Paste YouTube URL:')
    if (!url) return
    insertOrUpdateBlock(editor as any, { type: 'youtube', props: { url } } as any)
  },
  aliases: ['youtube', 'yt', 'embed'],
  group: 'Media',
  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>,
})

interface EditorProps {
  initialContent?: Block[] | null
  onChange?: (content: Block[]) => void
}

export default function Editor({ initialContent, onChange }: EditorProps) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent && initialContent.length > 0 ? (initialContent as typeof schema.Block[]) : undefined,
    uploadFile: uploadToSupabase,
  })

  const changeRef = useRef(onChange)
  changeRef.current = onChange

  useEffect(() => {
    if (!editor) return
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')?.trim()
      if (!text || !isYouTubeUrl(text)) return
      e.preventDefault()
      const block = { type: 'youtube', props: { url: text } } as any
      insertOrUpdateBlock(editor as any, block)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const handleVideoUploaded = (e: Event) => {
      const { url, name, blockId } = (e as CustomEvent).detail
      try { editor.updateBlock(blockId, { type: 'video', props: { url, name } } as any) } catch { }
    }
    window.addEventListener('video-uploaded', handleVideoUploaded)
    return () => window.removeEventListener('video-uploaded', handleVideoUploaded)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const unsubscribe = editor.onChange(() => { changeRef.current?.(editor.document as Block[]) })
    return () => unsubscribe?.()
  }, [editor])

  return (
    <div id="bn-editor-focus" tabIndex={-1}>
      <BlockNoteView editor={editor} theme="light" slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [...getDefaultReactSlashMenuItems(editor), insertVideoItem(editor), insertYouTubeItem(editor)],
              query
            )
          }
        />
      </BlockNoteView>
    </div>
  )
}
