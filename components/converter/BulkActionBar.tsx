import { Trash2, CheckCircle, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  count:       number
  onDelete:    () => void
  onVerify:    () => void
  onUnverify:  () => void
  onDeselect:  () => void
}

export default function BulkActionBar({ count, onDelete, onVerify, onUnverify, onDeselect }: Props) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2">
      <span className="text-sm font-semibold text-blue-700">{count} selected</span>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-green-700 hover:bg-green-100" onClick={onVerify}>
        <CheckCircle className="h-3.5 w-3.5" /> Verify
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:bg-muted" onClick={onUnverify}>
        <RotateCcw className="h-3.5 w-3.5" /> Unverify
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
      <button onClick={onDeselect} className="ml-auto rounded p-1 text-blue-500 hover:bg-blue-100 transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
