export interface RawTransaction { date:string;txtype:string;description:string;paidin:string;paidout:string;balance:string;_confidence:number|null;_page:number|null;_ocr:Record<string,string> }
export interface ValidationResult { status:'ok'|'warn'|'error'|'skip';diff:number;expected:number|null;balImpossible:boolean;parseWarn:boolean }
export interface MatchResult { matched:boolean;corrected_text:string;category:string|null;match_type:'exact'|'fuzzy'|'none';similarity:number;trust_score:number;overrode_ai:boolean;entry_id:string|null }
export interface EnrichedTransaction extends RawTransaction { id:string;category:string|null;_val:ValidationResult|null;_match:MatchResult;_auto_corrected:boolean;_suggested:boolean;_suggestion:string|null;_isDuplicate:boolean;_isRedFlag:boolean;_isVerified:boolean;_parseWarn:boolean;_selected:boolean;_isRound:boolean }
export interface DictionaryEntry { id:string;user_id:string|null;original_text:string;corrected_text:string;category:string|null;trust_score:number;hit_count:number;unique_user_count:number;is_global:boolean;created_at:string }
export interface AuditEntry { id?:string;row:number;field:string;label:string;desc:string;orig:string;edited:string;ts:Date;restored:boolean }
export interface ReconciliationSummary { openingBalance:number;totalIn:number;totalOut:number;calculatedClose:number;actualClose:number;diff:number;status:'balanced'|'warning'|'error' }
export interface ProcessingStats { total:number;autoCorrected:number;suggested:number;lowConfidence:number;errors:number;warnings:number;duplicates:number;redFlags:number }
export interface ProcessPdfResponse { transactions:EnrichedTransaction[];sessionId:string;fileName:string;stats:ProcessingStats;error?:string }
