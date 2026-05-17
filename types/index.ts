export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: { Row: Workspace; Insert: Omit<Workspace, 'id' | 'created_at'>; Update: Partial<Omit<Workspace, 'id'>> }
      pages: { Row: Page; Insert: Omit<Page, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Page, 'id' | 'created_at'>> }
      ai_conversations: { Row: AIConversation; Insert: Omit<AIConversation, 'id' | 'created_at'>; Update: Partial<Omit<AIConversation, 'id'>> }
    }
  }
}

export interface Workspace { id: string; name: string; icon: string | null; owner_id: string; created_at: string }

export interface Page {
  id: string; workspace_id: string; parent_id: string | null; title: string; content: Json | null
  icon: string | null; cover_url: string | null; cover_position: number; is_archived: boolean
  is_favorite: boolean; created_by: string; created_at: string; updated_at: string; order_index: number
}

export type AIMode = 'chat' | 'agentic' | 'plan' | 'explore'

export interface AIMessage {
  id: string; role: 'user' | 'assistant'; content: string; timestamp: string; action?: AIAction; mode?: AIMode
}

export interface AIAction {
  type: 'create_page' | 'edit_page' | 'search_pages' | 'summarize' | 'draft' | 'page_created' | 'page_updated' | 'search_results' | 'plan_generated' | 'mode_switched'
  status?: 'pending' | 'running' | 'done' | 'error'
  result?: string; pageId?: string; title?: string; results?: unknown[]; plan?: LearningPlan
}

export interface AIConversation { id: string; workspace_id: string; user_id: string; messages: Json; created_at: string }
export type PageWithChildren = Page & { children?: PageWithChildren[] }
export type EditorContent = Json

export interface UserProfile { id: string; email: string; full_name: string | null; avatar_url: string | null; workspace_id: string | null }
export interface SearchResult { id: string; title: string; icon: string | null; content_preview: string; updated_at: string }
export type Theme = 'light' | 'dark' | 'system'

// ─── AI Modes ──────────────────────────────────────────────────────────────────
export interface AIModeConfig { id: AIMode; label: string; icon: string; description: string; color: string }

// ─── Learning Plan ─────────────────────────────────────────────────────────────
export interface LearningPlan {
  id: string; title: string; goal: 'interview' | 'exam' | 'mastery' | 'custom'
  startDate: string; endDate: string; totalDays: number
  days: LearningDay[]; checkpoints: Checkpoint[]; progress: number; createdAt: string
}
export interface LearningDay { day: number; date: string; topics: string[]; tasks: PlanTask[]; isComplete: boolean; revision?: boolean }
export interface PlanTask { id: string; text: string; type: 'learn' | 'practice' | 'revise' | 'test'; isComplete: boolean; pageId?: string }
export interface Checkpoint { id: string; title: string; day: number; type: 'quiz' | 'review' | 'milestone'; isComplete: boolean }

// ─── Personalization ──────────────────────────────────────────────────────────
export interface UserMemory {
  id: string; userId: string; workspaceId: string
  weakAreas: string[]; strongAreas: string[]; interactionCount: number
  preferredDepth: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  preferredTone: 'concise' | 'detailed' | 'casual' | 'formal'
  preferredStyle: 'bullet' | 'prose' | 'step-by-step' | 'visual'
  uploadedContexts: UploadedContext[]; progressLog: ProgressEntry[]; lastUpdated: string
}
export interface UploadedContext { id: string; name: string; type: 'notes' | 'screenshot' | 'dataset' | 'custom'; content: string; uploadedAt: string }
export interface ProgressEntry { date: string; topic: string; score: number; interactions: number }

// ─── API Keys ─────────────────────────────────────────────────────────────────
export type ApiKeyProvider = 'openai' | 'claude' | 'groq' | 'gemini' | 'platform'
export interface UserApiKey { id: string; userId: string; provider: ApiKeyProvider; label: string; keyPrefix: string; isActive: boolean; usageCount: number; lastUsed: string | null; createdAt: string }
export interface ApiKeyUsage { date: string; provider: ApiKeyProvider; calls: number; tokens: number }
export type ApiKeySource = 'platform' | 'user'

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface LearningAnalytics {
  userId: string; workspaceId: string; totalSessions: number; totalMessages: number
  topicsExplored: string[]; heatmap: HeatmapEntry[]; weeklyProgress: WeeklyProgress[]
  performanceByTopic: Record<string, number>
}
export interface HeatmapEntry { date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 }
export interface WeeklyProgress { week: string; sessions: number; pagesCreated: number; tasksCompleted: number }
