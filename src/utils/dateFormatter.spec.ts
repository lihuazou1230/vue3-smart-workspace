import { describe, expect, it } from 'vitest'

import {
  addDays,
  formatDueLabel,
  formatShortDate,
  isOverdue,
  isToday,
  todayKey,
  toDateKey,
} from './dateFormatter'

const NOW = new Date(2026, 8, 15, 10, 30) // 2026-09-15

describe('dateFormatter', () => {
  it('toDateKey 输出本地 YYYY-MM-DD', () => {
    expect(toDateKey(NOW)).toBe('2026-09-15')
    expect(toDateKey(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('todayKey 使用注入 now', () => {
    expect(todayKey(NOW)).toBe('2026-09-15')
  })

  it('isToday / isOverdue 判定正确', () => {
    expect(isToday('2026-09-15', NOW)).toBe(true)
    expect(isToday('2026-09-14', NOW)).toBe(false)
    expect(isOverdue('2026-09-14', NOW)).toBe(true)
    expect(isOverdue('2026-09-15', NOW)).toBe(false)
    expect(isOverdue('2026-09-16', NOW)).toBe(false)
  })

  it('addDays 支持跨月跨年', () => {
    expect(addDays('2026-09-15', 1)).toBe('2026-09-16')
    expect(addDays('2026-09-15', -2)).toBe('2026-09-13')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('formatDueLabel 输出相对到期文案', () => {
    expect(formatDueLabel('2026-09-14', NOW)).toBe('已逾期')
    expect(formatDueLabel('2026-09-15', NOW)).toBe('今天')
    expect(formatDueLabel('2026-09-16', NOW)).toBe('明天')
    expect(formatDueLabel('2026-09-17', NOW)).toBe('后天')
    expect(formatDueLabel('2026-10-01', NOW)).toBe('10月1日')
    expect(formatDueLabel('2027-03-05', NOW)).toBe('2027年3月5日')
  })

  it('formatShortDate 同年省略年份', () => {
    expect(formatShortDate('2026-09-20', NOW)).toBe('9月20日')
    expect(formatShortDate('2027-01-02', NOW)).toBe('2027年1月2日')
  })
})
