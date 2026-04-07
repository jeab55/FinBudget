'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Transaction, STATUS_MAP, TransactionStatus } from '@/lib/types'
import { CreditCard, DollarSign, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import MonthFilter, { DateFilterType } from '@/components/MonthFilter'

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('created')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [upcomingDue, setUpcomingDue] = useState<any[]>([])
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [year, month, dateFilterType])

  async function fetchData() {
    setLoading(true)
    try {
      const { start, end } = getMonthRange(year, month)

      let query = supabase
        .from('transactions')
        .select('*, supplier:suppliers(*), category:categories(*), payments(*)')

      if (dateFilterType === 'created') {
        query = query.gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`)
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data: allTransactions = [], error } = await query
      if (error) throw error

      let filtered = allTransactions || []

      if (dateFilterType === 'payment') {
        filtered = filtered.filter((t: any) => {
          if (!t.payments || t.payments.length === 0) return false
          return t.payments.some((p: any) => {
            const pDate = p.payment_date
            return pDate >= start && pDate <= end
          })
        })
      }

      setTransactions(filtered)

      const today = new Date()
      const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const todayStr = today.toISOString().split('T')[0]
      const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0]

      const { data: upcoming = [] } = await supabase
        .from('transactions')
        .select('*, supplier:suppliers(*)')
        .gte('due_date', todayStr)
        .lte('due_date', sevenDaysStr)
        .in('status', ['recorded', 'pending'])

      setUpcomingDue(upcoming || [])

      const recent = [...filtered]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
      setRecentTransactions(recent)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalCount = transactions.length
  const totalAmount = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0)
  const paidAmount = transactions.reduce((sum, t) => sum + (t.paid_amount || 0), 0)
  const remainingAmount = totalAmount - paidAmount

  const today = new Date()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">แดชบอร์ด</h1>
          <p className="text-gray-500 mt-1">สรุปข้อมูลการเงินของคุณ</p>
        </div>
        <MonthFilter
          year={year}
          month={month}
          dateFilterType={dateFilterType}
          onYearChange={setYear}
          onMonthChange={setMonth}
          onDateFilterTypeChange={setDateFilterType}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="text-gray-500">กำลังโหลด...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">รายการทั้งหมด</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{totalCount}</p>
                </div>
                <CreditCard className="text-blue-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">ยอดรวมทั้งหมด</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(totalAmount)}</p>
                </div>
                <DollarSign className="text-green-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">ยอดชำระแล้ว</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(paidAmount)}</p>
                </div>
                <CheckCircle className="text-emerald-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">ยอดค้างชำระ</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(remainingAmount)}</p>
                </div>
                <AlertCircle className="text-orange-500" size={32} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle size={24} className="text-orange-500" />
              ครบกำหนดชำระในอีก 7 วัน
            </h2>
            {upcomingDue && upcomingDue.length > 0 ? (
              <div className="space-y-3">
                {upcomingDue.map((transaction: any) => {
                  const daysUntilDue = Math.ceil(
                    (new Date(transaction.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{transaction.description}</p>
                        <p className="text-sm text-gray-600">
                          {transaction.supplier?.name || 'ไม่มี Supplier'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(transaction.total_amount - transaction.paid_amount)}
                        </p>
                        <p className="text-sm text-orange-600 font-medium">
                          {daysUntilDue} วันถึงครบกำหนด
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 py-4">ไม่มีรายการที่ครบกำหนดในอีก 7 วัน</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">รายการล่าสุด</h2>
              <a href="/transactions" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                ดูทั้งหมด
                <ArrowRight size={16} />
              </a>
            </div>

            {recentTransactions && recentTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">รายละเอียด</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Supplier</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">ยอดรวม</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">ชำระแล้ว</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">คงเหลือ</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recentTransactions.map((transaction: any) => {
                      const status = STATUS_MAP[transaction.status as TransactionStatus]
                      const remaining = transaction.total_amount - transaction.paid_amount
                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {transaction.supplier?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                            {formatCurrency(transaction.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-right text-green-600">
                            {formatCurrency(transaction.paid_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-right text-orange-600">
                            {formatCurrency(remaining)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 py-4">ไม่มีรายการในเดือนนี้</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
