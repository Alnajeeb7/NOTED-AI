import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Extract plain text from a file buffer based on mime type */
async function extractText(buffer: ArrayBuffer, mimeType: string, filename: string): Promise<string> {
  const bytes = new Uint8Array(buffer)

  // Plain text / markdown / CSV
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    filename.endsWith('.md') ||
    filename.endsWith('.txt') ||
    filename.endsWith('.csv')
  ) {
    return new TextDecoder('utf-8').decode(bytes)
  }

  // PDF - basic text extraction (look for text between BT/ET markers)
  if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
    try {
      const pdfText = new TextDecoder('latin1').decode(bytes)
      const textBlocks: string[] = []
      // Extract text objects from PDF stream
      const btEtRegex = /BT\s*(.*?)\s*ET/gs
      const tjRegex = /\(([^)]*)\)\s*Tj/g
      const tfArrayRegex = /\[([^\]]*)\]\s*TJ/g
      let match: RegExpExecArray | null

      // eslint-disable-next-line no-cond-assign
      while ((match = btEtRegex.exec(pdfText)) !== null) {
        const block = match[1]
        let inner: RegExpExecArray | null
        // eslint-disable-next-line no-cond-assign
        while ((inner = tjRegex.exec(block)) !== null) {
          const clean = inner[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ')
          if (clean.trim()) textBlocks.push(clean)
        }
        tjRegex.lastIndex = 0
        // eslint-disable-next-line no-cond-assign
        while ((inner = tfArrayRegex.exec(block)) !== null) {
          const pieces = inner[1].match(/\(([^)]*)\)/g) || []
          const t = pieces.map((p) => p.slice(1, -1)).join('')
          if (t.trim()) textBlocks.push(t)
        }
        tfArrayRegex.lastIndex = 0
      }

      const result = textBlocks.join(' ').replace(/\s+/g, ' ').trim()
      if (result.length > 50) return result

      // Fallback: grab readable ASCII runs
      const ascii = pdfText.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ')
      const words = ascii.match(/[A-Za-z][A-Za-z0-9 ,.'"-]{4,}/g) || []
      return words.join(' ').slice(0, 8000)
    } catch {
      return `[PDF: ${filename} — text extraction limited]`
    }
  }

  // Image — use Groq vision to OCR and describe the image
  if (mimeType.startsWith('image/')) {
    try {
      const GroqSDK = (await import('groq-sdk')).default
      const groq = new GroqSDK({ apiKey: process.env.GROQ_API_KEY })
      const base64 = Buffer.from(bytes).toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64}`
      const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: 'Extract ALL text visible in this image verbatim (OCR). Then provide a thorough description of the image content, layout, diagrams, charts, tables, or any visual elements. Be detailed and structured.' },
            ],
          },
        ],
      })
      const result = response.choices[0]?.message?.content || ''
      return `[IMAGE: ${filename}]

${result}`
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Vision extraction failed'
      return `[IMAGE FILE: ${filename}]
Vision extraction failed: ${msg}`
    }
  }

  return `[FILE: ${filename} — type: ${mimeType}, size: ${Math.round(buffer.byteLength / 1024)} KB]`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const workspaceId = formData.get('workspaceId') as string | null
    const contextName = formData.get('name') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })

    const ALLOWED_TYPES = [
      'text/plain', 'text/markdown', 'text/csv',
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/json',
    ]

    const isAllowed = ALLOWED_TYPES.includes(file.type) ||
      file.name.endsWith('.md') || file.name.endsWith('.txt')

    if (!isAllowed) {
      return NextResponse.json({ error: `File type "${file.type}" not supported. Use PDF, images, or text files.` }, { status: 400 })
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const extractedText = await extractText(buffer, file.type, file.name)

    // Store KB item in the knowledge_base table
    const { data: kbItem, error } = await supabaseAdmin
      .from('knowledge_base')
      .insert({
        workspace_id: workspaceId,
        user_id: session.user.id,
        name: contextName || file.name,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        extracted_text: extractedText,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // Table might not exist yet — return extracted text for in-memory use
      return NextResponse.json({
        success: true,
        id: `local-${Date.now()}`,
        name: contextName || file.name,
        extractedText: extractedText.slice(0, 6000),
        warning: 'KB table not set up — using in-session context',
      })
    }

    return NextResponse.json({
      success: true,
      id: kbItem.id,
      name: kbItem.name,
      extractedText: extractedText.slice(0, 500) + (extractedText.length > 500 ? '…' : ''),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('knowledge_base')
      .select('id, name, file_name, file_type, file_size, created_at, extracted_text')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ items: [] })

    return NextResponse.json({ items: data || [] })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await supabaseAdmin
      .from('knowledge_base')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
