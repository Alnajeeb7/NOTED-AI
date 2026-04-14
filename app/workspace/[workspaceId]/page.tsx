'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import {
  Plus, Clock, Star, Search, FileText,
  Pen, ListTodo, Calendar, BookOpen, Layout,
  ArrowUpRight, Hash
} from 'lucide-react'
import { formatRelative, getPageUrl } from '@/lib/utils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// ── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'meeting',
    icon: '🤝',
    label: 'Meeting notes',
    desc: 'Agenda, notes & action items',
    lucide: Calendar,
    content: `# Meeting Notes\n## Date\n${format(new Date(), 'MMMM d, yyyy')}\n## Attendees\n- \n## Agenda\n- \n## Notes\n\n## Action items\n- [ ] `,
  },
  {
    id: 'todo',
    icon: '✅',
    label: 'To-do list',
    desc: 'Tasks with checkboxes',
    lucide: ListTodo,
    content: `# To-do\n## Today\n- [ ] \n- [ ] \n## This week\n- [ ] \n- [ ] `,
  },
  {
    id: 'journal',
    icon: '📔',
    label: 'Daily journal',
    desc: "Today's thoughts & reflections",
    lucide: Pen,
    content: `# ${format(new Date(), 'EEEE, MMMM d')}\n## How I'm feeling\n\n## What happened today\n\n## What I'm grateful for\n- \n## Tomorrow's intention\n`,
  },
  {
    id: 'project',
    icon: '🚀',
    label: 'Project plan',
    desc: 'Goals, tasks & timeline',
    lucide: Layout,
    content: `# Project Plan\n## Overview\n\n## Goals\n- \n## Timeline\n| Phase | Due | Status |\n|-------|-----|--------|\n| Planning | | 🔵 In progress |\n| Development | | ⚪ Not started |\n| Review | | ⚪ Not started |\n## Resources\n- `,
  },
]

