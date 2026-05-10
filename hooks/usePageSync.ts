/**
 * usePageSync.ts — Fix for notebook/page persistence bug
 *
 * ROOT CAUSE:
 * The workspace layout fetches pages on mount and stores them in Zustand.
 * However, Zustand's `partialize` in store.ts does NOT persist `pages` to
 * localStorage (only sidebar prefs, favorites, etc. are persisted).
 *
 * When navigating away and back within the same session, the layout
 * re-mounts and re-fetches — but there's a window where `_hydrated` is
 * true but `pages` is still empty (before the fetch completes), causing
 * the UI to flash "empty workspace."
 *
 * SECONDARY CAUSE:
 * The Supabase realtime subscription in the layout uses `loadData` in its
 * dependency array but wraps it with `// eslint-disable-line`, meaning if
 * `loadData` changes identity, the subscription may fire with stale data.
 *
 * FIX:
 * 1. This hook provides a stable `syncPages` function that components can
 *    call to ensure pages are loaded, with a loading guard to prevent
 *    duplicate fetches.
 * 2. It caches pages in sessionStorage so they survive client-side navigation
 *    without waiting for a round-trip on every route change.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'

const SESSION_KEY_PREFIX = 'noted_pages_'
const CACHE_TTL_MS = 60_000 // 1 minute cache

interface CachedPages {
  pages: unknown[]
  fetchedAt: number
}

function getSessionCache(workspaceId: string): CachedPages | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + workspaceId)
    if (!raw) return null
    const parsed: CachedPages = JSON.parse(raw)
    // Expire cache after TTL
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY_PREFIX + workspaceId)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function setSessionCache(workspaceId: string, pages: unknown[]) {
  if (typeof window === 'undefined') return
  try {
    const data: CachedPages = { pages, fetchedAt: Date.now() }
    sessionStorage.setItem(SESSION_KEY_PREFIX + workspaceId, JSON.stringify(data))
  } catch {
    // sessionStorage might be full or unavailable — silently ignore
  }
}

export function invalidatePageCache(workspaceId: string) {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY_PREFIX + workspaceId)
}

/**
 * usePageSync — ensures pages are loaded for a workspace.
 * Call this in any component that needs pages to be available.
 *
 * @param workspaceId - the workspace to sync pages for
 */
export function usePageSync(workspaceId: string) {
  const { pages, setPages, setPagesLoading, pagesLoading } = useAppStore()
  const isFetchingRef = useRef(false)

  const syncPages = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return
    // If pages already loaded and not forced, skip
    if (!force && pages.length > 0) return

    // Check session cache first (survives client-side navigation)
    if (!force) {
      const cached = getSessionCache(workspaceId)
      if (cached && cached.pages.length > 0) {
        setPages(cached.pages as Parameters<typeof setPages>[0])
        return
      }
    }

    isFetchingRef.current = true
    setPagesLoading(true)

    try {
      const res = await fetch(`/api/pages?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error('Failed to fetch pages')
      const data = await res.json()
      if (Array.isArray(data)) {
        setPages(data)
        setSessionCache(workspaceId, data)
      }
    } catch (err) {
      console.error('[usePageSync] Failed to load pages:', err)
    } finally {
      setPagesLoading(false)
      isFetchingRef.current = false
    }
  }, [workspaceId, pages.length, setPages, setPagesLoading])

  // Auto-sync on mount if pages are empty
  useEffect(() => {
    if (workspaceId && pages.length === 0 && !pagesLoading) {
      syncPages()
    }
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { syncPages, invalidateCache: () => invalidatePageCache(workspaceId) }
}
