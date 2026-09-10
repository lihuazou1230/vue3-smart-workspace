/**
 * 每日格言 + 时段问候（纯函数，now 可注入便于单测）。
 *
 * 「每日一句」用**日期键哈希**取句：同一天永远拿到同一句（刷新/重进不换），
 * 换一天自然换一句，无需后端、无需定时任务，成本极低。
 */

import quotes from '@/data/quotes.json'
import { todayKey, toDateKey } from '@/utils/dateFormatter'

/** 单条格言 */
export interface DailyQuote {
  text: string
  author: string
}

/** 一天中的时段 */
export type DayPeriod = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening'

/** 全部格言（本地 JSON，构建期内联，无网络请求） */
export const QUOTES: DailyQuote[] = quotes

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

/** 当前时段：凌晨(0-4) / 早上(5-10) / 中午(11-12) / 下午(13-17) / 晚上(18-23) */
export function dayPeriodOf(date: Date = new Date()): DayPeriod {
  const hour = date.getHours()
  if (hour < 5) return 'dawn'
  if (hour < 11) return 'morning'
  if (hour < 13) return 'noon'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/** 时段问候语 */
export function greetingOf(date: Date = new Date()): string {
  const map: Record<DayPeriod, string> = {
    dawn: '凌晨好',
    morning: '早上好',
    noon: '中午好',
    afternoon: '下午好',
    evening: '晚上好',
  }
  return map[dayPeriodOf(date)]
}

/** 日期键 -> 稳定哈希（FNV-1a 32 位，纯字符串运算，跨环境一致） */
export function hashDateKey(dateKey: string): number {
  let hash = 2166136261
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** 日期键 -> 格言下标（同一天固定，不同日期分散） */
export function pickQuoteIndex(dateKey: string, total: number): number {
  if (total <= 0) return 0
  return hashDateKey(dateKey) % total
}

/** 取当日格言；可注入格言库便于测试 */
export function quoteOfDay(dateKey: string = todayKey(), list: DailyQuote[] = QUOTES): DailyQuote {
  if (list.length === 0) return { text: '', author: '' }
  return list[pickQuoteIndex(dateKey, list.length)]
}

/** 「9月10日 星期三」 */
export function formatDateLabel(date: Date = new Date()): string {
  const [, month, day] = toDateKey(date).split('-').map(Number)
  return `${month}月${day}日 ${WEEKDAY_LABELS[date.getDay()]}`
}
