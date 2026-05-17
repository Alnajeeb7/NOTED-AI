import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Page, Workspace, AIMessage, UserProfile, AIMode, UserMemory, UserApiKey, ApiKeySource, LearningPlan } from '@/types'
import { DEFAULT_MODEL } from './groq'
import type { GroqModelId } from './groq'
import { DEFAULT_MEMORY } from './personalization'

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
  rateLimitedModels: Record<string, number>
  setModelRateLimited: (modelId: string) => void
  clearModelRateLimit: (modelId: string) => void

  // ─── AI Mode ──────────────────────────────────────────────────────────────
  aiMode: AIMode
  setAiMode: (mode: AIMode) => void

  // ─── Personalization / Memory ─────────────────────────────────────────────
  userMemory: UserMemory | null
  setUserMemory: (memory: UserMemory) => void
  updateUserMemory: (updates: Partial<UserMemory>) => void
  personalizationOpen: boolean
  setPersonalizationOpen: (open: boolean) => void

  // ─── API Keys ─────────────────────────────────────────────────────────────
  apiKeySource: ApiKeySource
  setApiKeySource: (source: ApiKeySource) => void
  userApiKeys: UserApiKey[]
  setUserApiKeys: (keys: UserApiKey[]) => void
  addUserApiKey: (key: UserApiKey) => void
  removeUserApiKey: (id: string) => void
  activeUserKeyId: string | null
  setActiveUserKeyId: (id: string | null) => void
  apiKeyModalOpen: boolean
  setApiKeyModalOpen: (open: boolean) => void

  // ─── Analytics ───────────────────────────────────────────────────────────
  analyticsOpen: boolean
  setAnalyticsOpen: (open: boolean) => void
  sessionMessages: number
  incrementSessionMessages: () => void

  // ─── Learning Plans ───────────────────────────────────────────────────────
  activePlan: LearningPlan | null
  setActivePlan: (plan: LearningPlan | null) => void
  completePlanTask: (dayIdx: number, taskId: string) => void

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
        set((state) => ({ pages: state.pages.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
      removePage: (id) => set((state) => ({ pages: state.pages.filter((p) => p.id !== id) })),

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
      addAiMessage: (message) => set((state) => ({ aiMessages: [...state.aiMessages, message] })),
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

      // ─── AI Mode ────────────────────────────────────────────────────────────
      aiMode: 'chat',
      setAiMode: (mode) => set({ aiMode: mode }),

      // ─── Personalization ────────────────────────────────────────────────────
      userMemory: null,
      setUserMemory: (memory) => set({ userMemory: memory }),
      updateUserMemory: (updates) =>
        set((state) => ({
          userMemory: state.userMemory
            ? { ...state.userMemory, ...updates, lastUpdated: new Date().toISOString() }
            : { ...DEFAULT_MEMORY, id: 'local', userId: '', workspaceId: '', ...updates, lastUpdated: new Date().toISOString() },
        })),
      personalizationOpen: false,
      setPersonalizationOpen: (open) => set({ personalizationOpen: open }),

      // ─── API Keys ────────────────────────────────────────────────────────────
      apiKeySource: 'platform',
      setApiKeySource: (source) => set({ apiKeySource: source }),
      userApiKeys: [],
      setUserApiKeys: (keys) => set({ userApiKeys: keys }),
      addUserApiKey: (key) => set((state) => ({ userApiKeys: [...state.userApiKeys, key] })),
      removeUserApiKey: (id) => set((state) => ({ userApiKeys: state.userApiKeys.filter((k) => k.id !== id) })),
      activeUserKeyId: null,
      setActiveUserKeyId: (id) => set({ activeUserKeyId: id }),
      apiKeyModalOpen: false,
      setApiKeyModalOpen: (open) => set({ apiKeyModalOpen: open }),

      // ─── Analytics ──────────────────────────────────────────────────────────
      analyticsOpen: false,
      setAnalyticsOpen: (open) => set({ analyticsOpen: open }),
      sessionMessages: 0,
      incrementSessionMessages: () => set((state) => ({ sessionMessages: state.sessionMessages + 1 })),

      // ─── Learning Plans ─────────────────────────────────────────────────────
      activePlan: null,
      setActivePlan: (plan) => set({ activePlan: plan }),
      completePlanTask: (dayIdx, taskId) =>
        set((state) => {
          if (!state.activePlan) return {}
          const days = state.activePlan.days.map((d, i) => {
            if (i !== dayIdx) return d
            const tasks = d.tasks.map((t) => t.id === taskId ? { ...t, isComplete: true } : t)
            const isComplete = tasks.every((t) => t.isComplete)
            return { ...d, tasks, isComplete }
          })
          const done = days.filter((d) => d.isComplete).length
          const progress = Math.round((done / days.length) * 100)
          return { activePlan: { ...state.activePlan, days, progress } }
        }),

      _hydrated: false,
      setHydrated: (v) => set({ _hydrated: v }),
    }),
    {
      name: 'noted-store',
      onRehydrateStorage: () => (state) => { state?.setHydrated(true) },
      partialize: (state) => ({
        aiOpen: state.aiOpen,
        favorites: state.favorites,
        recentPages: state.recentPages,
        aiMessages: state.aiMessages,
        compactSidebar: state.compactSidebar,
        alwaysSidebar: state.alwaysSidebar,
        selectedModel: state.selectedModel,
        aiMode: state.aiMode,
        userMemory: state.userMemory,
        apiKeySource: state.apiKeySource,
        userApiKeys: state.userApiKeys,
        activeUserKeyId: state.activeUserKeyId,
        activePlan: state.activePlan,
      }),
    }
  )
)
