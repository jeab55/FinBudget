import { format, parseISO, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';

export function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: string): string {
  try {
    const parsedDate = parseISO(date);
    return format(parsedDate, 'd MMMM yyyy', { locale: th });
  } catch {
    return date;
  }
}

export function getRemaining(total: number, paid: number): number {
  return Math.max(0, total - paid);
}

export function isNearDue(dueDate: string, daysThreshold: number = 7): boolean {
  try {
    const due = parseISO(dueDate);
    const today = new Date();
    const daysUntilDue = differenceInDays(due, today);
    return daysUntilDue <= daysThreshold && daysUntilDue >= 0;
  } catch {
    return false;
  }
}
