'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props { file: File }

export default function PdfViewer({ file }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const pdfRef     = useRef<any>(null)
  const [page,     setPage]     = useState(1)
  const [total,    setTotal]    = useState(1)
  const [scale,    setScale]    = useState(1.2)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`

        if (pdfRef.current) {
          try { await pdfRef.current.cleanup(); await pdfRef.current.destroy() } catch {}
        }

        const url      = URL.createObjectURL(file)
        const loadTask = pdfjsLib.getDocument(url)

        // Handle password via promise rejection
        const pdf = await loadTask.promise.catch((err: any) => {
          if (err?.name === 'PasswordException') {
            const pwd = prompt('🔒 PDF is password protected. Enter password:')
            if (pwd) {
              loadTask.onPassword = (cb: any) => cb(pwd)
              return pdfjsLib.getDocument({ url, password: pwd }).promise
            } else {
              throw new Error('Cannot open password-protected PDF without password.')
            }
          }
          throw err
        })

        if (cancelled) return
        pdfRef.current = pdf
        setTotal(pdf.numPages)
        setPage(1)
        setLoading(false)
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load PDF')
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [file])

  useEffect(() => {
    if (!pdfRef.current || loading) return
    let cancelled = false
    async function render() {
      try {
        const pg       = await pdfRef.current.getPage(page)
        const viewport = pg.getViewport({ scale })
        const canvas   = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width  = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        await pg.render({ canvasContext: ctx, viewport }).promise
      } catch {}
    }
    render()
    return () => { cancelled = true }
  }, [page, scale, loading])

  if (error) return (
    <div className="flex h-full items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
  )

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page<=1}>
          <ChevronLeft className="h-4 w-4"/>
        </Button>
        <span className="min-w-[70px] text-center text-xs text-muted-foreground">
          {loading ? '…' : `${page} / ${total}`}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.min(total, p+1))} disabled={page>=total}>
          <ChevronRight className="h-4 w-4"/>
        </Button>
        <div className="ml-2 h-4 w-px bg-border"/>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.max(0.4, +(s-0.2).toFixed(1)))}>
          <ZoomOut className="h-4 w-4"/>
        </Button>
        <span className="min-w-[40px] text-center text-xs">{Math.round(scale*100)}%</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.min(3, +(s+0.2).toFixed(1)))}>
          <ZoomIn className="h-4 w-4"/>
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(1.2)}>
          <RotateCcw className="h-3.5 w-3.5"/>
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {loading
          ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading PDF…</div>
          : <canvas ref={canvasRef} className="block rounded shadow-sm" />
        }
      </div>
    </div>
  )
}
