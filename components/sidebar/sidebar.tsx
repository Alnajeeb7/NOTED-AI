'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Settings, ChevronDown, ChevronRight,
  FileText, Star, Trash2, Home, Bot, LogOut, Moon, Sun,
  MoreHorizontal, PenLine, Archive, Copy, Link,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { cn, getPageUrl, truncate } from '@/lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import toast from 'react-hot-toast'
import type { Page } from '@/types'

interface SidebarProps {
  workspaceId: string
  onOpenSettings: () => void
  width?: number
}

export function Sidebar({ workspaceId, onOpenSettings, width = 240 }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()

  const {
    workspace, pages, user, sidebarOpen, addPage, removePage,
    favorites, toggleFavorite, setSearchOpen, toggleAi, aiOpen,
  } = useAppStore()

  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())
  const [hoveredPage, setHoveredPage] = useState<string | null>(null)

  const topLevelPages = pages.filter((p) => !p.parent_id)
  const favoritePages = pages.filter((p) => favorites.includes(p.id))

  const getChildren = (parentId: string) =>
    pages.filter((p) => p.parent_id === parentId)

  const toggleExpand = (id: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const createPage = useCallback(
    async (parentId?: string) => {
      try {
        const res = await fetch('/api/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: workspaceId,
            parent_id: parentId || null,
            title: 'Untitled',
            icon: null,
          }),
        })
        const newPage = await res.json()
        addPage(newPage)
        if (parentId) {
          setExpandedPages((prev) => new Set([...prev, parentId]))
        }
        router.push(getPageUrl(workspaceId, newPage.id))
      } catch {
        toast.error('Failed to create page')
      }
    },
    [workspaceId, addPage, router]
  )

  const deletePage = useCallback(
    async (pageId: string) => {
      try {
        await fetch(`/api/pages?id=${pageId}`, { method: 'DELETE' })
        removePage(pageId)
        toast.success('Page moved to trash')
        if (pathname.includes(pageId)) {
          router.push(`/workspace/${workspaceId}`)
        }
      } catch {
        toast.error('Failed to delete page')
      }
    },
    [removePage, router, pathname, workspaceId]
  )

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!sidebarOpen) return null

  return (
    <Tooltip.Provider delayDuration={400}>
      <aside
        className="flex flex-col h-full border-r border-sidebar-border bg-sidebar overflow-hidden shrink-0"
        style={{ width, minWidth: width }}
      >
        {/* Workspace Header */}
        <div className="px-3 py-3 border-b border-sidebar-border">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors group">
                <div className="w-6 h-6 rounded bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
                  {workspace?.icon || 'N'}
                </div>
                <span className="text-sm font-semibold truncate flex-1 text-left">
                  {workspace?.name || 'Workspace'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[220px] bg-popover border border-border rounded-lg shadow-lg p-1.5 z-50 animate-fade-in"
                align="start"
                sideOffset={4}
              >
                <div className="px-2 py-1.5 mb-1">
                  <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{workspace?.name}</p>
                </div>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item
                  className="dropdown-item"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-item text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Quick Actions */}
        <div className="px-2 py-2 space-y-0.5">
          <button
            onClick={() => setSearchOpen(true)}
            className="sidebar-item text-muted-foreground"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span>Search</span>
            <kbd className="ml-auto text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>
          <button
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className={cn('sidebar-item', pathname === `/workspace/${workspaceId}` && 'active')}
          >
            <Home className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span>Home</span>
          </button>
          <button
            onClick={toggleAi}
            className={cn('sidebar-item', aiOpen && 'active')}
          >
            <Bot className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span>AI Agent</span>
            {aiOpen && (
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft" />
            )}
          </button>
        </div>

        {/* Favorites */}
        {favoritePages.length > 0 && (
          <div className="px-2 mt-2">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Favorites
            </p>
            {favoritePages.map((page) => (
              <PageItem
                key={page.id}
                page={page}
                workspaceId={workspaceId}
                level={0}
                isActive={pathname.includes(page.id)}
                isExpanded={expandedPages.has(page.id)}
                isHovered={hoveredPage === page.id}
                hasChildren={getChildren(page.id).length > 0}
                onToggleExpand={() => toggleExpand(page.id)}
                onSetHovered={setHoveredPage}
                onCreateChild={() => createPage(page.id)}
                onDelete={() => deletePage(page.id)}
                onToggleFavorite={() => toggleFavorite(page.id)}
                isFavorite={true}
              />
            ))}
          </div>
        )}

        {/* Pages */}
        <div className="flex-1 overflow-y-auto px-2 mt-2">
          <div className="flex items-center justify-between px-2 py-1 group">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pages
            </p>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => createPage()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="bg-foreground text-background text-xs px-2 py-1 rounded z-50" sideOffset={4}>
                  New page
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>

          <div className="space-y-0.5">
            {topLevelPages.length === 0 ? (
              <button
                onClick={() => createPage()}
                className="w-full text-left px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create your first page
              </button>
            ) : (
              topLevelPages.map((page) => (
                <PageTreeItem
                  key={page.id}
                  page={page}
                  level={0}
                  workspaceId={workspaceId}
                  pathname={pathname}
                  expandedPages={expandedPages}
                  hoveredPage={hoveredPage}
                  getChildren={getChildren}
                  onToggleExpand={toggleExpand}
                  onSetHovered={setHoveredPage}
                  onCreateChild={createPage}
                  onDelete={deletePage}
                  toggleFavorite={toggleFavorite}
                  favorites={favorites}
                />
              ))
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="px-2 py-2 border-t border-sidebar-border space-y-0.5">
          <button
            onClick={() => createPage()}
            className="sidebar-item text-muted-foreground"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New page</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="sidebar-item text-muted-foreground"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </Tooltip.Provider>
  )
}

// Recursive page tree item
function PageTreeItem({
  page, level, workspaceId, pathname, expandedPages, hoveredPage,
  getChildren, onToggleExpand, onSetHovered, onCreateChild, onDelete,
  toggleFavorite, favorites,
}: {
  page: Page
  level: number
  workspaceId: string
  pathname: string
  expandedPages: Set<string>
  hoveredPage: string | null
  getChildren: (id: string) => Page[]
  onToggleExpand: (id: string) => void
  onSetHovered: (id: string | null) => void
  onCreateChild: (parentId: string) => void
  onDelete: (id: string) => void
  toggleFavorite: (id: string) => void
  favorites: string[]
}) {
  const children = getChildren(page.id)
  const isExpanded = expandedPages.has(page.id)

  return (
    <div>
      <PageItem
        page={page}
        workspaceId={workspaceId}
        level={level}
        isActive={pathname.includes(page.id)}
        isExpanded={isExpanded}
        isHovered={hoveredPage === page.id}
        hasChildren={children.length > 0}
        onToggleExpand={() => onToggleExpand(page.id)}
        onSetHovered={onSetHovered}
        onCreateChild={() => onCreateChild(page.id)}
        onDelete={() => onDelete(page.id)}
        onToggleFavorite={() => toggleFavorite(page.id)}
        isFavorite={favorites.includes(page.id)}
      />
      <AnimatePresence>
        {isExpanded && children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {children.map((child) => (
              <PageTreeItem
                key={child.id}
                page={child}
                level={level + 1}
                workspaceId={workspaceId}
                pathname={pathname}
                expandedPages={expandedPages}
                hoveredPage={hoveredPage}
                getChildren={getChildren}
                onToggleExpand={onToggleExpand}
                onSetHovered={onSetHovered}
                onCreateChild={onCreateChild}
                onDelete={onDelete}
                toggleFavorite={toggleFavorite}
                favorites={favorites}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Individual page item
function PageItem({
  page, workspaceId, level, isActive, isExpanded,
  hasChildren, onToggleExpand, onSetHovered, onCreateChild,
  onDelete, onToggleFavorite, isFavorite,
}: {
  page: Page
  workspaceId: string
  level: number
  isActive: boolean
  isExpanded: boolean
  isHovered: boolean
  hasChildren: boolean
  onToggleExpand: () => void
  onSetHovered: (id: string | null) => void
  onCreateChild: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  isFavorite: boolean
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className="relative group/item"
      style={{ paddingLeft: level * 12 }}
      onMouseEnter={() => onSetHovered(page.id)}
      onMouseLeave={() => onSetHovered(null)}
    >
      <div
        className={cn(
          'flex items-center gap-1 w-full px-2 py-1 rounded-md cursor-pointer select-none',
          'hover:bg-sidebar-accent transition-colors duration-100',
          isActive && 'bg-sidebar-accent'
        )}
      >
        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
          className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 rounded hover:bg-sidebar-border transition-colors"
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : (
            <span className="w-3 h-3" />
          )}
        </button>

        {/* Icon + Title */}
        <button
          onClick={() => router.push(getPageUrl(workspaceId, page.id))}
          className="flex-1 flex items-center gap-1.5 min-w-0"
        >
          <span className="text-sm shrink-0">
            {page.icon || <FileText className="w-4 h-4 text-muted-foreground" />}
          </span>
          <span className={cn(
            'text-sm truncate',
            isActive ? 'text-foreground font-medium' : 'text-sidebar-foreground'
          )}>
            {page.title || 'Untitled'}
          </span>
        </button>

        {/* Action buttons — visible on hover OR while menu is open */}
        <div className={cn(
          'flex items-center gap-0.5 ml-auto',
          menuOpen ? 'flex' : 'invisible group-hover/item:visible'
        )}>
          {/* 3-dot menu */}
          <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenu.Trigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[190px] bg-popover border border-border rounded-lg shadow-lg p-1 z-[100] animate-fade-in"
                align="start"
                sideOffset={4}
                onInteractOutside={() => setMenuOpen(false)}
              >
                <DropdownMenu.Item className="dropdown-item" onClick={onToggleFavorite}>
                  <Star className={cn('w-4 h-4', isFavorite && 'fill-yellow-400 text-yellow-400')} />
                  {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-item"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${getPageUrl(workspaceId, page.id)}`)
                    toast.success('Link copied')
                  }}
                >
                  <Link className="w-4 h-4" />
                  Copy link
                </DropdownMenu.Item>
                <DropdownMenu.Item className="dropdown-item" onClick={onCreateChild}>
                  <Plus className="w-4 h-4" />
                  Add sub-page
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item
                  className="dropdown-item text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Quick add sub-page */}
          <button
            onClick={(e) => { e.stopPropagation(); onCreateChild() }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
