'use client'

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

export type DateFilterType = 'created' | 'payment'

interface MonthFilterProps {
  year: number
  month: number
  dateFilterType: DateFilterType
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  onDateFilterTypeChange: (type: DateFilterType) => void
}

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export default function MonthFilter({
  year,
  month,
  dateFilterType,
  onYearChange,
  onMonthChange,
  onDateFilterTypeChange,
}: MonthFilterProps) {
  function goToPreviousMonth() {
    if (month === 1) {
      onYearChange(year - 1)
      onMonthChange(12)
    } else {
      onMonthChange(month - 1)
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      onYearChange(year + 1)
      onMonthChange(1)
    } else {
      onMonthChange(month + 1)
    }
  }

  function goToCurrentMonth() {
    const now = new Date()
    onYearChange(now.getFullYear())
    onMonthChange(now.getMonth() + 1)
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => onDateFilterTypeChange('created')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            dateFilterType === 'created'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          วันที่ทำรายการ
        </button>
        <button
          onClick={() => onDateFilterTypeChange('payment')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            dateFilterType === 'payment'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          วันที่ชำระ
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={goToPreviousMonth}
          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="เดือนก่อนหน้า"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-1.5 min-w-[140px] justify-center">
          <Calendar size={16} className="text-gray-400" />
          <span className="font-semibold text-gray-900">
            {THAI_MONTHS[month - 1]} {year + 543}
          </span>
        </div>
        <button
          onClick={goToNextMonth}
          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="เดือนถัดไป"
        >
          <ChevronRight size={20} />
        </button>
        <button
          onClick={goToCurrentMonth}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          เดือนนี้
        </button>
      </div>
    </div>
  )
}
