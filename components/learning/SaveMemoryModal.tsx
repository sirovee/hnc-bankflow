'use client'
import { useState } from 'react'
import { Brain, X } from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'

const CATEGORIES = ['','🛒 Shopping','💡 Utilities','🚗 Transport','🏦 Banking/Loan',
  '📣 Marketing','💼 Payroll','🏛 HMRC / Tax','💼 Dividend','👤 Director Payment',
  '📋 Professional','🛡 Insurance','🏠 Property','💻 Technology','OTHER']

interface Props {
  open:      boolean
  raw:       string
  corrected: string
  onClose:   () => void
  onSave:    (raw: string, corrected: string, category: string, remember: boolean) => Promise<void>
}

export default function SaveMemoryModal({ open, raw, corrected, onClose, onSave }: Props) {
  const [corr,     setCorr]     = useState(corrected)
  const [category, setCategory] = useState('')
  const [remember, setRemember] = useState(true)
  const [saving,   setSaving]   = useState(false)

  if (!open) return null

  async function handleSave() {
    setSaving(true)
    await onSave(raw, corr, category, remember)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Brain className="h-4 w-4 text-violet-600"/>
            </div>
            <div>
              <h2 className="text-sm font-semibold">Learning Engine</h2>
              <p className="text-xs text-muted-foreground">Apply a correction to this description</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4"/>
          </button>
        </div>

        <div className="space-y-4">
          {/* Original */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">OCR Original</p>
            <p className="mt-0.5 font-mono text-sm">{raw}</p>
          </div>

          {/* Correction */}
          <div className="space-y-1.5">
            <Label>Corrected description</Label>
            <Input value={corr} onChange={e => setCorr(e.target.value)} placeholder="Enter correct name…"/>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category (optional)</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c || '— Select category —'}</option>)}
            </select>
          </div>

          {/* Remember toggle */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={remember} onChange={e => setRemember(e.target.checked)}/>
            <div>
              <p className="text-sm font-medium">Save to my dictionary</p>
              <p className="text-xs text-muted-foreground">Auto-apply this correction next time the same text appears</p>
            </div>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Brain className="h-4 w-4"/>
            {saving ? 'Saving…' : 'Apply correction'}
          </Button>
        </div>
      </div>
    </div>
  )
}
