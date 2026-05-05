'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import {
  X, Sun, Moon, Monitor, LogOut, User, Building2, Check,
  Keyboard, Info, Bell, Trash2, RefreshCw, Lock, PenLine,
  ChevronRight, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

type Tab = 'account' | 'workspace' | 'appearance' | 'notifications' | 'shortcuts' | 'about'

const SHORTCUTS = [
  { category: 'Navigation', items: [
    { label: 'Search', keys: ['⌘', 'K'] },
    { label: 'Open Settings', keys: ['⌘', ','] },
    { label: 'New page', keys: ['⌘', 'N'] },
    { label: 'Toggle sidebar', keys: ['⌘', '\\'] },
  ]},
  { category: 'Editor', items: [
    { label: 'Bold', keys: ['⌘', 'B'] },
    { label: 'Italic', keys: ['⌘', 'I'] },
    { label: 'Underline', keys: ['⌘', 'U'] },
    { label: 'Strikethrough', keys: ['⌘', 'Shift', 'S'] },
    { label: 'Heading 1', keys: ['#', 'Space'] },
    { label: 'Heading 2', keys: ['##', 'Space'] },
    { label: 'Heading 3', keys: ['###', 'Space'] },
    { label: 'Bullet list', keys: ['-', 'Space'] },
    { label: 'Numbered list', keys: ['1.', 'Space'] },
    { label: 'To-do item', keys: ['[]', 'Space'] },
  ]},
  { category: 'Page', items: [
    { label: 'Save', keys: ['⌘', 'S'] },
    { label: 'Undo', keys: ['⌘', 'Z'] },
    { label: 'Redo', keys: ['⌘', 'Shift', 'Z'] },
  ]},
]

