'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { Transaction, Payment, BankAccount, STATUS_MAP } from '@/lib/types'
import { ArrowLeft, Edit2, Upload, Plus, Download, Pencil, Trash2 } from 'lucide-react'

function formatCurrency(amount: number): string {
  return `à¸¿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
      setError('à¹à¸¡à¹à¸ªà¸²à¸¡à¸²à¸£à¸à¹à¸«à¸¥à¸à¸à¹à¸­à¸¡à¸¹à¸¥à¸£à¸²à¸¢à¸à¸²à¸£')
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
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function validatePaymentForm(): boolean {
    const errors: Record<string, string> = {}

    if (!paymentForm.amount || paymentForm.amount.trim() === '') {
      errors.amount = 'à¸à¸£à¸¸à¸à¸²à¸à¸£à¸­à¸à¸à¸³à¸à¸§à¸à¹à¸à¸´à¸'
    } else if (parseFloat(paymentForm.amount) <= 0) {
      errors.amount = 'à¸à¸³à¸à¸§à¸à¹à¸à¸´à¸à¸à¹à¸­à¸à¸¡à¸²à¸à¸à¸§à¹à¸² 0'
    } else if (transaction) {
      const amount = parseFloat(paymentForm.amount)
      // When editing, add back the original amount to remaining
      const editingPayment = editingPaymentId ? payments.find((p) => p.id === editingPaymentId) : null
      const effectiveRemaining = transaction.total_amount - transaction.paid_amount + (editingPayment?.amount || 0)
      if (amount > effectiveRemaining) {
        errors.amount = `à¸à¸³à¸à¸§à¸à¹à¸à¸´à¸à¹à¸à¸´à¸à¸à¸§à¹à¸²à¸à¸µà¹à¸à¹à¸²à¸à¸à¸³à¸£à¸° (${formatCurrency(effectiveRemaining)})`
      }
    }

    if (!paymentForm.payment_date || paymentForm.payment_date.trim() === '') {
      errors.payment_date = 'à¸à¸£à¸¸à¸à¸²à¹à¸¥à¸·à¸­à¸à¸§à¸±à¸à¸à¸µà¹à¸à¹à¸²à¸¢'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function openAddPaymentModal() {
    setEditingPaymentId(null)
    const defaultAcc = bankAccounts.find((a) => a.is_default)
    setPaymentForm({
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      from_account_id: defaultAcc?.id || '',
      note: '',
      slip: null,
    })
    setFieldErrors({})
    setError('')
    setShowPaymentModal(true)
  }

  function openEditPaymentModal(payment: Payment) {
    setEditingPaymentId(payment.id)
    setPaymentForm({
      amount: payment.amount.toString(),
      payment_date: payment.payment_date,
      from_account_id: payment.from_account_id || '',
      note: payment.note || '',
      slip: null,
    })
    setFieldErrors({})
    setError('')
    setShowPaymentModal(true)
  }

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validatePaymentForm()) return

    const amount = parseFloat(paymentForm.amount)
    setSubmittingPayment(true)

    try {
      let slip_url = null

      // Upload slip if provided
      if (paymentForm.slip) {
        const fileExt = paymentForm.slip.name.split('.').pop()
        const fileName = `${transactionId}_${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
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
        setError('à¸à¸£à¸¸à¸à¸²à¹à¸à¹à¸²à¸ªà¸¹à¹à¸£à¸°à¸à¸')
        return
      }

      if (editingPaymentId) {
        // UPDATE existing payment
        const updateData: Record<string, unknown> = {
          amount: amount,
          payment_date: paymentForm.payment_date,
          from_account_id: paymentForm.from_account_id || null,
          note: paymentForm.note || null,
        }
        if (slip_url) {
          updateData.slip_url = slip_url
        }

        const { error: updateError } = await supabase
          .from('payments')
          .update(updateData)
          .eq('id', editingPaymentId)

        if (updateError) throw updateError

        // Recalculate paid_amount
        const oldPayment = payments.find((p) => p.id === editingPaymentId)
        const diff = amount - (oldPayment?.amount || 0)
        const newPaidAmount = transaction!.paid_amount + diff

        const { error: txUpdateError } = await supabase
          .from('transactions')
          .update({ paid_amount: newPaidAmount }Id}_${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
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
        setError('à¸à¸£à¸¸à¸à¸²à¹à¸à¹à¸²à¸ªà¸¹à¹à¸£à¸°à¸à¸')
        return
      }

      if (editingPaymentId) {
        // UPDATE existing payment
        const updateData: Record<string, unknown> = {
          amount: amount,
          payment_date: paymentForm.payment_date,
          from_account_id: paymentForm.from_account_id || null,
          note: paymentForm.note || null,
        }
        if (slip_url) {
          updateData.slip_url = slip_url
        }

        const { error: updateError } = await supabase
          .from('payments')
          .update(updateData)
          .eq('id', editingPaymentId)

        if (updateError) throw updateError

        // Recalculate paid_amount
        const oldPayment = payments.find((p) => p.id === editingPaymentId)
        const diff = amount - (oldPayment?.amount || 0)
        const newPaidAmount = transaction!.paid_amount + diff

        const { error: txUpdateError } = await supabase
          .from('transactions')
          .update({ paid_amount: newPaidAmount })
          .eq('id', transactionId)

        if (txUpdateError) throw txUpdateError

        setSuccess('à¹à¸à¹à¹à¸à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸à¸ªà¸³à¹à¸£à¹à¸')
      } else {
        // INSERT new payment
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

        setSuccess('à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸à¸ªà¸³à¹à¸£à¹à¸')
      }

      setShowPaymentModal(false)
      setEditingPaymentId(null)
      await fetchTransaction()
    } catch (err) {
      console.error('Error saving payment:', err)
      setError('à¹à¸¡à¹à¸ªà¸²à¸¡à¸²à¸£à¸à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸')
    } finally {
      setSubmittingPayment(false)
    }
  }

  async function handleDeletePayment(paymentId: string) {
    setDeletingPayment(true)
    setError('')
    setSuccess('')

    try {
      const payment = payments.find((p) => p.id === paymentId)
      if (!payment) return

      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId)

      if (deleteError) throw deleteError

      // Update transaction paid_amount
      const newPaidAmount = transaction!.paid_amount - payment.amount

      const { error: updateError } = await supabase
        .from('transactions')
        .update({ paid_amount: Math.max(0, newPaidAmount) })
        .eq('id', transactionId)

      if (updateError) throw updateError

      setShowDeleteConfirm(null)
      setSuccess('à¸¥à¸à¸£à¸²à¸¢à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸à¸ªà¸³à¹à¸£à¹à¸')
      await fetchTransaction()
    } catch (err) {
      console.error('Error deleting payment:', err)
      setError('à¹à¸¡à¹à¸ªà¸²à¸¡à¸²à¸£à¸à¸¥à¸à¸£à¸²à¸¢à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸')
    } finally {
      setDeletingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-500">à¸à¸³à¸¥à¸±à¸à¹à¸«à¸¥à¸...</div>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">à¹à¸¡à¹à¸à¸à¸£à¸²à¸¢à¸à¸²à¸£</p>
        <Link href="/transactions" className="text-blue-600 hover:text-blue-700">
          à¸à¸¥à¸±à¸à¹à¸à¸£à¸²à¸¢à¸à¸²à¸£
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
            <p className="text-gray-500 mt-1">à¸à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹à¸­à¸µà¸¢à¸à¹à¸¥à¸°à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸</p>
          </div>
        </div>
        <Link
          href={`/transactions/${transactionId}/edit`}
          className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Edit2 size={18} />
          à¹à¸à¹à¹à¸
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">à¸à¹à¸­à¸¡à¸¹à¸¥à¸£à¸²à¸¢à¸à¸²à¸£</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Supplier</p>
                <p className="font-semibold text-gray-900">{transaction.supplier?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">à¸«à¸¡à¸§à¸à¸«à¸¡à¸¹à¹</p>
                <p className="font-semibold text-gray-900">{transaction.category?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">à¸ªà¸à¸²à¸à¸°</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-1 ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">à¸§à¸±à¸à¸à¸µà¹à¸ªà¸£à¹à¸²à¸</p>
                <p className="font-semibold text-gray-900">
                  {new Date(transaction.created_at).toLocaleDateString('th-TH')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">à¸§à¸±à¸à¸à¸£à¸à¸à¸³à¸«à¸à¸</p>
                <p className="font-semibold text-gray-900">
                  {transaction.due_date
                    ? new Date(transaction.due_date).toLocaleDateString('th-TH')
                    : '-'}
                </p>
              </div>
            </div>
            {transaction.note && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">à¸«à¸¡à¸²à¸¢à¹à¸«à¸à¸¸</p>
                <p className="text-gray-900 mt-1">{transaction.note}</p>
              </div>
            )}
          </div>

          {/* Payment Progress */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">à¸à¸§à¸²à¸¡à¸à¸·à¸à¸«à¸à¹à¸²à¸à¸²à¸£à¸à¸³à¸£à¸°</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">à¸¢à¸­à¸à¸£à¸§à¸¡</span>
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
                  <p className="text-sm text-gray-600">à¸à¸³à¸£à¸°à¹à¸¥à¹à¸§</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(transaction.paid_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">à¸à¸à¹à¸«à¸¥à¸·à¸­</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(remaining)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">à¸£à¹à¸­à¸¢à¸¥à¸°</p>
                  <p className="text-lg font-bold text-blue-600">{Math.round(progressPercent)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">à¸à¸£à¸°à¸§à¸±à¸à¸´à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸</h2>
              {remaining > 0 && (
                <button
                  onClick={openAddPaymentModal}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={16} />
                  à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¸à¹à¸²à¸¢
                </button>
              )}
            </div>

            {payments && payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">à¸§à¸±à¸à¸à¸µà¹à¸à¹à¸²à¸¢</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">à¸à¸³à¸à¸§à¸à¹à¸à¸´à¸</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">à¸à¸²à¸à¸à¸±à¸à¸à¸µ</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">à¸ªà¸¥à¸´à¸</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">à¸«à¸¡à¸²à¸¢à¹à¸«à¸à¸¸</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">à¸à¸±à¸à¸à¸²à¸£</th>
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
                              à¸à¸¹à¸ªà¸¥à¸´à¸
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{payment.note || '-'}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditPaymentModal(payment)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="à¹à¸à¹à¹à¸"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(payment.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="à¸¥à¸"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 py-4">à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µà¸à¸²à¸£à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">à¸ªà¸£à¸¸à¸</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">à¸¢à¸­à¸à¸£à¸§à¸¡</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(transaction.total_amount)}</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600">à¸à¸³à¸£à¸°à¹à¸¥à¹à¸§</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(transaction.paid_amount)}</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600">à¸à¸à¹à¸«à¸¥à¸·à¸­</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(remaining)}</p>
              </div>
              {remaining > 0 && (
                <button
                  onClick={openAddPaymentModal}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal (Add / Edit) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingPaymentId ? 'à¹à¸à¹à¹à¸à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸' : 'à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸'}
            </h3>

            <form onSubmit={handleSubmitPayment} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  à¸à¸³à¸à¸§à¸à¹à¸à¸´à¸ {!editingPaymentId && `(à¸à¸à¹à¸«à¸¥à¸·à¸­: ${formatCurrency(remaining)})`}
                  {editingPaymentId && (() => {
                    const editPayment = payments.find((p) => p.id === editingPaymentId)
                    const effectiveRemaining = remaining + (editPayment?.amount || 0)
                    return ` (à¸à¸à¹à¸«à¸¥à¸·à¸­: ${formatCurrency(effectiveRemaining)})`
                  })()}
                  <span className="text-red-500"> *</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  value={paymentForm.amount}
                  onChange={handlePaymentChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors.amount ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                />
                {fieldErrors.amount && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  à¸§à¸±à¸à¸à¸µà¹à¸à¹à¸²à¸¢ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={paymentForm.payment_date}
                  onChange={handlePaymentChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors.payment_date ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                />
                {fieldErrors.payment_date && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.payment_date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">à¹à¸­à¸à¸à¸²à¸à¸à¸±à¸à¸à¸µ</label>
                <select
                  name="from_account_id"
                  value={paymentForm.from_account_id}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, from_account_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- à¹à¸¥à¸·à¸­à¸à¸à¸±à¸à¸à¸µ --</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.account_number}{acc.is_default ? ' (à¸à¹à¸²à¹à¸£à¸´à¹à¸¡à¸à¹à¸)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">à¸«à¸¡à¸²à¸¢à¹à¸«à¸à¸¸</label>
                <textarea
                  name="note"
                  value={paymentForm.note}
                  onChange={handlePaymentChange}
                  placeholder="à¹à¸à¸´à¹à¸¡à¹à¸à¸´à¸¡à¸à¹à¸­à¸¡à¸¹à¸¥"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  à¸­à¸±à¸à¹à¸«à¸¥à¸à¸ªà¸¥à¸´à¸ {editingPaymentId && '(à¹à¸¥à¸·à¸­à¸à¹à¸à¸¥à¹à¹à¸«à¸¡à¹à¹à¸à¸·à¹à¸­à¹à¸à¸¥à¸µà¹à¸¢à¸)'}
                </label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors">
                  <Upload size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {paymentForm.slip ? paymentForm.slip.name : 'à¸à¸¥à¸´à¸à¹à¸à¸·à¹à¸­à¸­à¸±à¸à¹à¸«à¸¥à¸'}
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
                  {submittingPayment ? 'à¸à¸³à¸¥à¸±à¸à¸à¸±à¸à¸à¸¶à¸...' : editingPaymentId ? 'à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸£à¹à¸à¹à¹à¸' : 'à¸à¸±à¸à¸à¸¶à¸'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); setEditingPaymentId(null); setFieldErrors({}) }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  à¸¢à¸à¹à¸¥à¸´à¸
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">à¸¢à¸·à¸à¸¢à¸±à¸à¸à¸²à¸£à¸¥à¸</h3>
            <p className="text-gray-600 mb-6">
              à¸à¸¸à¸à¸à¹à¸­à¸à¸à¸²à¸£à¸¥à¸à¸£à¸²à¸¢à¸à¸²à¸£à¸à¹à¸²à¸¢à¹à¸à¸´à¸à¸à¸µà¹à¸«à¸£à¸·à¸­à¹à¸¡à¹? à¸¢à¸­à¸à¸à¸³à¸£à¸°à¸à¸°à¸à¸¹à¸à¸à¸£à¸±à¸à¸¥à¸à¸à¸²à¸¡à¸à¸³à¸à¸§à¸à¹à¸à¸´à¸à¸à¸µà¹à¸¥à¸
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeletePayment(showDeleteConfirm)}
                disabled={deletingPayment}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {deletingPayment ? 'à¸à¸³à¸¥à¸±à¸à¸¥à¸...' : 'à¸¥à¸'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                à¸¢à¸à¹à¸¥à¸´à¸
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Preview Modal */}
      {previewSlip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">à¸à¸¹à¸ªà¸¥à¸´à¸</h3>
              <button
                onClick={() => setPreviewSlip(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                Ã
              </button>
            </div>
            {previewSlip.match(/\.(jpg|jpeg|png|gif)$/i) ? (
              <img src={previewSlip} alt="Slip" className="w-full h-auto rounded-lg" />
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <p className="text-gray-600 mb-4">à¹à¸à¸¥à¹ PDF</p>
                <a
                  href={previewSlip}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  à¹à¸à¸´à¸à¹à¸à¸¥à¹
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
