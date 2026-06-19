'use client'
import { useState, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import type { EnrichedTransaction, ValidationResult, AuditEntry, ReconciliationSummary, ProcessingStats } from '@/types'
import { safeFloat, cleanNumber } from '@/lib/utils'

const RED = /hmrc|vat|dividend|director|transfer|loan|bounce|unpaid|dishonoured|liquidat|insolvency|court|penalty|fraud/i

function validate(txs: EnrichedTransaction[]): ValidationResult[] {
  const rev=[...txs].reverse(), res=new Array<ValidationResult>(txs.length)
  for(let i=0;i<rev.length;i++){
    const ri=txs.length-1-i, c=rev[i]
    const b=safeFloat(c.balance),inp=safeFloat(c.paidin),outp=safeFloat(c.paidout)
    const pw=!b.ok||!inp.ok||!outp.ok
    if(i===0){res[ri]={status:c.balance?'ok':'skip',diff:0,expected:b.val,balImpossible:false,parseWarn:pw};continue}
    const pb=safeFloat(rev[i-1].balance)
    if(!pb.ok||!c.balance){res[ri]={status:'skip',diff:0,expected:null,balImpossible:false,parseWarn:pw};continue}
    const exp=Math.round((pb.val+inp.val-outp.val)*100)/100
    const diff=Math.round((b.val-exp)*100)/100, abs=Math.abs(diff)
    const status=abs<=0.02?'ok':abs<=1?'warn':'error'
    res[ri]={status,diff,expected:exp,balImpossible:status!=='ok',parseWarn:pw}
  }
  return res
}

function findDups(txs: EnrichedTransaction[]): Set<number> {
  const seen: Record<string,number[]>={}
  txs.forEach((t,i)=>{const k=`${t.date}|${(t.description||'').toLowerCase().trim()}|${t.paidin}|${t.paidout}`;if(!seen[k])seen[k]=[];seen[k].push(i)})
  const dups=new Set<number>()
  Object.values(seen).forEach(ix=>{if(ix.length>1)ix.forEach(i=>dups.add(i))})
  return dups
}

function reconcile(txs: EnrichedTransaction[], openingOv: number|null): ReconciliationSummary|null {
  if(!txs.length)return null
  const oldest=txs[txs.length-1],newest=txs[0]
  // Opening: user override if set, else oldest row's balance reversed by its own movement
  const opening=openingOv!==null?openingOv:Math.round((safeFloat(oldest.balance).val - safeFloat(oldest.paidin).val + safeFloat(oldest.paidout).val)*100)/100
  const totalIn=txs.reduce((s,t)=>s+safeFloat(t.paidin).val,0)
  const totalOut=txs.reduce((s,t)=>s+safeFloat(t.paidout).val,0)
  const calc=Math.round((opening+totalIn-totalOut)*100)/100
  const actual=safeFloat(newest.balance).val
  const diff=Math.round((calc-actual)*100)/100, abs=Math.abs(diff)
  return{openingBalance:opening,totalIn,totalOut,calculatedClose:calc,actualClose:actual,diff,status:abs<=0.02?'balanced':abs<=1?'warning':'error'}
}

function emptyMatch(){return{matched:false,corrected_text:'',category:null,match_type:'none' as const,similarity:0,trust_score:0,overrode_ai:false,entry_id:null}}

export function useTransactions(initial: EnrichedTransaction[]=[]) {
  const[rows,setRows]=useState<EnrichedTransaction[]>(initial)
  const[audit,setAudit]=useState<AuditEntry[]>([])
  const[verified,setVerified]=useState<Set<number>>(new Set())
  const[selected,setSelected]=useState<Record<string,boolean>>({})
  const[openingOverride,setOpeningOverride]=useState<number|null>(null)

  const enriched=useMemo<EnrichedTransaction[]>(()=>{
    const dups=findDups(rows),vals=validate(rows)
    return rows.map((t,i)=>({...t,_val:vals[i]??null,_isDuplicate:dups.has(i),_isRedFlag:RED.test(t.description||''),_isVerified:verified.has(i),_parseWarn:vals[i]?.parseWarn??false,_selected:!!selected[t.id],_isRound:(()=>{const v=Math.max(safeFloat(t.paidin).val,safeFloat(t.paidout).val);return v>=100&&Number.isInteger(v)})()}))
  },[rows,verified,selected])

  const recon=useMemo(()=>reconcile(enriched,openingOverride),[enriched,openingOverride])
  const stats=useMemo<ProcessingStats>(()=>({total:enriched.length,autoCorrected:enriched.filter(t=>t._auto_corrected).length,suggested:enriched.filter(t=>t._suggested).length,lowConfidence:enriched.filter(t=>t._confidence!==null&&(t._confidence??1)<0.8).length,errors:enriched.filter(t=>t._val?.status==='error').length,warnings:enriched.filter(t=>t._val?.status==='warn').length,duplicates:enriched.filter(t=>t._isDuplicate).length,redFlags:enriched.filter(t=>t._isRedFlag).length}),[enriched])

  const editCell=useCallback((idx:number,field:keyof EnrichedTransaction,value:string)=>{
    setRows(prev=>{
      const next=[...prev]
      const old=(next[idx] as unknown as Record<string,string>)[field as string]
      ;(next[idx] as unknown as Record<string,string>)[field as string]=['paidin','paidout','balance'].includes(field as string)?cleanNumber(value).str:value
      setAudit(a=>[{row:idx,field:String(field),label:String(field),desc:next[idx].description||`Row ${idx+1}`,orig:old||'(empty)',edited:value||'(empty)',ts:new Date(),restored:false},...a])
      return next
    })
  },[])

  const addRow=useCallback((idx?:number)=>{
    const id=Math.random().toString(36).slice(2)
    const blank:EnrichedTransaction={id,date:'',txtype:'',description:'',paidin:'',paidout:'',balance:'',_confidence:null,_page:null,_ocr:{},category:null,_match:emptyMatch(),_auto_corrected:false,_suggested:false,_suggestion:null,_isDuplicate:false,_isRedFlag:false,_isVerified:false,_parseWarn:false,_selected:false,_isRound:false,_val:null}
    setRows(prev=>{const next=[...prev];next.splice(idx??0,0,blank);return next})
  },[])

  const deleteRow=useCallback((idx:number)=>{
    if(!confirm(`Delete row ${idx+1}?`))return
    setRows(prev=>prev.filter((_,i)=>i!==idx));toast.success('Row deleted')
  },[])

  const duplicateRow=useCallback((idx:number)=>setRows(prev=>{const next=[...prev];next.splice(idx,0,{...next[idx],id:Math.random().toString(36).slice(2)});return next}),[])

  const moveAmount=useCallback((idx:number,dir:'toIn'|'toOut')=>{
    setRows(prev=>{const next=[...prev];const t={...next[idx]};if(dir==='toIn'){t.paidin=t.paidout;t.paidout=''}else{t.paidout=t.paidin;t.paidin=''};next[idx]=t;return next})
  },[])

  const bulkInvert=useCallback(()=>{
    if(!selectedIndicesRef.current.length)return
    const idxs=selectedIndicesRef.current
    setRows(prev=>{
      const next=[...prev]
      for(const i of idxs){const t={...next[i]};const oldIn=t.paidin;t.paidin=t.paidout;t.paidout=oldIn;next[i]=t}
      return next
    })
    setSelected({})
    toast.success(`Inverted ${idxs.length} rows`)
  },[])

  const restoreEdit=useCallback((ai:number)=>{
    const e=audit[ai];if(!e)return
    if(!confirm(`Restore "${e.orig}"?`))return
    setRows(prev=>{const next=[...prev];(next[e.row] as unknown as Record<string,string>)[e.field]=e.orig==='(empty)'?'':e.orig;return next})
    setAudit(a=>a.filter((_,i)=>i!==ai));toast.success('Restored')
  },[audit])

  const loadTransactions=useCallback((txs:EnrichedTransaction[])=>{setRows(txs);setAudit([]);setVerified(new Set());setSelected({})},[])
  const selectedIndices=useMemo(()=>enriched.map((t,i)=>t._selected?i:-1).filter(i=>i>=0),[enriched])
  const selectedIndicesRef=useRef<number[]>([])
  selectedIndicesRef.current=selectedIndices
  const bulkDelete=useCallback(()=>{if(!selectedIndices.length)return;if(!confirm(`Delete ${selectedIndices.length} rows?`))return;setRows(prev=>prev.filter((_,i)=>!selectedIndices.includes(i)));setSelected({});toast.success('Deleted')},[selectedIndices])
  const bulkVerify=useCallback(()=>{setVerified(v=>{const n=new Set(v);selectedIndices.forEach(i=>n.add(i));return n});setSelected({});toast.success('Verified')},[selectedIndices])
  const bulkUnverify=useCallback(()=>{setVerified(v=>{const n=new Set(v);selectedIndices.forEach(i=>n.delete(i));return n});setSelected({})},[selectedIndices])
  const toggleSelect=useCallback((id:string,checked:boolean)=>setSelected(s=>({...s,[id]:checked})),[])
  const toggleSelectAll=useCallback((checked:boolean)=>setSelected(checked?Object.fromEntries(enriched.map(t=>[t.id,true])):{}), [enriched])

  return{rows:enriched,audit,recon,stats,selectedCount:selectedIndices.length,selectedIndices,editCell,addRow,deleteRow,duplicateRow,moveAmount,bulkInvert,restoreEdit,loadTransactions,bulkDelete,bulkVerify,bulkUnverify,toggleSelect,toggleSelectAll,openingOverride,setOpeningOverride}
}
