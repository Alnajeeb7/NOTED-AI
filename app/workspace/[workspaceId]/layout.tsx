'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { Sidebar } from '@/components/sidebar/sidebar'
import { AiPanel } from '@/components/ai-panel'
import { SearchModal } from '@/components/search-modal'
import { SettingsModal } from '@/components/settings-modal'
import { Home, PanelLeft, Bot, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
// FIX: import mobile styles for responsive layout
import '@/styles/mobile.css'

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420
const SIDEBAR_DEFAULT = 240
const AI_MIN = 260
const AI_MAX = 520
const AI_DEFAULT = 320

// FIX: session cache helpers to persist pages across client-side navigation
const SESSION_KEY = (id: string) => `noted_pages_${id}`
const CACHE_TTL = 60_000

function readPageCache(workspaceId: string) {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(workspaceId))
    if (!raw) return null
    const { pages, fetchedAt } = JSON.parse(raw)
    if (Date.now() - fetchedAt > CACHE_TTL) {
      sessionStorage.removeItem(SESSION_KEY(workspaceId))
      return null
    }
    return pages
  } catch { return null }
}

function writePageCache(workspaceId: string, pages: unknown[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_KEY(workspaceId), JSON.stringify({ pages, fetchedAt: Date.now() }))
  } catch { /* ignore quota errors */ }
}

function clearPageCache(workspaceId: string) {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY(workspaceId))
}

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { workspaceId: string }
}) {
  const { workspaceId } = params
  const router = useRouter()
  const supabase = createClient()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mobileAiOpen, setMobileAiOpen] = useState(false)

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [aiWidth, setAiWidth] = useState(AI_DEFAULT)
  const resizingRef = useRef<'sidebar' | 'ai' | null>(null)

  const {
    setWorkspace, setPages, setUser, setPagesLoading, sidebarOpen, aiOpen,
    toggleAi, toggleSidebar, setSearchOpen, _hydrated,
  } = useAppStore()

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: ws } = await supabase
      .from('workspaces').select('*').eq('id', workspaceId).single()
    if (ws) setWorkspace(ws)

    const { data: profile } = await supabase
      .from('user_profiles').select('*').eq('id', session.user.id).single()
    if (profile) setUser({ ...(profile as any), email: session.user.email ?? '' })

    setPagesLoading(true)
    const { data: pages } = await supabase
      .from('pages').select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })

    const pageData = pages || []
    setPages(pageData)
    // FIX: cache pages in sessionStorage so client-side navigation doesn't flash empty
    if (pageData.length > 0) writePageCache(workspaceId, pageData)
    setPagesLoading(false)
  }, [workspaceId]) // eslint-disable-line

  useEffect(() => {
    // FIX: load from session cache immediately to prevent empty flash
    const cached = readPageCache(workspaceId)
    if (cached && cached.length > 0) {
      setPages(cached)
    }
    loadData()
  }, [loadData])

  useEffect(() => {
    const channel = supabase
      .channel('pages-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pages', filter: `workspace_id=eq.${workspaceId}` },
        () => {
          // FIX: invalidate cache on realtime updates so fresh data is fetched
          clearPageCache(workspaceId)
          loadData()
        }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workspaceId]) // eslint-disable-line

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (resizingRef.current === 'sidebar') {
        setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX)))
      }
      if (resizingRef.current === 'ai') {
        setAiWidth(Math.max(AI_MIN, Math.min(AI_MAX, window.innerWidth - e.clientX)))
      }
    }
    const onMouseUp = () => {
      resizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); setSettingsOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const startSidebarResize = () => {
    resizingRef.current = 'sidebar'
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const startAiResize = () => {
    resizingRef.current = 'ai'
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const createPage = async () => {
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, title: 'Untitled', icon: null, parent_id: null }),
      })
      const newPage = await res.json()
      // FIX: invalidate cache so new page is included in next fetch
      clearPageCache(workspaceId)
      router.push(`/workspace/${workspaceId}/pages/${newPage.id}`)
      setMobileSidebarOpen(false)
    } catch { /* ignore */ }
  }

  if (!_hydrated) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-foreground/10 border-t-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" suppressHydrationWarning>

      {/* ── DESKTOP: Left sidebar ── */}
      {sidebarOpen && (
        <>
          <div className="hidden md:flex">
            <Sidebar
              workspaceId={workspaceId}
              width={sidebarWidth}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
          <div
            onMouseDown={startSidebarResize}
            className="hidden md:block w-1 shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors relative"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        </>
      )}

      {/* ── MOBILE: Sidebar overlay ── */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 h-full">
            <Sidebar
              workspaceId={workspaceId}
              width={288}
              onOpenSettings={() => { setSettingsOpen(true); setMobileSidebarOpen(false) }}
            />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto min-w-0 pb-16 md:pb-0">
        {children}
      </main>

      {/* ── DESKTOP: Right resize handle + AI panel ── */}
      {aiOpen && (
        <>
          <div
            onMouseDown={startAiResize}
            className="hidden md:block w-1 shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors relative"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
          <div className="hidden md:flex">
            <AiPanel workspaceId={workspaceId} width={aiWidth} />
          </div>
        </>
      )}

      {/* ── MOBILE: AI panel overlay ── */}
      {mobileAiOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileAiOpen(false)}
          />
          <div className="relative z-10 mt-auto h-[85vh] w-full rounded-t-2xl overflow-hidden">
            <AiPanel workspaceId={workspaceId} width={window?.innerWidth || 390} />
          </div>
        </div>
      )}

      {/* ── MOBILE: Bottom nav bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border flex items-center justify-around px-2 py-2 safe-area-pb">
        <button
          onClick={() => router.push(`/workspace/${workspaceId}`)}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => { setMobileSidebarOpen((v) => !v); setMobileAiOpen(false) }}
          className={cn(
            'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors',
            mobileSidebarOpen ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          <PanelLeft className="w-5 h-5" />
          <span className="text-[10px]">Pages</span>
        </button>

        <button
          onClick={createPage}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-foreground text-background transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px]">New</span>
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px]">Search</span>
        </button>

        <button
          onClick={() => { setMobileAiOpen((v) => !v); setMobileSidebarOpen(false) }}
          className={cn(
            'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors',
            mobileAiOpen ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          <Bot className="w-5 h-5" />
          <span className="text-[10px]">AI</span>
        </button>
      </nav>

      {/* Global modals */}
      <SearchModal workspaceId={workspaceId} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
