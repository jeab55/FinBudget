export interface Supplier {
  id: string
  user_id: string
  name: string
  bank_name: string | null
  bank_account: string | null
  contact: string | null
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export type TransactionStatus = 'recorded' | 'pending' | 'paid' | 'slip_uploaded'

export interface Transaction {
  id: string
  user_id: string
  supplier_id: string | null
  category_id: string | null
  description: string
  total_amount: number
  paid_amount: number
  due_date: string | null
  status: TransactionStatus
  note: string | null
  created_at: string
  updated_at: string
  supplier?: Supplier
  category?: Category
  payments?: Payment[]
}

export interface Payment {
  id: string
  transaction_id: string
  user_id: string
  from_account_id: string | null
  amount: number
  payment_date: string
  slip_url: string | null
  note: string | null
  created_at: string
  bank_account?: BankAccount
}

export interface BankAccount {
  id: string
  user_id: string
  bank_name: string
  account_number: string
  account_name: string | null
  is_default: boolean
  created_at: string
}

export const STATUS_MAP: Record<TransactionStatus, { label: string; color: string; bg: string }> = {
  recorded: { label: 'ลงรายการ', color: 'text-gray-700', bg: 'bg-gray-100' },
  pending: { label: 'รอชำระ', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  paid: { label: 'ชำระแล้ว', color: 'text-green-700', bg: 'bg-green-100' },
  slip_uploaded: { label: 'อัพสลิปแล้ว', color: 'text-blue-700', bg: 'bg-blue-100' },
}

export const DEFAULT_CATEGORIES = [
  { name: 'ค่าวัตถุดิบ', color: '#ef4444' },
  { name: 'ค่าบริการ', color: '#f97316' },
  { name: 'ค่าขนส่ง', color: '#eab308' },
  { name: 'ค่าสาธารณูปโภค', color: '#22c55e' },
  { name: 'ค่าเช่า', color: '#3b82f6' },
  { name: 'อื่นๆ', color: '#6366f1' },
]
