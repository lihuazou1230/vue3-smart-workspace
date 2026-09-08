import type { TodoPriority } from './todo'

/** 单日任务统计（热力图数据单元） */
export interface DailyStat {
  /** 日期键 YYYY-MM-DD */
  date: string
  /** 当日完成数 */
  completed: number
}

/** 按优先级聚合的统计 */
export interface PriorityStat {
  priority: TodoPriority
  total: number
  completed: number
}

/** 任务总览统计 */
export interface TaskStatistics {
  total: number
  completed: number
  active: number
  /** 完成率 0-100 */
  completionRate: number
  byPriority: PriorityStat[]
  /** 近 90 天每日完成情况 */
  daily: DailyStat[]
}
