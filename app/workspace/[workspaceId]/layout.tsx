'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { Sidebar } from '@/components/sidebar/sidebar'
import { AiPanel } from '@/components/ai-panel'
import { SearchModal } from '@/components/search-modal'
import { SettingsModal } from '@/components/settings-modal'

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420
const SIDEBAR_DEFAULT = 240
const AI_MIN = 260
const AI_MAX = 520
const AI_DEFAULT = 320

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

  // Resizable widths
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [aiWidth, setAiWidth] = useState(AI_DEFAULT)
  const resizingRef = useRef<'sidebar' | 'ai' | null>(null)

  const {
    setWorkspace, setPages, setUser, setPagesLoading, sidebarOpen, aiOpen, searchOpen, _hydrated,
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
    setPages(pages || [])
    setPagesLoading(false)
  }, [workspaceId]) // eslint-disable-line

  useEffect(() => { loadData() }, [loadData])

  // Real-time sync
  useEffect(() => {
    const channel = supabase
      .channel('pages-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pages', filter: `workspace_id=eq.${workspaceId}` },
        () => loadData()
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workspaceId]) // eslint-disable-line

  // ── Resize drag logic ───────────────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (resizingRef.current === 'sidebar') {
        const newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX))
        setSidebarWidth(newW)
      }
      if (resizingRef.current === 'ai') {
        const newW = Math.max(AI_MIN, Math.min(AI_MAX, window.innerWidth - e.clientX))
        setAiWidth(newW)
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

  // Keyboard shortcuts
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

  if (!_hydrated) {
    return <div className="h-screen w-full bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-foreground/10 border-t-foreground animate-spin" />
    </div>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" suppressHydrationWarning>
      {/* ── Left sidebar ── */}
      {sidebarOpen && (
        <Sidebar
          workspaceId={workspaceId}
          width={sidebarWidth}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* ── Left resize handle ── */}
      {sidebarOpen && (
        <div
          onMouseDown={startSidebarResize}
          className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors group relative"
          title="Drag to resize sidebar"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" /> {/* wider hit area */}
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>

      {/* ── Right resize handle ── */}
      {aiOpen && (
        <div
          onMouseDown={startAiResize}
          className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors relative"
          title="Drag to resize AI panel"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* ── Right AI panel ── */}
      {aiOpen && <AiPanel workspaceId={workspaceId} width={aiWidth} />}

      {/* Global modals */}
      <SearchModal workspaceId={workspaceId} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
