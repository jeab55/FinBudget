'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Supplier, Category } from '@/lib/types'
import { ArrowLeft } from 'lucide-react'

export default function NewTransactionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    description: '',
    supplier_id: '',
    category_id: '',
    total_amount: '',
    due_date: '',
    note: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [suppliersRes, categoriesRes] = await Promise.all([
        supabase.from('suppliers').select('*'),
        supabase.from('categories').select('*'),
      ])

      if (suppliersRes.error) throw suppliersRes.error
      if (categoriesRes.error) throw categoriesRes.error

      setSuppliers(suppliersRes.data || [])
      setCategories(categoriesRes.data || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('ไม่สามารถโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.description.trim()) {
      setError('กรุณาเพิ่มรายละเอียด')
      return
    }

    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      setError('กรุณากรอกยอดรวมที่ถูกต้อง')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase.from('transactions').insert([
        {
          description: formData.description,
          supplier_id: formData.supplier_id || null,
          category_id: formData.category_id || null,
          total_amount: parseFloat(formData.total_amount),
          due_date: formData.due_date || null,
          note: formData.note || null,
          status: 'recorded',
          paid_amount: 0,
        },
      ])

      if (error) throw error

      setSuccess('เพิ่มรายการสำเร็จ')
      setTimeout(() => {
        router.push('/transactions')
      }, 1000)
    } catch (err) {
      console.error('Error adding transaction:', err)
      setError('ไม่สามารถเพิ่มรายการ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">เพิ่มรายการใหม่</h1>
          <p className="text-gray-500 mt-1">สร้างรายการโอนเงินใหม่</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
              รายละเอียด *
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="เช่น ค่าซื้อวัตถุดิบ"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-900 mb-2">
              Supplier
            </label>
            <select
              id="supplier_id"
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- เลือก Supplier --</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-900 mb-2">
              หมวดหมู่
            </label>
            <select
              id="category_id"
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- เลือกหมวดหมู่ --</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="total_amount" className="block text-sm font-medium text-gray-900 mb-2">
              ยอดรวม *
            </label>
            <input
              type="number"
              id="total_amount"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="due_date" className="block text-sm font-medium text-gray-900 mb-2">
              วันครบกำหนด
            </label>
            <input
              type="date"
              id="due_date"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="note" className="block text-sm font-medium text-gray-900 mb-2">
              หมายเหตุ
            </label>
            <textarea
              id="note"
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="เพิ่มเติมข้อมูล"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting || loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 py-2 px-4 rounded-lg font-medium transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
