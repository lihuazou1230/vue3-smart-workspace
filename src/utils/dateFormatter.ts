/** 日期格式化与相对日期工具（纯函数，now 可注入便于测试） */

import { isValidDateKey } from './validation'

const pad2 = (n: number): string => n.toString().padStart(2, '0')

/** Date -> 本地日期键 YYYY-MM-DD */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 今天日期键 YYYY-MM-DD */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now)
}

/** dateKey 是否为今天 */
export function isToday(dateKey: string, now: Date = new Date()): boolean {
  return dateKey === todayKey(now)
}

/** dateKey 是否已逾期（严格早于今天） */
export function isOverdue(dateKey: string, now: Date = new Date()): boolean {
  return dateKey < todayKey(now)
}

/** 在 dateKey 上增加 n 天（支持负数），返回新 dateKey */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/** 相对到期标签：已逾期 / 今天 / 明天 / 后天 / MM月DD日（同今年），跨年附年份 */
export function formatDueLabel(dateKey: string, now: Date = new Date()): string {
  if (!isValidDateKey(dateKey)) return ''
  if (isOverdue(dateKey, now)) return '已逾期'
  if (isToday(dateKey, now)) return '今天'
  if (dateKey === addDays(todayKey(now), 1)) return '明天'
  if (dateKey === addDays(todayKey(now), 2)) return '后天'
  return formatShortDate(dateKey)
}

/** YYYY-MM-DD -> MM月DD日；跨年时附年份 */
export function formatShortDate(dateKey: string, now: Date = new Date()): string {
  if (!isValidDateKey(dateKey)) return ''
  const [y, m, d] = dateKey.split('-').map(Number)
  const label = `${m}月${d}日`
  return y === now.getFullYear() ? label : `${y}年${label}`
}
