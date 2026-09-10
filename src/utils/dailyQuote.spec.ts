import { describe, expect, it } from 'vitest'

import {
  QUOTES,
  dayPeriodOf,
  formatDateLabel,
  greetingOf,
  hashDateKey,
  pickQuoteIndex,
  quoteOfDay,
} from './dailyQuote'

/** 2026-09-10 是周四 */
function at(hours: number, minutes = 0, seconds = 0, day = 10): Date {
  return new Date(2026, 8, day, hours, minutes, seconds)
}

describe('时段与问候', () => {
  it('按时段划分一天', () => {
    expect(dayPeriodOf(at(0))).toBe('dawn')
    expect(dayPeriodOf(at(4, 59))).toBe('dawn')
    expect(dayPeriodOf(at(5))).toBe('morning')
    expect(dayPeriodOf(at(10, 59))).toBe('morning')
    expect(dayPeriodOf(at(11))).toBe('noon')
    expect(dayPeriodOf(at(12, 30))).toBe('noon')
    expect(dayPeriodOf(at(13))).toBe('afternoon')
    expect(dayPeriodOf(at(17, 59))).toBe('afternoon')
    expect(dayPeriodOf(at(18))).toBe('evening')
    expect(dayPeriodOf(at(23, 59))).toBe('evening')
  })

  it('问候语随日期时间变化', () => {
    expect(greetingOf(at(3))).toBe('凌晨好')
    expect(greetingOf(at(8))).toBe('早上好')
    expect(greetingOf(at(12))).toBe('中午好')
    expect(greetingOf(at(15))).toBe('下午好')
    expect(greetingOf(at(21))).toBe('晚上好')
  })
})

describe('日期标签', () => {
  it('格式为「M月D日 星期X」', () => {
    expect(formatDateLabel(at(9))).toBe('9月10日 星期四')
    expect(formatDateLabel(at(9, 0, 0, 13))).toBe('9月13日 星期日')
  })
})

describe('每日格言（日期哈希取句）', () => {
  it('哈希稳定且非负', () => {
    expect(hashDateKey('2026-09-10')).toBe(hashDateKey('2026-09-10'))
    expect(hashDateKey('2026-09-10')).toBeGreaterThanOrEqual(0)
    expect(hashDateKey('2026-09-10')).not.toBe(hashDateKey('2026-09-11'))
  })

  it('同一天永远取到同一句，刷新/重进都不变', () => {
    const first = quoteOfDay('2026-09-10')
    const second = quoteOfDay('2026-09-10')
    expect(second).toEqual(first)
    expect(pickQuoteIndex('2026-09-10', QUOTES.length)).toBe(
      pickQuoteIndex('2026-09-10', QUOTES.length),
    )
  })

  it('下标始终落在格言库范围内', () => {
    for (let day = 1; day <= 31; day++) {
      const key = `2026-09-${String(day).padStart(2, '0')}`
      const index = pickQuoteIndex(key, QUOTES.length)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(QUOTES.length)
    }
  })

  it('不同日期会取到不同格言（近 30 天至少 10 句不重复，轮换有效果）', () => {
    const picked = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const key = `2026-09-${String((i % 30) + 1).padStart(2, '0')}`
      picked.add(quoteOfDay(key).text)
    }
    expect(picked.size).toBeGreaterThanOrEqual(10)
  })

  it('可按注入的格言库取句，空库不报错', () => {
    const list = [
      { text: 'A', author: '甲' },
      { text: 'B', author: '乙' },
    ]
    expect(['A', 'B']).toContain(quoteOfDay('2026-09-10', list).text)
    expect(quoteOfDay('2026-09-10', [])).toEqual({ text: '', author: '' })
    expect(pickQuoteIndex('2026-09-10', 0)).toBe(0)
  })

  it('内置格言库非空且字段完整', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(20)
    for (const quote of QUOTES) {
      expect(quote.text.length).toBeGreaterThan(0)
      expect(quote.author.length).toBeGreaterThan(0)
    }
  })
})