// ── Keyboard shortcut badge ───────────────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono text-muted-foreground">
      {children}
    </kbd>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkspaceHome({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params
  const router = useRouter()
  const { workspace, pages, user, addPage, favorites, setSearchOpen, _hydrated } = useAppStore()

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = user?.full_name || user?.email?.split('@')[0] || 'there'

  const recentPages = [...pages]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8)

  const favoritePages = pages.filter((p) => favorites.includes(p.id))
  const totalPages = pages.length

  // ── Create helpers ──────────────────────────────────────────────────────────
  const createBlankPage = async () => {
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, title: 'Untitled', icon: null }),
      })
      if (!res.ok) throw new Error()
      const page = await res.json()
      addPage(page)
      router.push(getPageUrl(workspaceId, page.id))
    } catch { toast.error('Failed to create page') }
  }

  const createFromTemplate = async (tpl: typeof TEMPLATES[number]) => {
    try {
      const lines = tpl.content.split('\n')
      const title = lines[0].replace(/^#\s*/, '') || tpl.label
      const blocks = lines.slice(1).filter(Boolean).map((line, i) => {
        let type = 'paragraph', text = line, level = 1
        if (line.startsWith('### ')) { type = 'heading'; level = 3; text = line.slice(4) }
        else if (line.startsWith('## ')) { type = 'heading'; level = 2; text = line.slice(3) }
        else if (line.startsWith('# ')) { type = 'heading'; level = 1; text = line.slice(2) }
        else if (line.startsWith('- [ ] ')) { type = 'checkListItem'; text = line.slice(6) }
        else if (line.startsWith('- ')) { type = 'bulletListItem'; text = line.slice(2) }
        return {
          id: `tpl-${i}`,
          type,
          props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', ...(type === 'heading' ? { level } : {}) },
          content: [{ type: 'text', text: text.trim(), styles: {} }],
          children: [],
        }
      })

      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title,
          icon: tpl.icon,
          content: blocks,
        }),
      })
      if (!res.ok) throw new Error()
      const page = await res.json()
      addPage(page)
      router.push(getPageUrl(workspaceId, page.id))
    } catch { toast.error('Failed to create page from template') }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!_hydrated) {
    return <div className="max-w-[780px] mx-auto px-8 py-14" />
  }

  return (
    <div className="max-w-[780px] mx-auto px-8 py-14 space-y-12" suppressHydrationWarning>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium tracking-wide">
            {format(now, 'EEEE, MMMM d')}
          </p>
          <h1 className="text-[2.4rem] font-bold leading-none tracking-tight" style={{ fontFamily: 'Fraunces, serif' }}>
            {greeting}, {name}
          </h1>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground">
            <Hash className="w-3 h-3" />
            {totalPages} page{totalPages !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground">
            <Star className="w-3 h-3" />
            {favoritePages.length} starred
          </div>
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <section>
        <SectionLabel icon={Plus} label="Quick actions" />
        <div className="grid grid-cols-3 gap-2">
          {/* New blank page */}
          <button
            id="new-page-btn"
            onClick={createBlankPage}
            className="group flex flex-col gap-3 p-4 rounded-xl border border-border bg-background hover:bg-accent active:scale-[0.98] transition-all text-left"
          >
            <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center">
              <Plus className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">New page</p>
              <p className="text-xs text-muted-foreground mt-0.5">Blank canvas</p>
            </div>
          </button>

          {/* Search */}
          <button
            id="search-btn"
            onClick={() => setSearchOpen(true)}
            className="group flex flex-col gap-3 p-4 rounded-xl border border-border bg-background hover:bg-accent active:scale-[0.98] transition-all text-left"
          >
            <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center">
              <Search className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Search</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                Find anything <Kbd>⌘K</Kbd>
              </p>
            </div>
          </button>

          {/* Quick note — opens a page with today's date as title */}
          <button
            id="quick-note-btn"
            onClick={async () => {
              try {
                const res = await fetch('/api/pages', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    workspace_id: workspaceId,
                    title: format(now, 'MMM d, yyyy'),
                    icon: '📝',
                  }),
                })
                if (!res.ok) throw new Error()
                const page = await res.json()
                addPage(page)
                router.push(getPageUrl(workspaceId, page.id))
              } catch { toast.error('Failed to create note') }
            }}
            className="group flex flex-col gap-3 p-4 rounded-xl border border-border bg-background hover:bg-accent active:scale-[0.98] transition-all text-left"
          >
            <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center">
              <Pen className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Quick note</p>
              <p className="text-xs text-muted-foreground mt-0.5">Today's note</p>
            </div>
          </button>
        </div>
      </section>

      {/* ── Templates ──────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel icon={BookOpen} label="Start from template" />
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              id={`tpl-${tpl.id}`}
              onClick={() => createFromTemplate(tpl)}
              className="group flex items-center gap-3 p-3.5 rounded-xl border border-border bg-background hover:bg-accent active:scale-[0.98] transition-all text-left"
            >
              <span className="text-xl shrink-0 w-8 text-center">{tpl.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{tpl.label}</p>
                <p className="text-xs text-muted-foreground truncate">{tpl.desc}</p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      </section>

      {/* ── Pinned / Favorites ─────────────────────────────────────────────── */}
      {favoritePages.length > 0 && (
        <section>
          <SectionLabel icon={Star} label="Starred" />
          <div className="grid grid-cols-3 gap-2">
            {favoritePages.slice(0, 6).map((page) => (
              <button
                key={page.id}
                onClick={() => router.push(getPageUrl(workspaceId, page.id))}
                className="group flex flex-col gap-2 p-3.5 rounded-xl border border-border bg-background hover:bg-accent active:scale-[0.98] transition-all text-left"
              >
                <span className="text-2xl">{page.icon || '📄'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{page.title || 'Untitled'}</p>
                  <p className="text-[11px] text-muted-foreground">{formatRelative(page.updated_at)}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent pages ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel icon={Clock} label="Recent" />
          {recentPages.length > 0 && (
            <span className="text-xs text-muted-foreground">{recentPages.length} pages</span>
          )}
        </div>

        {recentPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-2xl text-center">
            <FileText className="w-9 h-9 mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium mb-1">Your workspace is empty</p>
            <p className="text-xs text-muted-foreground mb-5">Create a page or pick a template above to get started</p>
            <button
              onClick={createBlankPage}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              New page
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {recentPages.map((page) => (
              <button
                key={page.id}
                onClick={() => router.push(getPageUrl(workspaceId, page.id))}
                className="w-full flex items-center gap-3 px-4 py-3 bg-background hover:bg-accent active:bg-accent/80 transition-colors text-left group"
              >
                <span className="text-base shrink-0 w-6 text-center">{page.icon || '📄'}</span>
                <span className="flex-1 text-sm font-medium truncate">{page.title || 'Untitled'}</span>
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-muted-foreground">{formatRelative(page.updated_at)}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Keyboard shortcuts ─────────────────────────────────────────────── */}
      <section className="border border-border rounded-xl p-4">
        <SectionLabel icon={Hash} label="Keyboard shortcuts" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          {[
            ['New page', '⌘ N'],
            ['Search', '⌘ K'],
            ['Toggle sidebar', '⌘ \\'],
            ['Bold', '⌘ B'],
            ['Italic', '⌘ I'],
            ['Heading 1', '# + Space'],
          ].map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <div className="flex items-center gap-1">
                {keys.split(' ').map((k, i) => <Kbd key={i}>{k}</Kbd>)}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
