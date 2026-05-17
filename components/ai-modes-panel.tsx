'use client'

import { useState } from 'react'
import { Zap, Map, Telescope, MessageSquare, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { AI_MODES } from '@/lib/ai-modes'
import { cn } from '@/lib/utils'
import type { AIMode } from '@/types'

const MODE_ICONS: Record<AIMode, React.ReactNode> = {
  chat:    <MessageSquare className="w-3.5 h-3.5" />,
  agentic: <Zap className="w-3.5 h-3.5" />,
  plan:    <Map className="w-3.5 h-3.5" />,
  explore: <Telescope className="w-3.5 h-3.5" />,
}

const MODE_COLORS: Record<AIMode, string> = {
  chat:    'border-border text-foreground bg-muted/40',
  agentic: 'border-violet-500/40 text-violet-500 bg-violet-500/5',
  plan:    'border-blue-500/40 text-blue-500 bg-blue-500/5',
  explore: 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5',
}

const MODE_ACTIVE: Record<AIMode, string> = {
  chat:    'border-foreground/40 bg-foreground/5',
  agentic: 'border-violet-500 bg-violet-500/10',
  plan:    'border-blue-500 bg-blue-500/10',
  explore: 'border-emerald-500 bg-emerald-500/10',
}

const MODE_SUGGESTIONS: Record<AIMode, string[]> = {
  chat: [
    'Create a meeting notes page',
    'List all my pages',
    'Write a project roadmap',
  ],
  agentic: [
    'Break down Dynamic Programming into subtopics and create pages for each',
    'Generate 10 practice problems for Greedy algorithms with solutions',
    'Analyze all my pages and suggest what I should study next',
  ],
  plan: [
    'Create a 2-week interview prep plan for DSA topics',
    'Build a 30-day exam schedule for Algorithm Analysis',
    'Make a mastery plan for Backtracking and Divide & Conquer',
  ],
  explore: [
    'Explain how Backtracking relates to Dynamic Programming',
    'Show me real-world applications of Greedy algorithms',
    'What are the deeper connections between recursion and tree structures?',
  ],
}

interface AIModesPanelProps {
  onSuggestionClick: (text: string) => void
}

export function AiModesPanel({ onSuggestionClick }: AIModesPanelProps) {
  const { aiMode, setAiMode, clearAiMessages } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const handleModeChange = (mode: AIMode) => {
    if (mode === aiMode) return
    setAiMode(mode)
    clearAiMessages()
  }

  const currentMode = AI_MODES.find((m) => m.id === aiMode) || AI_MODES[0]

  return (
    <div className="border-b border-border">
      {/* Mode selector row */}
      <div className="flex items-center gap-1 px-2 py-2">
        {AI_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleModeChange(mode.id)}
            title={mode.description}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all',
              aiMode === mode.id ? MODE_ACTIVE[mode.id] : 'border-transparent text-muted-foreground hover:bg-accent'
            )}
          >
            {MODE_ICONS[mode.id]}
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
        >
          <Info className="w-3 h-3" />
        </button>
      </div>

      {/* Info box */}
      {showInfo && (
        <div className={cn('mx-2 mb-2 px-3 py-2 rounded-lg border text-xs leading-relaxed', MODE_COLORS[aiMode])}>
          <span className="font-semibold">{currentMode.icon} {currentMode.label} Mode</span>
          <p className="mt-0.5 opacity-80">{currentMode.description}</p>
          {aiMode === 'agentic' && <p className="mt-1 opacity-70">⚠️ Agentic mode can autonomously create and edit multiple pages. Review changes carefully.</p>}
        </div>
      )}

      {/* Suggestions */}
      <div className="px-2 pb-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <span>Suggestions for {currentMode.label} mode</span>
          {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>
        {expanded && (
          <div className="mt-1.5 space-y-1">
            {MODE_SUGGESTIONS[aiMode].map((s) => (
              <button
                key={s}
                onClick={() => { onSuggestionClick(s); setExpanded(false) }}
                className="w-full text-left text-[11px] px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground leading-tight"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
