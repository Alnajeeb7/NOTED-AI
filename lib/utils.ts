import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, yyyy')
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getPageUrl(workspaceId: string, pageId: string): string {
  return `/workspace/${workspaceId}/page/${pageId}`
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function extractTextFromContent(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content

  // Extract text from BlockNote JSON
  try {
    const blocks = content as Array<{ content?: Array<{ text?: string }>; children?: unknown[] }>
    const texts: string[] = []

    const extractFromBlock = (block: typeof blocks[number]) => {
      if (block.content) {
        block.content.forEach((inline) => {
          if (inline.text) texts.push(inline.text)
        })
      }
      if (block.children) {
        (block.children as typeof blocks).forEach(extractFromBlock)
      }
    }

    blocks.forEach(extractFromBlock)
    return texts.join(' ')
  } catch {
    return ''
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export const COVER_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #2af598 0%, #009efd 100%)',
  'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
]

export const DEFAULT_ICONS = ['📝', '📄', '🗒️', '📋', '📌', '🔖', '💡', '🎯', '🚀', '✨', '🌟', '💫']
