/**
 * 赚钱秒表（Earnings）领域类型。
 *
 * 设计要点：金额一律以**整数「分」**存储与运算，避免浮点累加误差；
 * 所有计算由 utils/earnings.ts 的纯函数完成（now 可注入，便于单测）。
 */

/** 计薪状态 */
export type EarningsStatus =
  /** 未设置月薪或工作时段无效：展示设置引导 */
  | 'not-configured'
  /** 非工作日（周末）：不累计 */
  | 'weekend'
  /** 上班前：不累计 */
  | 'before-work'
  /** 工作中：按时间戳差值累计 */
  | 'working'
  /** 午休中：金额冻结在午休开始时刻 */
  | 'lunch'
  /** 已下班：展示今日满勤金额 */
  | 'after-work'

/** 赚钱秒表配置（持久化到 localStorage） */
export interface EarningsConfig {
  /** 月薪（元） */
  monthlySalary: number
  /** 上班时间 HH:mm */
  workStart: string
  /** 下班时间 HH:mm */
  workEnd: string
  /** 午休开始 HH:mm；留空表示不扣午休 */
  lunchStart: string
  /** 午休结束 HH:mm；留空表示不扣午休 */
  lunchEnd: string
  /** 月计薪天数（默认 21.75） */
  monthWorkDays: number
  /** 仅在周一 ~ 周五计薪 */
  weekdaysOnly: boolean
}

/** 下一次状态切换的目标（用于生成倒计时文案） */
export type EarningsNextChange = 'none' | 'on-work' | 'lunch' | 'off-work'

/** 某一时刻的赚钱秒表快照（全部金额单位为「分」） */
export interface EarningsSnapshot {
  status: EarningsStatus
  /** 今日已赚（分）——主指标 */
  earnedFen: number
  /** 本月已赚（分）——次要指标 */
  monthEarnedFen: number
  /** 本月已赚相对「上月同期」的涨跌百分比（上月同期为 0 时为 0） */
  monthDeltaPercent: number
  /** 本月计薪天数（整月） */
  monthPaidDays: number
  /** 本月已计薪天数（已完整过去 + 今天，非计薪日不加） */
  monthElapsedPaidDays: number
  /** 今日满勤应得（分） */
  dailyFen: number
  /** 时薪（分） */
  hourlyFen: number
  /** 今日计薪总秒数（已扣除午休） */
  dailyWorkSeconds: number
  /** 今日已计薪秒数 */
  elapsedWorkSeconds: number
  /** 今日进度 0 ~ 1 */
  progress: number
  /** 下一次状态切换的目标 */
  nextChange: EarningsNextChange
  /** 距下一次状态切换的秒数（非工作状态为 0） */
  secondsToNextChange: number
}

/** localStorage 键 */
export const EARNINGS_STORAGE_KEY = 'smart-workspace:earnings'

/** 默认配置：朝九晚六、午休 1 小时、月计薪 21.75 天；月薪待用户填写 */
export const DEFAULT_EARNINGS_CONFIG: EarningsConfig = {
  monthlySalary: 0,
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  monthWorkDays: 21.75,
  weekdaysOnly: true,
}

/** 状态文案（非工作中状态展示文案而非金额） */
export const EARNINGS_STATUS_TEXT: Record<EarningsStatus, string> = {
  'not-configured': '设置月薪后开始计时',
  weekend: '周末休息，今天不用赚钱 🌴',
  'before-work': '还没到上班时间，先喝杯咖啡 ☕',
  working: '今日进账中',
  lunch: '午休时间，金额已暂停 🍜',
  'after-work': '今日已下班，明天继续 💪',
}
