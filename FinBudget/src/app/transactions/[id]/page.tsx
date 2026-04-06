'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { Transaction, Payment, BankAccount, STATUS_MAP } from '@/lib/types'
import { ArrowLeft, Edit2, Upload, Plus, Download } from 'lucide-react'

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TransactionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const transactionId = params.id as string
  const supabase = createClient()

  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [previewSlip, setPreviewSlip] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    from_account_id: '',
    note: '',
    slip: null as File | null,
  })

  useEffect(() => {
    fetchTransaction()
  }, [transactionId])

  async function fetchTransaction() {
    try {
      const [transRes, accountsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, supplier:suppliers(*), category:categories(*), payments(*, bank_account:bank_accounts(*))')
          .eq('id', transactionId)
          .single(),
        supabase
          .from('bank_accounts')
          .select('*')
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (transRes.error) throw transRes.error

      setTransaction(transRes.data)
      setPayments(transRes.data.payments || [])

      if (!accountsRes.error && accountsRes.data) {
        setBankAccounts(accountsRes.data)
        const defaultAcc = accountsRes.data.find((a: BankAccount) => a.is_default)
        if (defaultAcc) {
          setPaymentForm((prev) => ({ ...prev, from_account_id: defaultAcc.id }))
        }
      }
    } catch (err) {
      console.error('Error fetching transaction:', err)
      setError('ไม่สามารถโหลดข้อมูลรายการ')
    } finally {
      setLoading(false)
    }
  }

  function handlePaymentChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target as HTMLInputElement
    if (type === 'file') {
      setPaymentForm((prev) => ({
        ...prev,
        slip: (e.target as HTMLInputElement).files?.[0] || null,
      }))
    } else {
      setPaymentForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setError('กรุณากรอกจำนวนเงินที่ถูกต้อง')
      return
    }

    const amount = parseFloat(paymentForm.amount)
    const remaining = transaction!.total_amount - transaction!.paid_amount
    if (amount > remaining) {
      setError(`จำนวนเงินเกินกว่าที่ค้างชำระ (${formatCurrency(remaining)})`)
      return
    }

    setSubmittingPayment(true)

    try {
      let slip_url = null

      if (paymentForm.slip) {
        const fileExt = paymentForm.slip.name.split('.').pop()
        const fileName = `${transactionId}_${Date.now()}.${fileExt}`

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('slips')
          .upload(fileName, paymentForm.slip)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('slips')
          .getPublicUrl(fileName)

        slip_url = publicUrlData.publicUrl
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('กรุณาเข้าสู่ระบบ')
        return
      }

      const { error: insertError } = await supabase.from('payments').insert([
        {
          user_id: user.id,
          transaction_id: transactionId,
          from_account_id: paymentForm.from_account_id || null,
          amount: amount,
          payment_date: paymentForm.payment_date,
          slip_url: slip_url,
          note: paymentForm.note || null,
        },
      ])

      if (insertError) throw insertError

      const newPaidAmount = transaction!.paid_amount + amount
      const newStatus = paymentForm.slip ? 'slip_uploaded' : 'pending'

      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
        })
        .eq('id', transactionId)

      if (updateError) throw updateError

      setSuccess('บันทึกการจ่ายเงินสำเร็จ')
      const defaultAcc = bankAccounts.find((a) => a.is_default)
      setPaymentForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], from_account_id: defaultAcc?.id || '', note: '', slip: null })
      setShowPaymentModal(false)

      await fetchTransaction()
    } catch (err) {
      console.error('Error adding payment:', err)
      setError('ไม่สามารถบันทึกการจ่ายเงิน')
    } finally {
      setSubmittingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">ไม่พบรายการ</p>
        <Link href="/transactions" className="text-blue-600 hover:text-blue-700">
          กลับไปรายการ
        </Link>
      </div>
    )
  }

  const status = STATUS_MAP[transaction.status]
  const remaining = transaction.total_amount - transaction.paid_amount
  const progressPercent = (transaction.paid_amount / transaction.total_amount) * 100

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{transaction.description}</h1>
            <p className="text-gray-500 mt-1">ดูรายละเอียดและบันทึกการจ่ายเงิน</p>
          </div>
        </div>
        <Link
          href={`/transactions/${transactionId}/edit`}
          className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Edit2 size={18} />
          แก้ไข
        </Link>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cards */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">ข้อมูลรายการ</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Supplier</p>
                <p className="font-semibold text-gray-900">{transaction.supplier?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">หมวดหมู่</p>
                <p className="font-semibold text-gray-900">{transaction.category?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">สถานะ</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-1 ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">วันที่สร้าง</p>
                <p className="font-semibold text-gray-900">
                  {new Date(transaction.created_at).toLocaleDateString('th-TH')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">วันครบกำหนด</p>
                <p className="font-semibold text-gray-900">
                  {transaction.due_date
                    ? new Date(transaction.due_date).toLocaleDateString('th-TH')
                    : '-'}
                </p>
              </div>
            </div>
            {transaction.note && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">หมายเหตุ</p>
                <p className="text-gray-900 mt-1">{transaction.note}</p>
              </div>
            )}
          </div>

          {/* Payment Progress */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">ความคืบหน้าการชำระ</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">ยอดรวม</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(transaction.total_amount)}</span>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div>
                  <p className="text-sm text-gray-600">ชำระแล้ว</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(transaction.paid_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">คงเหลือ</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(remaining)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">ร้อยละ</p>
                  <p className="text-lg font-bold text-blue-600">{Math.round(progressPercent)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">ประวัติการจ่ายเงิน</h2>
              {remaining > 0 && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={16} />
                  บันทึกการจ่าย
                </button>
              )}
            </div>

            {payments && payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">วันที่จ่าย</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">จำนวนเงิน</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">จากบัญชี</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">สลิป</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(payment.payment_date).toLocaleDateString('th-TH')}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {payment.bank_account
                            ? `${payment.bank_account.bank_name} ${payment.bank_account.account_number}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {payment.slip_url ? (
                            <button
                              onClick={() => setPreviewSlip(payment.slip_url)}
                              className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                            >
                              <Download size={16} />
                              ดูสลิป
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{payment.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 py-4">ยังไม่มีการบันทึกการจ่ายเงิน</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">สรุป</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">ยอดรวม</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(transaction.total_amount)}</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600">ชำระแล้ว</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(transaction.paid_amount)}</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600">คงเหลือ</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(remaining)}</p>
              </div>
              {remaining > 0 && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  บันทึกการจ่ายเงิน
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">บันทึกการจ่ายเงิน</h3>

            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  จำนวนเงิน (คงเหลือ: {formatCurrency(remaining)}) *
                </label>
                <input
                  type="number"
                  name="amount"
                  value={paymentForm.amount}
                  onChange={handlePaymentChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={remaining}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">วันที่จ่าย *</label>
                <input
                  type="date"
                  name="payment_date"
                  value={paymentForm.payment_date}
                  onChange={handlePaymentChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">โอนจากบัญชี</label>
                <select
                  name="from_account_id"
                  value={paymentForm.from_account_id}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, from_account_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- เลือกบัญชี --</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.account_number}{acc.is_default ? ' (ค่าเริ่มต้น)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">หมายเหตุ</label>
                <textarea
                  name="note"
                  value={paymentForm.note}
                  onChange={handlePaymentChange}
                  placeholder="เพิ่มเติมข้อมูล"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">อัพโหลดสลิป</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors">
                  <Upload size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {paymentForm.slip ? paymentForm.slip.name : 'คลิกเพื่ออัพโหลด'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handlePaymentChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  {submittingPayment ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slip Preview Modal */}
      {previewSlip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">ดูสลิป</h3>
              <button
                onClick={() => setPreviewSlip(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            {previewSlip.match(/\.(jpg|jpeg|png|gif)$/i) ? (
              <img src={previewSlip} alt="Slip" className="w-full h-auto rounded-lg" />
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <p className="text-gray-600 mb-4">ไฟล์ PDF</p>
                <a
                  href={previewSlip}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  เปิดไฟล์
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
