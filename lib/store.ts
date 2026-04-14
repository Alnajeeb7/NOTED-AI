import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Page, Workspace, AIMessage, UserProfile } from '@/types'
import { DEFAULT_MODEL } from './groq'
import type { GroqModelId } from './groq'

interface AppState {
  // Workspace
  workspace: Workspace | null
  setWorkspace: (workspace: Workspace | null) => void

  // Pages
  pages: Page[]
  setPages: (pages: Page[]) => void
  addPage: (page: Page) => void
  updatePage: (id: string, updates: Partial<Page>) => void
  removePage: (id: string) => void

  // Current page
  currentPageId: string | null
  setCurrentPageId: (id: string | null) => void

  // User
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // AI Agent sidebar
  aiOpen: boolean
  setAiOpen: (open: boolean) => void
  toggleAi: () => void

  // AI Messages
  aiMessages: AIMessage[]
  setAiMessages: (messages: AIMessage[]) => void
  addAiMessage: (message: AIMessage) => void
  clearAiMessages: () => void

  // Search
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void

  // Loading states
  pagesLoading: boolean
  setPagesLoading: (loading: boolean) => void

  // Favorites
  favorites: string[]
  toggleFavorite: (pageId: string) => void

  // Recently viewed
  recentPages: string[]
  addRecentPage: (pageId: string) => void

  // UI Preferences
  compactSidebar: boolean
  setCompactSidebar: (v: boolean) => void
  alwaysSidebar: boolean
  setAlwaysSidebar: (v: boolean) => void

  // AI Model selection
  selectedModel: GroqModelId
  setSelectedModel: (model: GroqModelId) => void
  // modelId -> timestamp when rate-limited (0 = not limited)
  rateLimitedModels: Record<string, number>
  setModelRateLimited: (modelId: string) => void
  clearModelRateLimit: (modelId: string) => void

  // Hydration tracking
  _hydrated: boolean
  setHydrated: (v: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      workspace: null,
      setWorkspace: (workspace) => set({ workspace }),

      pages: [],
      setPages: (pages) => set({ pages }),
      addPage: (page) => set((state) => ({ pages: [...state.pages, page] })),
      updatePage: (id, updates) =>
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      removePage: (id) =>
        set((state) => ({ pages: state.pages.filter((p) => p.id !== id) })),

      currentPageId: null,
      setCurrentPageId: (id) => set({ currentPageId: id }),

      user: null,
      setUser: (user) => set({ user }),

      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      aiOpen: false,
      setAiOpen: (open) => set({ aiOpen: open }),
      toggleAi: () => set((state) => ({ aiOpen: !state.aiOpen })),

      aiMessages: [],
      setAiMessages: (messages) => set({ aiMessages: messages }),
      addAiMessage: (message) =>
        set((state) => ({ aiMessages: [...state.aiMessages, message] })),
      clearAiMessages: () => set({ aiMessages: [] }),

      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),

      pagesLoading: false,
      setPagesLoading: (loading) => set({ pagesLoading: loading }),

      favorites: [],
      toggleFavorite: (pageId) =>
        set((state) => ({
          favorites: state.favorites.includes(pageId)
            ? state.favorites.filter((id) => id !== pageId)
            : [...state.favorites, pageId],
        })),

      recentPages: [],
      addRecentPage: (pageId) =>
        set((state) => ({
          recentPages: [pageId, ...state.recentPages.filter((id) => id !== pageId)].slice(0, 10),
        })),

      compactSidebar: false,
      setCompactSidebar: (v) => set({ compactSidebar: v }),
      alwaysSidebar: false,
      setAlwaysSidebar: (v) => set({ alwaysSidebar: v }),

      selectedModel: DEFAULT_MODEL,
      setSelectedModel: (model) => set({ selectedModel: model }),
      rateLimitedModels: {},
      setModelRateLimited: (modelId) =>
        set((state) => ({ rateLimitedModels: { ...state.rateLimitedModels, [modelId]: Date.now() } })),
      clearModelRateLimit: (modelId) =>
        set((state) => {
          const next = { ...state.rateLimitedModels }
          delete next[modelId]
          return { rateLimitedModels: next }
        }),

      _hydrated: false,
      setHydrated: (v) => set({ _hydrated: v }),
    }),
    {
      name: 'noted-store',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        aiOpen: state.aiOpen,
        favorites: state.favorites,
        recentPages: state.recentPages,
        aiMessages: state.aiMessages,
        compactSidebar: state.compactSidebar,
        alwaysSidebar: state.alwaysSidebar,
        selectedModel: state.selectedModel,
      }),
    }
  )
)
