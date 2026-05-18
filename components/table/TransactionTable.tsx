'use client'
/**
 * components/table/TransactionTable.tsx
 * TanStack Table v8 + Virtual Scrolling
 * - Sticky headers (Priority 1)
 * - 1000+ row performance (Priority 4)
 * - All row states: error, warn, duplicate, redflag, verified, learned
 * - Inline editing with audit trail
 * - Bulk select with checkboxes
 */

import React, { useRef, useMemo, useCallback } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState, type RowSelectionState,
} from '@tanstack/react-table'
import { useVirtualizer }    from '@tanstack/react-virtual'
import { ArrowUpDown, Brain, Sparkles, AlertTriangle, Copy, Trash2, ArrowUpFromLine, ArrowDownFromLine } from 'lucide-react'
import type { EnrichedTransaction, AuditEntry } from '@/types'
import { cn, formatGBP, cleanNumber }            from '@/lib/utils'

interface Props {
  data:           EnrichedTransaction[]
  onCellEdit:     (idx: number, field: keyof EnrichedTransaction, value: string) => void
  onMoveAmount:   (idx: number, dir: 'toIn' | 'toOut') => void
  onInsertRow:    (idx: number, pos: 'above' | 'below') => void
  onDuplicateRow: (idx: number) => void
  onDeleteRow:    (idx: number) => void
  onLearn:        (idx: number, raw: string, corrected: string) => void
  selectedRows:   RowSelectionState
  onSelectionChange: (s: RowSelectionState) => void
}

// Red flag keywords
const RED_FLAGS = /hmrc|vat|dividend|director|transfer|loan|bounce|unpaid|dishonoured|liquidat|insolvency|court|penalty|fraud/i

