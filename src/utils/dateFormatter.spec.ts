import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
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

  it('addMonths 支持常规、跨年与月末钳制', () => {
    expect(addMonths('2026-09-15', 1)).toBe('2026-10-15')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28') // 2026 非闰年
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29') // 闰年钳制
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-09-15', 12)).toBe('2027-09-15')
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

  it('畸形日期（如 6 位年份）返回空串，不渲染', () => {
    expect(formatShortDate('232233-10-01', NOW)).toBe('')
    expect(formatDueLabel('232233-10-01', NOW)).toBe('')
    expect(formatShortDate('2026-02-30', NOW)).toBe('')
    expect(formatDueLabel('abcdef', NOW)).toBe('')
  })
})
