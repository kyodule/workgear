import { useRef, useEffect, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

hljs.registerLanguage('json', json)

interface CodeBlockProps {
  code: string
  language?: string
  maxHeight?: string
  className?: string
}

export function CodeBlock({ code, language, maxHeight = '12rem', className }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (codeRef.current && language) {
      codeRef.current.removeAttribute('data-highlighted')
      hljs.highlightElement(codeRef.current)
    }
  }, [code, language])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silent fail
    }
  }

  return (
    <div className={cn('relative group', className)}>
      <pre className={cn('rounded bg-muted p-2 text-sm md:text-xs overflow-auto')} style={maxHeight ? { maxHeight } : undefined}>
        <code ref={codeRef} className={language ? `language-${language}` : ''}>
          {code}
        </code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 rounded p-1 min-h-[44px] min-w-[44px] flex items-center justify-center md:min-h-0 md:min-w-0 text-muted-foreground
                   hover:bg-muted-foreground/20 hover:text-foreground transition-colors"
        title="复制"
        aria-label="复制代码"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