export default function TransactionTable({
  data, onCellEdit, onMoveAmount, onInsertRow,
  onDuplicateRow, onDeleteRow, onLearn,
  selectedRows, onSelectionChange,
}: Props) {

  const [sorting, setSorting] = React.useState<SortingState>([])
  const parentRef = useRef<HTMLDivElement>(null)

  // ── Column definitions ────────────────────────────────────
  const columns = useMemo<ColumnDef<EnrichedTransaction>[]>(() => [

    // Checkbox
    {
      id: 'select',
      size: 36,
      header: ({ table }) => (
        <input type="checkbox" className="rounded"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox" className="rounded"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      enableSorting: false,
    },

    // Date
    {
      accessorKey: 'date',
      header: 'Date',
      size: 110,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.date}
          onChange={v => onCellEdit(row.index, 'date', v)}
          className="text-muted-foreground text-xs"
        />
      ),
    },

    // Type
    {
      accessorKey: 'txtype',
      header: 'Type',
      size: 72,
      cell: ({ row }) => (
        <TypeSelect
          value={row.original.txtype}
          onChange={v => onCellEdit(row.index, 'txtype', v)}
        />
      ),
    },

    // Description + smart badges
    {
      accessorKey: 'description',
      header: 'Description',
      size: 280,
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <EditableCell
                value={t.description}
                onChange={v => onCellEdit(row.index, 'description', v)}
                className={cn('flex-1', t._match.modified && 'modified')}
              />
              {/* Audit dot for modified cells */}
              {t._ocr?.description && t.description !== t._ocr.description && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
                  title={`OCR original: "${t._ocr.description}"`} />
              )}
            </div>

            {/* Smart badges row */}
            <div className="flex flex-wrap gap-1">
              {t._auto_corrected && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700"
                  title="Auto-corrected by Learning Engine">
                  <Brain className="h-2.5 w-2.5" /> Learned
                </span>
              )}
              {t._suggested && (
                <button
                  onClick={() => onLearn(row.index, t.description, t._suggestion!)}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                  title={`Suggested: "${t._suggestion}" — click to apply`}
                >
                  <Sparkles className="h-2.5 w-2.5" /> {t._suggestion}?
                </button>
              )}
              {t.category && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                  {t.category}
                </span>
              )}
              {t._isRedFlag && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">
                  🚩 Red Flag
                </span>
              )}
              {t._isDuplicate && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700">
                  ⚡ Duplicate
                </span>
              )}
              {t._isVerified && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700">
                  ✓ Verified
                </span>
              )}
              {t._confidence !== null && t._confidence < 0.8 && (
                <span className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  t._confidence < 0.6 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                )} title={`OCR confidence: ${Math.round((t._confidence ?? 0) * 100)}%`}>
                  {Math.round((t._confidence ?? 0) * 100)}% conf
                </span>
              )}
            </div>
          </div>
        )
      },
    },

    // Paid In
    {
      accessorKey: 'paidin',
      header: 'Paid In',
      size: 100,
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="flex items-center gap-1">
            <AmountInput
              value={t.paidin}
              onChange={v => onCellEdit(row.index, 'paidin', v)}
              className="text-green-700"
            />
            {t.paidout && !t.paidin && (
              <button onClick={() => onMoveAmount(row.index, 'toIn')}
                className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition"
                title="Move to Paid In">
                ← In
              </button>
            )}
          </div>
        )
      },
    },

    // Paid Out
    {
      accessorKey: 'paidout',
      header: 'Paid Out',
      size: 100,
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="flex items-center gap-1">
            <AmountInput
              value={t.paidout}
              onChange={v => onCellEdit(row.index, 'paidout', v)}
              className="text-red-600"
            />
            {t.paidin && !t.paidout && (
              <button onClick={() => onMoveAmount(row.index, 'toOut')}
                className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition"
                title="Move to Paid Out">
                Out →
              </button>
            )}
          </div>
        )
      },
    },

    // Balance + validation
    {
      accessorKey: 'balance',
      header: 'Balance',
      size: 110,
      cell: ({ row }) => {
        const t   = row.original
        const v   = t._val
        const err = v?.balImpossible && v.status === 'error'
        const wrn = v?.balImpossible && v.status === 'warn'
        return (
          <div className="space-y-0.5">
            <AmountInput
              value={t.balance}
              onChange={v2 => onCellEdit(row.index, 'balance', v2)}
              className={cn(
                'text-amber-700',
                err && 'cell-impossible text-red-600',
                wrn && 'border-amber-400 bg-amber-50 text-amber-700',
                t._parseWarn && 'border-amber-400'
              )}
            />
            {err && (
              <p className="text-[10px] font-semibold text-red-600">
                Exp: {formatGBP(v!.expected ?? 0)}
              </p>
            )}
            {t._parseWarn && (
              <p className="text-[10px] text-amber-600">⚠ Cannot parse</p>
            )}
          </div>
        )
      },
    },

    // Validation badge
    {
      id: 'validation',
      header: 'Check',
      size: 90,
      cell: ({ row }) => {
        const v = row.original._val
        if (!v || v.status === 'skip') return <span className="text-xs text-muted-foreground">—</span>
        return (
          <span className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            v.status === 'ok'    && 'bg-green-100 text-green-700',
            v.status === 'warn'  && 'bg-amber-100 text-amber-700',
            v.status === 'error' && 'bg-red-100 text-red-700',
          )}>
            {v.status === 'ok'    && '✓ OK'}
            {v.status === 'warn'  && `⚠ £${Math.abs(v.diff).toFixed(2)}`}
            {v.status === 'error' && `✗ £${Math.abs(v.diff).toFixed(2)}`}
          </span>
        )
      },
      enableSorting: false,
    },

    // Row actions
    {
      id: 'actions',
      header: '',
      size: 90,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <ActionBtn onClick={() => onInsertRow(row.index, 'above')} title="Insert above">
            <ArrowUpFromLine className="h-3 w-3" />
          </ActionBtn>
          <ActionBtn onClick={() => onInsertRow(row.index, 'below')} title="Insert below">
            <ArrowDownFromLine className="h-3 w-3" />
          </ActionBtn>
          <ActionBtn onClick={() => onDuplicateRow(row.index)} title="Duplicate">
            <Copy className="h-3 w-3" />
          </ActionBtn>
          <ActionBtn onClick={() => onDeleteRow(row.index)} title="Delete" danger>
            <Trash2 className="h-3 w-3" />
          </ActionBtn>
        </div>
      ),
      enableSorting: false,
    },
  ], [onCellEdit, onMoveAmount, onInsertRow, onDuplicateRow, onDeleteRow, onLearn])

  const table = useReactTable({
    data,
    columns,
    state:              { sorting, rowSelection: selectedRows },
    onSortingChange:    setSorting,
    onRowSelectionChange: onSelectionChange,
    getCoreRowModel:    getCoreRowModel(),
    getSortedRowModel:  getSortedRowModel(),
    getFilteredRowModel:getFilteredRowModel(),
    enableRowSelection: true,
  })

  const { rows } = table.getRowModel()

  // Virtual scrolling — only renders visible rows
  const virtualizer = useVirtualizer({
    count:         rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize:  () => 52,
    overscan:      15,
  })

  const virtualRows   = virtualizer.getVirtualItems()
  const totalSize     = virtualizer.getTotalSize()
  const paddingTop    = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0

  return (
    <div ref={parentRef} className="table-scroll relative">
      <table className="sticky-table w-full border-collapse text-sm">

        {/* Sticky headers */}
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(header => (
                <th
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                >
                  {header.isPlaceholder ? null : (
                    <div
                      className={cn('flex items-center gap-1', header.column.getCanSort() && 'cursor-pointer select-none')}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {/* Virtual spacer top */}
          {paddingTop > 0 && <tr><td style={{ height: paddingTop }} /></tr>}

          {virtualRows.map(vr => {
            const row = rows[vr.index]
            const t   = row.original
            return (
              <tr
                key={row.id}
                className={cn(
                  'group border-b border-border transition-colors hover:bg-muted/40',
                  t._val?.status === 'error' && 'row-error',
                  t._val?.status === 'warn'  && 'row-warn',
                  t._isDuplicate             && 'row-duplicate',
                  t._isRedFlag && !t._isDuplicate && 'row-redflag',
                  t._isVerified              && 'row-verified',
                  t._auto_corrected          && 'row-learned',
                  t._suggested               && 'row-suggested',
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="px-3 py-1.5 align-middle"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}

          {/* Virtual spacer bottom */}
          {paddingBottom > 0 && <tr><td style={{ height: paddingBottom }} /></tr>}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No transactions match your filters.
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────
function EditableCell({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <input
      className={cn('cell-input', className)}
      defaultValue={value}
      onBlur={e => { if (e.target.value !== value) onChange(e.target.value) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

function AmountInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <input
      className={cn('cell-input text-right font-mono text-xs font-medium', className)}
      defaultValue={value}
      placeholder="—"
      onFocus={e => e.target.select()}
      onBlur={e => { if (e.target.value !== value) onChange(e.target.value) }}
    />
  )
}

function TypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const types = ['','POS','DPC','POC','CHG','BAC','S/O','D/D','SBT','FPO','BGC','TRF','ATM','CR','DR','OTHER']
  return (
    <select
      className="rounded border-transparent bg-transparent text-xs font-semibold text-primary hover:border-border hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring px-1 py-0.5 transition"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {types.map(t => <option key={t} value={t}>{t || '—'}</option>)}
    </select>
  )
}

function ActionBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'rounded p-1 transition',
        danger
          ? 'text-muted-foreground hover:bg-red-100 hover:text-red-600'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
