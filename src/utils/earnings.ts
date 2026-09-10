/**
 * 赚钱秒表：纯函数计算层（now 可注入，便于单测）。
 *
 * 两条硬性约束（也是面试话术的核心）：
 * 1. **金额永远由时间戳差值重算**，不做 setInterval 累加计数 —— 浏览器后台标签页
 *    会把定时器节流到 1 次/分钟，累加式实现切回页面时误差巨大；差值式实现任意
 *    时刻切回来数字都是准的（无跳变、无漂移）。
 * 2. **金额内部一律用整数「分」运算**，只在最后格式化成「元.分」展示，避免
 *    `0.1 + 0.2` 这类浮点误差在长时间累计后显形。
 */

import type {
  EarningsConfig,
  EarningsNextChange,
  EarningsSnapshot,
  EarningsStatus,
} from '@/types/earnings'

const SECONDS_PER_HOUR = 3600
const SECONDS_PER_MINUTE = 60
const HOURS_PER_DAY = 24
const MINUTES_PER_HOUR = 60

/** HH:mm -> 当天 0 点起的秒数；非法输入返回 null */
export function parseTimeToSeconds(time: string): number | null {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!matched) return null
  const hour = Number(matched[1])
  const minute = Number(matched[2])
  if (hour >= HOURS_PER_DAY || minute >= MINUTES_PER_HOUR) return null
  return hour * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE
}

/** 当天 0 点起已过的秒数（含秒，用于精确到秒的差值计算） */
export function secondsOfDay(date: Date): number {
  return (
    date.getHours() * SECONDS_PER_HOUR + date.getMinutes() * SECONDS_PER_MINUTE + date.getSeconds()
  )
}

/** 元 -> 分（四舍五入到整数分） */
export function yuanToFen(yuan: number): number {
  if (!Number.isFinite(yuan)) return 0
  return Math.round(yuan * 100)
}

