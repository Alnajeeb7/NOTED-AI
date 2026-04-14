'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Search, FileText, ArrowRight, Clock, Star, X } from 'lucide-react'
import { getPageUrl, formatRelative } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function SearchModal({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const { pages, searchOpen, setSearchOpen, favorites } = useAppStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [searchOpen])

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])

  if (!searchOpen) return null

  const filtered = query.trim()
    ? pages.filter((p) =>
        (p.title || 'Untitled').toLowerCase().includes(query.toLowerCase())
      )
    : pages.slice(0, 8) // show recent when no query

  const navigate = (pageId: string) => {
    router.push(getPageUrl(workspaceId, pageId))
    setSearchOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setSearchOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            id="search-input"
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono border border-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {!query && (
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Recent pages
            </p>
          )}

          {filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No pages found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((page) => (
              <button
                key={page.id}
                onClick={() => navigate(page.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5',
                  'hover:bg-accent transition-colors text-left group'
                )}
              >
                <span className="text-base shrink-0 w-6 text-center">
                  {page.icon || '📄'}
                </span>
                <span className="flex-1 text-sm font-medium truncate">
                  {page.title || 'Untitled'}
                </span>
                <div className="flex items-center gap-2 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {favorites.includes(page.id) && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
                  <span className="text-xs">{formatRelative(page.updated_at)}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="w-3 h-3" /> {pages.length} pages
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> Click to open
          </span>
        </div>
      </div>
    </div>
  )
}
