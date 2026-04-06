'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { Transaction, STATUS_MAP, TransactionStatus } from '@/lib/types'
import { Plus, Eye, Edit2, Search, Download } from 'lucide-react'
import { exportToExcel, exportToCSV } from '@/lib/export'

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<TransactionStatus | 'all'>('all')

  const supabase = createClient()

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    filterTransactions()
  }, [transactions, searchTerm, selectedStatus])

  async function fetchTransactions() {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, supplier:suppliers(*), category:categories(*), payments(*)')
        .order('created_at', { ascending: false })

      if (error) throw error

      setTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  function filterTransactions() {
    let filtered = transactions

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((t) => t.status === selectedStatus)
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(search) ||
          t.supplier?.name?.toLowerCase().includes(search)
      )
    }

    setFilteredTransactions(filtered)
  }

  const statuses: Array<{ value: TransactionStatus | 'all'; label: string }> = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'recorded', label: 'ลงรายการ' },
    { value: 'pending', label: 'รอชำระ' },
    { value: 'paid', label: 'ชำระแล้ว' },
    { value: 'slip_uploaded', label: 'อัพสลิปแล้ว' },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">รายการโอนเงิน</h1>
          <p className="text-gray-500 mt-1">จัดการรายการโอนเงินทั้งหมด</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => exportToExcel(filteredTransactions)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Download size={18} />
            Excel
          </button>
          <button
            onClick={() => exportToCSV(filteredTransactions)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Download size={18} />
            CSV
          </button>
          <Link
            href="/transactions/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            เพิ่มรายการ
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="ค้นหาตามรายละเอียดหรือ Supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Status Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 border-b border-gray-200">
        {statuses.map((status) => (
          <button
            key={status.value}
            onClick={() => setSelectedStatus(status.value)}
            className={`px-4 py-2 font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              selectedStatus === status.value
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="text-gray-500">กำลังโหลด...</div>
        </div>
      ) : filteredTransactions.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">วันที่สร้าง</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">รายละเอียด</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Supplier</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">หมวดหมู่</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">ยอดรวม</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">ชำระแล้ว</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">คงเหลือ</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">สถานะ</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => {
                  const status = STATUS_MAP[transaction.status]
                  const remaining = transaction.total_amount - transaction.paid_amount
                  const createdDate = new Date(transaction.created_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })

                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600">{createdDate}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {transaction.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.supplier?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.category?.name || '-'}
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
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/transactions/${transaction.id}`}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="ดูรายละเอียด"
                          >
                            <Eye size={18} />
                          </Link>
                          <Link
                            href={`/transactions/${transaction.id}/edit`}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="แก้ไข"
                          >
                            <Edit2 size={18} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">ไม่มีรายการ</p>
          <Link
            href="/transactions/new"
            className="text-blue-600 hover:text-blue-700 font-medium mt-4 inline-block"
          >
            เพิ่มรายการแรก
          </Link>
        </div>
      )}
    </div>
  )
}
