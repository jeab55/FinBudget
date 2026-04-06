'use client'

import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { Transaction, STATUS_MAP } from './types'
import { formatCurrency } from './utils'

export function exportToExcel(transactions: Transaction[], filename = 'finbudget-report') {
  const data = transactions.map((t, i) => ({
    'ลำดับ': i + 1,
    'วันที่สร้าง': new Date(t.created_at).toLocaleDateString('th-TH'),
    'รายละเอียด': t.description,
    'Supplier': t.supplier?.name || '-',
    'หมวดหมู่': t.category?.name || '-',
    'ยอดรวม': t.total_amount,
    'ชำระแล้ว': t.paid_amount,
    'คงเหลือ': t.total_amount - t.paid_amount,
    'วันครบกำหนด': t.due_date ? new Date(t.due_date).toLocaleDateString('th-TH') : '-',
    'สถานะ': STATUS_MAP[t.status]?.label || t.status,
    'หมายเหตุ': t.note || '',
  }))

  const ws = XLSX.utils.json_to_sheet(data)

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },   // ลำดับ
    { wch: 12 },  // วันที่
    { wch: 30 },  // รายละเอียด
    { wch: 20 },  // Supplier
    { wch: 15 },  // หมวดหมู่
    { wch: 15 },  // ยอดรวม
    { wch: 15 },  // ชำระแล้ว
    { wch: 15 },  // คงเหลือ
    { wch: 12 },  // วันครบกำหนด
    { wch: 15 },  // สถานะ
    { wch: 20 },  // หมายเหตุ
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'รายการจ่ายเงิน')

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`)
}

export function exportToCSV(transactions: Transaction[], filename = 'finbudget-report') {
  const data = transactions.map((t, i) => ({
    'ลำดับ': i + 1,
    'วันที่สร้าง': new Date(t.created_at).toLocaleDateString('th-TH'),
    'รายละเอียด': t.description,
    'Supplier': t.supplier?.name || '-',
    'หมวดหมู่': t.category?.name || '-',
    'ยอดรวม': t.total_amount,
    'ชำระแล้ว': t.paid_amount,
    'คงเหลือ': t.total_amount - t.paid_amount,
    'วันครบกำหนด': t.due_date ? new Date(t.due_date).toLocaleDateString('th-TH') : '-',
    'สถานะ': STATUS_MAP[t.status]?.label || t.status,
    'หมายเหตุ': t.note || '',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `${filename}-${new Date().toISOString().split('T')[0]}.csv`)
}
