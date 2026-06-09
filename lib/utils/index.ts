import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function cleanNumber(raw:string|null|undefined):{str:string;num:number;ok:boolean}{
  if(!raw&&raw!=='0')return{str:'',num:0,ok:true}
  let s=String(raw).trim().replace(/[£$€¥\s]/g,'')
  const neg=s.startsWith('(')&&s.endsWith(')')
  if(neg)s='-'+s.slice(1,-1)
  if(/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))s=s.replace(/\./g,'').replace(',','.')
  else s=s.replace(/,(?=\d{3}(\.|$))/g,'').replace(',','.')
  const num=parseFloat(s)
  return isNaN(num)?{str:'',num:0,ok:false}:{str:num.toFixed(2),num,ok:true}
}
export function safeFloat(raw:string|null|undefined):{val:number;ok:boolean}{
  const{num,ok}=cleanNumber(raw);return{val:ok?num:0,ok}
}
export function formatGBP(amount:number|string):string{
  const{num,ok}=cleanNumber(String(amount));if(!ok)return'—'
  return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2}).format(num)
}
