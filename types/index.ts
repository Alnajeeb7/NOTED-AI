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
      workspaces: {
        Row: Workspace
        Insert: Omit<Workspace, 'id' | 'created_at'>
        Update: Partial<Omit<Workspace, 'id'>>
      }
      pages: {
        Row: Page
        Insert: Omit<Page, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Page, 'id' | 'created_at'>>
      }
      ai_conversations: {
        Row: AIConversation
        Insert: Omit<AIConversation, 'id' | 'created_at'>
        Update: Partial<Omit<AIConversation, 'id'>>
      }
    }
  }
}

export interface Workspace {
  id: string
  name: string
  icon: string | null
  owner_id: string
  created_at: string
}

export interface Page {
  id: string
  workspace_id: string
  parent_id: string | null
  title: string
  content: Json | null
  icon: string | null
  cover_url: string | null
  cover_position: number
  is_archived: boolean
  is_favorite: boolean
  created_by: string
  created_at: string
  updated_at: string
  order_index: number
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  action?: AIAction
}

export interface AIAction {
  type: 'create_page' | 'edit_page' | 'search_pages' | 'summarize' | 'draft' | 'page_created' | 'page_updated' | 'search_results'
  status?: 'pending' | 'running' | 'done' | 'error'
  result?: string
  pageId?: string
  title?: string
  results?: unknown[]
}

export interface AIConversation {
  id: string
  workspace_id: string
  user_id: string
  messages: Json
  created_at: string
}

export type PageWithChildren = Page & {
  children?: PageWithChildren[]
}

export type EditorContent = Json

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  workspace_id: string | null
}

export interface SearchResult {
  id: string
  title: string
  icon: string | null
  content_preview: string
  updated_at: string
}

export type Theme = 'light' | 'dark' | 'system'
