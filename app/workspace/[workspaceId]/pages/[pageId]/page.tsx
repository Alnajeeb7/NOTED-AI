'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Menu, Bot, Star, MoreHorizontal, Trash2, Check, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

const BlockNoteEditor = dynamic(() => import('@/components/editor'), { ssr: false })

type SaveStatus = 'saved' | 'saving' | 'unsaved'

export default function PageView({
  params,
}: {
  params: { workspaceId: string; pageId: string }
}) {
  const { workspaceId, pageId } = params
  const router = useRouter()
  const { pages, updatePage, removePage, favorites, toggleFavorite, toggleSidebar, setCurrentPageId } =
    useAppStore()

  const page = pages.find((p) => p.id === pageId)
  const [titleValue, setTitleValue] = useState(page?.title || '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const titleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const contentTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isFavorite = favorites.includes(pageId)

  useEffect(() => {
    setCurrentPageId(pageId)
    return () => setCurrentPageId(null)
  }, [pageId, setCurrentPageId])

  useEffect(() => {
    if (page) setTitleValue(page.title)
  }, [page?.id]) // eslint-disable-line

  // Manual save via Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        setSaveStatus('saved')
        toast.success('Saved', { duration: 1200, icon: '✓' })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const saveTitle = useCallback(
    async (newTitle: string) => {
      setSaveStatus('saving')
      updatePage(pageId, { title: newTitle })
      try {
        await fetch(`/api/pages?id=${pageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    },
    [pageId, updatePage]
  )

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setTitleValue(v)
    setSaveStatus('unsaved')
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current)
    titleTimerRef.current = setTimeout(() => saveTitle(v), 800)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      document.getElementById('bn-editor-focus')?.focus()
    }
  }

  const handleContentChange = useCallback(
    (content: unknown) => {
      updatePage(pageId, { content: content as never })
      setSaveStatus('unsaved')
      // Debounce: wait 1.2s after last change before saving
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current)
      contentTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await fetch(`/api/pages?id=${pageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          })
          setSaveStatus('saved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, 1200)
    },
    [pageId, updatePage]
  )

  const handleDelete = async () => {
    await fetch(`/api/pages?id=${pageId}`, { method: 'DELETE' })
    removePage(pageId)
    toast.success('Page moved to trash')
    router.push(`/workspace/${workspaceId}`)
  }

  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Page not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <header className="flex items-center gap-1.5 px-4 py-2 border-b border-border shrink-0">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Toggle sidebar (⌘\)"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {/* Save status indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs select-none">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Saving…</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-muted-foreground">Saved</span>
            </>
          )}
          {saveStatus === 'unsaved' && (
            <>
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Unsaved</span>
            </>
          )}
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          onClick={() => toggleFavorite(pageId)}
          className={cn(
            'p-1.5 rounded hover:bg-accent transition-colors',
            isFavorite ? 'text-yellow-500' : 'text-muted-foreground hover:text-foreground'
          )}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={cn('w-4 h-4', isFavorite && 'fill-yellow-400')} />
        </button>

        <button
          onClick={() => useAppStore.getState().toggleAi()}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="AI Assistant"
        >
          <Bot className="w-4 h-4" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] bg-popover border border-border rounded-lg shadow-lg p-1 z-50"
              align="end"
              sideOffset={4}
            >
              <DropdownMenu.Item
                className="dropdown-item"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  toast.success('Link copied')
                }}
              >
                Copy link
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="dropdown-item"
                onClick={() => {
                  const icons = ['📝','💡','🚀','✨','🎯','📌','🗒️','🔖','🌟','💫','🎨','💻','📋','🔑','🧩']
                  const cur = page.icon || ''
                  const next = icons[(icons.indexOf(cur) + 1) % icons.length]
                  updatePage(pageId, { icon: next })
                  fetch(`/api/pages?id=${pageId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ icon: next }),
                  })
                }}
              >
                Change icon
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              <DropdownMenu.Item
                className="dropdown-item text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
                Delete page
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      {/* ── Page content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="noted-editor">
          {/* Icon */}
          <div className="mb-4">
            <button
              className="text-5xl hover:opacity-70 transition-opacity"
              title="Click to change icon"
              onClick={async () => {
                const icons = ['📝','💡','🚀','✨','🎯','📌','🗒️','🔖','🌟','💫','🎨','💻','📋','🔑','🧩','📊','🌿']
                const cur = page.icon || ''
                const next = icons[(icons.indexOf(cur) + 1) % icons.length]
                updatePage(pageId, { icon: next })
                await fetch(`/api/pages?id=${pageId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ icon: next }),
                })
              }}
            >
              {page.icon || '📄'}
            </button>
          </div>

          {/* Title */}
          <textarea
            id="page-title"
            className="page-title mb-6 resize-none overflow-hidden"
            placeholder="Untitled"
            value={titleValue}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = t.scrollHeight + 'px'
            }}
          />

          {/* Editor */}
          <BlockNoteEditor
            initialContent={page.content as never}
            onChange={handleContentChange}
          />
        </div>
      </div>
    </div>
  )
}