/** 分 -> 「1,234.56」字符串（元，固定两位小数，千分位分组） */
export function formatFen(fen: number): string {
  const rounded = Math.round(Number.isFinite(fen) ? fen : 0)
  const sign = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded)
  const yuan = Math.floor(abs / 100)
  const cents = (abs % 100).toString().padStart(2, '0')
  const grouped = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}.${cents}`
}

/** 秒 -> 「3 小时 24 分」/「24 分 12 秒」/「12 秒」 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / SECONDS_PER_HOUR)
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const secs = total % SECONDS_PER_MINUTE
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  if (minutes > 0) return `${minutes} 分 ${secs} 秒`
  return `${secs} 秒`
}

/** 午休与工作时段的重叠秒数（午休完全在工时外则为 0） */
function lunchOverlapSeconds(config: EarningsConfig, workStart: number, workEnd: number): number {
  const lunchStart = parseTimeToSeconds(config.lunchStart)
  const lunchEnd = parseTimeToSeconds(config.lunchEnd)
  if (lunchStart === null || lunchEnd === null || lunchEnd <= lunchStart) return 0
  const from = Math.max(workStart, lunchStart)
  const to = Math.min(workEnd, lunchEnd)
  return Math.max(0, to - from)
}

/** 今日计薪总秒数：下班 − 上班 − 与工时重叠的午休；配置无效返回 0 */
export function dailyWorkSeconds(config: EarningsConfig): number {
  const start = parseTimeToSeconds(config.workStart)
  const end = parseTimeToSeconds(config.workEnd)
  if (start === null || end === null || end <= start) return 0
  return Math.max(0, end - start - lunchOverlapSeconds(config, start, end))
}

/** 截至 now 已计薪的秒数（扣除午休、封顶到下班时刻） */
export function elapsedWorkSeconds(config: EarningsConfig, now: Date): number {
  const start = parseTimeToSeconds(config.workStart)
  const end = parseTimeToSeconds(config.workEnd)
  if (start === null || end === null || end <= start) return 0

  const nowSec = secondsOfDay(now)
  if (nowSec <= start) return 0

  const capped = Math.min(nowSec, end)
  const lunchStart = parseTimeToSeconds(config.lunchStart)
  const lunchEnd = parseTimeToSeconds(config.lunchEnd)
  let paid = capped - start
  if (lunchStart !== null && lunchEnd !== null && lunchEnd > lunchStart) {
    paid -= Math.max(0, Math.min(capped, lunchEnd) - Math.max(start, lunchStart))
  }
  return Math.max(0, paid)
}

/** 今日满勤应得（分）：月薪 ÷ 月计薪天数 */
export function dailyEarnedFen(config: EarningsConfig): number {
  const monthly = yuanToFen(config.monthlySalary)
  if (monthly <= 0 || config.monthWorkDays <= 0) return 0
  return Math.round(monthly / config.monthWorkDays)
}

/** 时薪（分）：日薪 ÷ 每日计薪小时数 */
export function hourlyEarnedFen(config: EarningsConfig): number {
  const seconds = dailyWorkSeconds(config)
  if (seconds <= 0) return 0
  return Math.round((dailyEarnedFen(config) * SECONDS_PER_HOUR) / seconds)
}

/**
 * 今日已赚（分）。
 * 单一整数除法一次算到底：`月薪分 × 已计薪秒 / (月计薪天数 × 每日计薪秒)`，
 * 不做「秒薪 × 秒数」的浮点中间量，也不做逐秒累加。
 * 非计薪日（周末）恒为 0 —— 「只在计薪时间内累计」由数据层保证，而不只是靠 UI 隐藏。
 */
export function earnedFen(config: EarningsConfig, now: Date): number {
  const monthly = yuanToFen(config.monthlySalary)
  const totalSeconds = dailyWorkSeconds(config)
  if (monthly <= 0 || totalSeconds <= 0 || config.monthWorkDays <= 0) return 0
  if (!isPaidDay(config, now)) return 0

  const elapsed = Math.min(elapsedWorkSeconds(config, now), totalSeconds)
  return Math.round((monthly * elapsed) / (config.monthWorkDays * totalSeconds))
}

/** 今天是否为计薪日（开启「仅工作日计薪」时，周六周日不计薪） */
export function isPaidDay(config: EarningsConfig, now: Date): boolean {
  if (!config.weekdaysOnly) return true
  const day = now.getDay()
  return day !== 0 && day !== 6
}

/** 本月计薪天数（整月，含尚未到来的日子） */
export function paidDaysInMonth(config: EarningsConfig, now: Date): number {
  const year = now.getFullYear()
  const month = now.getMonth()
  const total = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let day = 1; day <= total; day++) {
    if (isPaidDay(config, new Date(year, month, day))) count += 1
  }
  return count
}

/** 本月截至「昨天」已完整过去的计薪天数 */
export function completedPaidDaysBefore(config: EarningsConfig, now: Date): number {
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  let count = 0
  for (let day = 1; day < today; day++) {
    if (isPaidDay(config, new Date(year, month, day))) count += 1
  }
  return count
}

/** 本月已计薪天数：已完整过去的天数 + 今天（今天是计薪日时） */
export function elapsedPaidDays(config: EarningsConfig, now: Date): number {
  return completedPaidDaysBefore(config, now) + (isPaidDay(config, now) ? 1 : 0)
}

/**
 * 本月已赚（分）——次要指标。
 * 与「今日已赚」共用同一个日薪基准（月薪 ÷ 月计薪天数），保证两个数字对得上账：
 * `已完整计薪天数 × 日薪 + 今日已赚`，并**封顶在月薪**——月计薪天数取的是月平均
 * 21.75 天，个别月份有 22~23 个工作日，按位累计会略微超过工资，而实际发放额就是月薪。
 */
export function monthlyEarnedFen(config: EarningsConfig, now: Date): number {
  const monthly = yuanToFen(config.monthlySalary)
  if (monthly <= 0 || config.monthWorkDays <= 0) return 0

  const days = completedPaidDaysBefore(config, now)
  const past = Math.round((monthly * days) / config.monthWorkDays)
  return Math.min(monthly, past + earnedFen(config, now))
}

/** 当前计薪状态 */
export function resolveEarningsStatus(config: EarningsConfig, now: Date): EarningsStatus {
  if (yuanToFen(config.monthlySalary) <= 0) return 'not-configured'

  const start = parseTimeToSeconds(config.workStart)
  const end = parseTimeToSeconds(config.workEnd)
  if (start === null || end === null || end <= start) return 'not-configured'

  if (!isPaidDay(config, now)) return 'weekend'

  const nowSec = secondsOfDay(now)
  if (nowSec < start) return 'before-work'
  if (nowSec >= end) return 'after-work'

  const lunchStart = parseTimeToSeconds(config.lunchStart)
  const lunchEnd = parseTimeToSeconds(config.lunchEnd)
  if (lunchStart !== null && lunchEnd !== null && lunchEnd > lunchStart) {
    if (nowSec >= lunchStart && nowSec < lunchEnd) return 'lunch'
  }
  return 'working'
}

/**
 * 下一次状态切换：目标 + 剩余秒数。
 * 上班前 → 上班；工作中 → 午休（若还没到）否则下班；午休 → 午后上班；其余无。
 */
export function nextChange(
  config: EarningsConfig,
  now: Date,
): { target: EarningsNextChange; seconds: number } {
  const status = resolveEarningsStatus(config, now)
  const nowSec = secondsOfDay(now)
  const until = (point: number | null) => (point === null ? 0 : Math.max(0, point - nowSec))

  if (status === 'before-work') {
    return { target: 'on-work', seconds: until(parseTimeToSeconds(config.workStart)) }
  }
  if (status === 'lunch') {
    return { target: 'on-work', seconds: until(parseTimeToSeconds(config.lunchEnd)) }
  }
  if (status === 'working') {
    const lunchStart = parseTimeToSeconds(config.lunchStart)
    if (lunchStart !== null && nowSec < lunchStart) {
      return { target: 'lunch', seconds: lunchStart - nowSec }
    }
    return { target: 'off-work', seconds: until(parseTimeToSeconds(config.workEnd)) }
  }
  return { target: 'none', seconds: 0 }
}

/** 汇总快照：组件渲染的唯一数据来源 */
export function computeEarnings(config: EarningsConfig, now: Date = new Date()): EarningsSnapshot {
  const totalSeconds = dailyWorkSeconds(config)
  const elapsed = elapsedWorkSeconds(config, now)
  const status = resolveEarningsStatus(config, now)
  const change = nextChange(config, now)

  return {
    status,
    earnedFen: earnedFen(config, now),
    monthEarnedFen: monthlyEarnedFen(config, now),
    monthPaidDays: paidDaysInMonth(config, now),
    monthElapsedPaidDays: elapsedPaidDays(config, now),
    dailyFen: dailyEarnedFen(config),
    hourlyFen: hourlyEarnedFen(config),
    dailyWorkSeconds: totalSeconds,
    elapsedWorkSeconds: elapsed,
    progress: totalSeconds <= 0 ? 0 : Math.min(1, elapsed / totalSeconds),
    nextChange: change.target,
    secondsToNextChange: change.seconds,
  }
}

/** 配置是否完整可用（月薪 > 0 且工作时段合法） */
export function isEarningsConfigured(config: EarningsConfig): boolean {
  return yuanToFen(config.monthlySalary) > 0 && dailyWorkSeconds(config) > 0
}
