'use client'
import { useCallback, useState } from 'react'
import { Upload, FileText, ShieldCheck, Brain, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props { onFile: (f: File) => void }

const FEATURES = [
  { icon: Brain,       text: 'Learning Engine auto-corrects descriptions' },
  { icon: ShieldCheck, text: 'GDPR compliant — files never stored' },
  { icon: Zap,         text: 'Balance validation on every row' },
]

export default function UploadZone({ onFile }: Props) {
  const [drag, setDrag] = useState(false)

  const handle = useCallback((file: File) => {
    const ok = ['application/pdf','image/png','image/jpeg','image/tiff'].includes(file.type)
    if (!ok) { alert('Please upload a PDF, PNG, JPG or TIFF file.'); return }
    onFile(file)
  }, [onFile])

  return (
    <div className="flex flex-col items-center justify-center flex-1 py-8">
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f=e.dataTransfer.files[0]; if(f) handle(f) }}
        className={cn(
          'relative flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border-2 border-dashed px-10 py-16 text-center transition-all',
          drag ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="text-base font-semibold">Drop your bank statement here</p>
          <p className="mt-1 text-sm text-muted-foreground">PDF · PNG · JPG · TIFF · Scanned or digital</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff" className="hidden"
            onChange={e => { const f=e.target.files?.[0]; if(f) handle(f) }} />
          <Button size="sm" className="pointer-events-none">
            <Upload className="h-4 w-4" /> Choose file
          </Button>
        </label>
        <p className="text-xs text-muted-foreground">Max 20MB · All major UK banks supported</p>
      </div>

      <div className="mt-8 flex gap-8">
        {FEATURES.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-primary" /> {text}
          </div>
        ))}
      </div>
    </div>
  )
}