const WORKSPACE_ICONS = ['🗒️','📚','🏠','🚀','💼','🎯','🌿','⚡','🔬','💎','🎨','🌍']

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { user, workspace, setWorkspace, compactSidebar, setCompactSidebar, alwaysSidebar, setAlwaysSidebar } = useAppStore()
  const [tab, setTab] = useState<Tab>('account')
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || '')
  const [workspaceIcon, setWorkspaceIcon] = useState(workspace?.icon || '🗒️')
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [notifs, setNotifs] = useState({ pageUpdates: true, aiSummaries: false, weeklyDigest: true })

  useEffect(() => {
    setWorkspaceName(workspace?.name || '')
    setWorkspaceIcon(workspace?.icon || '🗒️')
    setFullName(user?.full_name || '')
  }, [workspace, user])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleSaveAccount = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('user_profiles')
      .update({ full_name: fullName } as any)
      .eq('id', user?.id ?? '')
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Profile updated')
  }

  const handleSaveWorkspace = async () => {
    if (!workspace) return
    setSaving(true)
    const { error } = await supabase
      .from('workspaces')
      .update({ name: workspaceName, icon: workspaceIcon })
      .eq('id', workspace.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else {
      setWorkspace({ ...workspace, name: workspaceName, icon: workspaceIcon })
      toast.success('Workspace updated')
    }
  }

  const handlePasswordReset = async () => {
    if (!user?.email) return
    const { error } = await supabase.auth.resetPasswordForEmail(user.email)
    if (error) toast.error(error.message)
    else { setResetSent(true); toast.success('Password reset email sent!') }
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'workspace', label: 'Workspace', icon: Building2 },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    { id: 'about', label: 'About', icon: Info },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative w-full max-w-2xl bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex"
        style={{ height: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sidebar tabs ── */}
        <div className="w-44 shrink-0 border-r border-border bg-muted/30 p-3 flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mb-1">Settings</p>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left',
                tab === id
                  ? 'bg-background text-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}

          <div className="mt-auto border-t border-border pt-2">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors w-full"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              Sign out
            </button>
          </div>
        </div>

        {/* ── Content panel ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold">
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* ════ Account ════ */}
            {tab === 'account' && (
              <>
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center text-2xl font-bold shrink-0 select-none">
                    {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                {/* Display name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
                  />
                </div>

                {/* Email (read-only) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                  <div className="px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    {user?.email}
                  </div>
                </div>

                <button
                  onClick={handleSaveAccount}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
                >
                  {saving ? <span className="w-3.5 h-3.5 border-2 border-background/30 border-t-background rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save profile
                </button>

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security</p>
                  <button
                    onClick={handlePasswordReset}
                    disabled={resetSent}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:bg-accent disabled:opacity-50 transition"
                  >
                    {resetSent ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Lock className="w-3.5 h-3.5" />}
                    {resetSent ? 'Reset email sent!' : 'Change password'}
                  </button>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Danger zone</p>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out of all devices
                  </button>
                </div>
              </>
            )}

            {/* ════ Workspace ════ */}
            {tab === 'workspace' && (
              <>
                {/* Workspace icon picker */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workspace icon</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {WORKSPACE_ICONS.map((ic) => (
                      <button
                        key={ic}
                        onClick={() => setWorkspaceIcon(ic)}
                        className={cn(
                          'h-9 rounded-xl border text-lg transition-all',
                          workspaceIcon === ic
                            ? 'border-foreground bg-foreground/5 scale-105'
                            : 'border-border hover:border-foreground/40 hover:bg-accent'
                        )}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Workspace name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
                  <input
                    id="workspace-name-input"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
                    placeholder="My Workspace"
                  />
                </div>

                {/* Workspace ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workspace ID</label>
                  <div
                    className="px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground font-mono truncate cursor-pointer hover:bg-muted/50 transition"
                    onClick={() => { navigator.clipboard.writeText(workspace?.id || ''); toast.success('ID copied') }}
                    title="Click to copy"
                  >
                    {workspace?.id}
                  </div>
                </div>

                <button
                  id="save-workspace-btn"
                  onClick={handleSaveWorkspace}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
                >
                  {saving ? <span className="w-3.5 h-3.5 border-2 border-background/30 border-t-background rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save workspace
                </button>

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Total pages', value: useAppStore.getState().pages.length },
                      { label: 'Starred', value: useAppStore.getState().favorites.length },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-3 py-2.5 rounded-xl border border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ════ Appearance ════ */}
            {tab === 'appearance' && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-3">Theme</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'light', label: 'Light', icon: Sun },
                      { value: 'dark', label: 'Dark', icon: Moon },
                      { value: 'system', label: 'System', icon: Monitor },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                          theme === value
                            ? 'border-foreground bg-foreground/5'
                            : 'border-border hover:border-foreground/40 hover:bg-accent'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{label}</span>
                        {theme === value && <Check className="w-3 h-3 text-foreground" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-3">Editor font size</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Small', cls: 'text-sm' },
                      { label: 'Default', cls: 'text-base' },
                      { label: 'Large', cls: 'text-lg' },
                    ].map(({ label, cls }, i) => (
                      <button
                        key={label}
                        className={cn(
                          'py-3 rounded-xl border text-center transition-all',
                          i === 1
                            ? 'border-foreground bg-foreground/5'
                            : 'border-border hover:border-foreground/40 hover:bg-accent',
                          cls
                        )}
                      >
                        Aa
                        <p className="text-xs mt-1 text-muted-foreground" style={{ fontSize: 11 }}>{label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">Interface</label>
                  {[
                    { label: 'Compact sidebar', desc: 'Reduce sidebar item spacing', value: compactSidebar, onChange: setCompactSidebar },
                    { label: 'Always show sidebar', desc: 'Keep sidebar pinned on all screens', value: alwaysSidebar, onChange: setAlwaysSidebar },
                  ].map(({ label, desc, value, onChange }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <button
                        onClick={() => onChange(!value)}
                        className={cn(
                          'w-10 h-5 rounded-full border-2 relative transition-all duration-200',
                          value ? 'border-foreground bg-foreground' : 'border-border bg-muted'
                        )}
                      >
                        <span className={cn(
                          'w-3.5 h-3.5 rounded-full absolute top-0.5 transition-transform duration-200',
                          value ? 'bg-background translate-x-5' : 'bg-muted-foreground translate-x-0.5'
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ════ Notifications ════ */}
            {tab === 'notifications' && (
              <>
                <p className="text-sm text-muted-foreground">Choose what you want to be notified about.</p>
                <div className="space-y-4 mt-2">
                  {[
                    { key: 'pageUpdates' as const, label: 'Page updates', desc: 'Get notified when pages are edited' },
                    { key: 'aiSummaries' as const, label: 'AI summaries', desc: 'Receive AI-generated daily summaries' },
                    { key: 'weeklyDigest' as const, label: 'Weekly digest', desc: 'A weekly roundup of your activity' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifs((n) => ({ ...n, [key]: !n[key] }))}
                        className={cn(
                          'w-10 h-5 rounded-full border-2 relative transition-all duration-200',
                          notifs[key]
                            ? 'border-foreground bg-foreground'
                            : 'border-border bg-muted'
                        )}
                      >
                        <span className={cn(
                          'w-3.5 h-3.5 rounded-full absolute top-0.5 transition-transform duration-200',
                          notifs[key]
                            ? 'bg-background translate-x-5'
                            : 'bg-muted-foreground translate-x-0.5'
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ════ Shortcuts ════ */}
            {tab === 'shortcuts' && (
              <div className="space-y-6">
                {SHORTCUTS.map(({ category, items }) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
                    <div className="space-y-1">
                      {items.map(({ label, keys }) => (
                        <div key={label} className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <div className="flex items-center gap-1">
                            {keys.map((k, i) => (
                              <kbd
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-muted border border-border text-[11px] font-mono text-muted-foreground"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ════ About ════ */}
            {tab === 'about' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center">
                    <PenLine className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Noted</p>
                    <p className="text-xs text-muted-foreground">Version 1.0.0 — AI-powered workspace</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'Next.js', value: '14.x' },
                    { label: 'Editor', value: 'BlockNote' },
                    { label: 'Database', value: 'Supabase' },
                    { label: 'AI Model', value: 'Groq / Llama 3.3' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium font-mono">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  {[
                    { label: 'Check for updates', icon: RefreshCw },
                    { label: 'Privacy Policy', icon: Shield },
                    { label: 'Clear local cache', icon: Trash2 },
                  ].map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (label === 'Clear local cache') {
                          localStorage.removeItem('noted-store')
                          toast.success('Cache cleared — reload to apply')
                        } else {
                          toast('Coming soon', { icon: '🔜' })
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        {label}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
