'use client'

import { useMemo } from 'react'
import { X, BarChart3, TrendingUp, Calendar, MessageSquare, FileText, Target } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface LearningAnalyticsProps {
  open: boolean
  onClose: () => void
}

// Generate a 12-week activity heatmap from AI messages
function buildHeatmap(messages: { timestamp: string }[]) {
  const counts: Record<string, number> = {}
  messages.forEach((m) => {
    const date = m.timestamp.slice(0, 10)
    counts[date] = (counts[date] || 0) + 1
  })

  const today = new Date()
  const cells: { date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const count = counts[dateStr] || 0
    const intensity: 0 | 1 | 2 | 3 | 4 = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4
    cells.push({ date: dateStr, count, intensity })
  }
  return cells
}

const INTENSITY_COLORS = [
  'bg-muted',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-400 dark:bg-emerald-700',
  'bg-emerald-500 dark:bg-emerald-500',
  'bg-emerald-600 dark:bg-emerald-400',
]

export function LearningAnalytics({ open, onClose }: LearningAnalyticsProps) {
  const { aiMessages, pages, aiMode, userMemory, activePlan, sessionMessages } = useAppStore()

  const heatmap = useMemo(() => buildHeatmap(aiMessages), [aiMessages])

  const totalDays = heatmap.filter((c) => c.count > 0).length
  const totalInteractions = aiMessages.filter((m) => m.role === 'user').length
  const thisWeek = heatmap.slice(-7).reduce((sum, c) => sum + c.count, 0)

  if (!open) return null

  const stats = [
    { label: 'Total Interactions', value: totalInteractions, icon: MessageSquare, color: 'text-blue-500' },
    { label: 'Pages Created', value: pages.length, icon: FileText, color: 'text-violet-500' },
    { label: 'Active Days', value: totalDays, icon: Calendar, color: 'text-emerald-500' },
    { label: 'This Week', value: thisWeek, icon: TrendingUp, color: 'text-amber-500' },
  ]

  // Mode distribution
  const modeCounts = { chat: 0, agentic: 0, plan: 0, explore: 0 }
  aiMessages.forEach((m) => {
    if (m.role === 'user' && m.mode) modeCounts[m.mode] = (modeCounts[m.mode] || 0) + 1
  })
  const modeTotal = Object.values(modeCounts).reduce((a, b) => a + b, 0) || 1

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <BarChart3 className="w-5 h-5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Learning Analytics</h2>
            <p className="text-[11px] text-muted-foreground">Your progress & performance heatmap</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="px-4 py-3 rounded-xl border border-border bg-muted/30">
                <Icon className={cn('w-4 h-4 mb-2', color)} />
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Activity Heatmap */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity Heatmap (12 weeks)</p>
            <div className="flex gap-0.5">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 mr-1">
                {weekDays.map((d, i) => (
                  <div key={d} className={cn('text-[8px] text-muted-foreground h-3 flex items-center', i % 2 !== 0 && 'opacity-0')}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Grid: 12 cols × 7 rows */}
              <div className="flex gap-0.5 flex-1">
                {Array.from({ length: 12 }).map((_, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-0.5 flex-1">
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const cellIdx = weekIdx * 7 + dayIdx
                      const cell = heatmap[cellIdx]
                      if (!cell) return <div key={dayIdx} className="h-3 rounded-sm bg-transparent" />
                      return (
                        <div
                          key={dayIdx}
                          title={`${cell.date}: ${cell.count} interactions`}
                          className={cn('h-3 rounded-sm transition-colors cursor-default', INTENSITY_COLORS[cell.intensity])}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 justify-end">
              <span className="text-[9px] text-muted-foreground">Less</span>
              {INTENSITY_COLORS.map((c, i) => (
                <div key={i} className={cn('w-3 h-3 rounded-sm', c)} />
              ))}
              <span className="text-[9px] text-muted-foreground">More</span>
            </div>
          </div>

          {/* Mode Distribution */}
          {modeTotal > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mode Usage</p>
              {Object.entries(modeCounts).map(([mode, count]) => {
                const pct = Math.round((count / modeTotal) * 100)
                const colors: Record<string, string> = { chat: 'bg-foreground', agentic: 'bg-violet-500', plan: 'bg-blue-500', explore: 'bg-emerald-500' }
                const icons: Record<string, string> = { chat: '💬', agentic: '⚡', plan: '🗺️', explore: '🔭' }
                return (
                  <div key={mode} className="flex items-center gap-2">
                    <span className="text-[11px] w-20 text-muted-foreground capitalize">{icons[mode]} {mode}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', colors[mode])} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-6 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Active Plan Progress */}
          {activePlan && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Learning Plan</p>
              <div className="px-4 py-3 rounded-xl border border-border bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  <p className="text-xs font-medium flex-1">{activePlan.title}</p>
                  <span className="text-xs font-bold text-blue-500">{activePlan.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${activePlan.progress}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {activePlan.days.filter((d) => d.isComplete).length} / {activePlan.days.length} days complete · Goal: {activePlan.goal}
                </p>
              </div>
            </div>
          )}

          {/* Personalization summary */}
          {userMemory && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Memory Summary</p>
              <div className="px-3 py-2.5 rounded-lg border border-border bg-muted/30 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depth preference</span>
                  <span className="capitalize font-medium">{userMemory.preferredDepth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tone preference</span>
                  <span className="capitalize font-medium">{userMemory.preferredTone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Knowledge contexts</span>
                  <span className="font-medium">{userMemory.uploadedContexts.length} uploaded</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weak areas tracked</span>
                  <span className="font-medium">{userMemory.weakAreas.length}</span>
                </div>
              </div>
            </div>
          )}

          {totalInteractions === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs opacity-70">Start chatting with AI to see your analytics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
