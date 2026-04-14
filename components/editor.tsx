'use client'

import { useEffect, useRef } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import type { Block } from '@blocknote/core'

interface EditorProps {
  initialContent?: Block[] | null
  onChange?: (content: Block[]) => void
}

export default function Editor({ initialContent, onChange }: EditorProps) {
  const editor = useCreateBlockNote({
    initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
  })

  const changeRef = useRef(onChange)
  changeRef.current = onChange

  useEffect(() => {
    if (!editor) return
    const unsubscribe = editor.onChange(() => {
      changeRef.current?.(editor.document as Block[])
    })
    return () => unsubscribe?.()
  }, [editor])

  return (
    <div id="bn-editor-focus" tabIndex={-1}>
      <BlockNoteView editor={editor} theme="light" />
    </div>
  )
}
