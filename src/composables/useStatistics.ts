/**
 * 任务统计：聚合纯函数 + useTaskStatistics composable。
 * 纯函数便于单测（now 可注入），composable 连接 todoStore，供图表/热力图使用。
 */

import { computed } from 'vue'

import { useTodoStore } from '@/stores/todoStore'
import { addDays, toDateKey, todayKey } from '@/utils/dateFormatter'
import { PRIORITY_ORDER } from '@/utils/priorityHelper'
import type { Todo } from '@/types/todo'
import type { DailyStat, PriorityStat, TaskStatistics } from '@/types/statistics'

/** 近 N 天（含今天）的日期键列表，旧 -> 新 */
export function lastNDays(n: number, now: Date = new Date()): string[] {
  const today = todayKey(now)
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) days.push(addDays(today, -i))
  return days
}

/** 按优先级聚合：返回高 -> 中 -> 低 的总数与完成数 */
export function aggregateByPriority(todos: Todo[]): PriorityStat[] {
  return PRIORITY_ORDER.map((priority) => {
    const list = todos.filter((t) => t.priority === priority)
    return {
      priority,
      total: list.length,
      completed: list.filter((t) => t.status === 'completed').length,
    }
  })
}

/**
 * 近 N 天每日完成数聚合。
 * 将已完成任务按其 completedAt 归属到当天；范围外的日期键不计入，范围内无完成则为 0。
 */
export function aggregateDaily(todos: Todo[], days: number, now: Date = new Date()): DailyStat[] {
  const dateKeys = lastNDays(days, now)
  const counts = new Map<string, number>(dateKeys.map((d) => [d, 0]))

  for (const t of todos) {
    if (t.status !== 'completed' || !t.completedAt) continue
    const key = toDateKey(new Date(t.completedAt))
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return dateKeys.map((date) => ({ date, completed: counts.get(date) ?? 0 }))
}

/** 汇总统计：总数、完成率、按优先级、近 90 天每日 */
export function computeStatistics(todos: Todo[], now: Date = new Date()): TaskStatistics {
  const total = todos.length
  const completed = todos.filter((t) => t.status === 'completed').length
  const active = total - completed
  return {
    total,
    completed,
    active,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    byPriority: aggregateByPriority(todos),
    daily: aggregateDaily(todos, 90, now),
  }
}

/** 热力图单元：以日期对齐的 90 天色阶格 */
export interface HeatmapCell {
  /** YYYY-MM-DD；空位（对齐周一）为 null */
  date: string | null
  completed: number
  /** 0-4 强度级别（0 为空） */
  level: 0 | 1 | 2 | 3 | 4
}

/** 完成数 -> 强度级别（GitHub 式分档） */
export function heatmapLevel(completed: number): 0 | 1 | 2 | 3 | 4 {
  if (completed <= 0) return 0
  if (completed === 1) return 1
  if (completed === 2) return 2
  if (completed <= 4) return 3
  return 4
}

/** 日期键 -> 周内索引（周一=0 ... 周日=6） */
function weekdayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0=日 ... 6=六
  return (dow + 6) % 7 // 0=一 ... 6=日
}

/**
 * 生成热力图矩阵：按周纵向排列（每周最多 7 格，周一为首）。
 * 首周会补前导空格，使第一个真实格落在周一列，便于对齐星期标签。
 */
export function buildHeatmapWeeks(daily: DailyStat[]): {
  weeks: (HeatmapCell | null)[][]
  leadingBlank: number
} {
  const first = daily[0]
  const leadingBlank = first ? weekdayIndex(first.date) : 0

  const cells: (HeatmapCell | null)[] = [
    ...Array.from({ length: leadingBlank }, () => null),
    ...daily.map((d) => ({
      date: d.date,
      completed: d.completed,
      level: heatmapLevel(d.completed),
    })),
  ]

  const weeks: (HeatmapCell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  while (weeks[weeks.length - 1] && weeks[weeks.length - 1].length < 7) {
    weeks[weeks.length - 1].push(null)
  }

  return { weeks, leadingBlank }
}

/** 连接 todoStore 的任务统计数据（随任务变化自动更新） */
export function useTaskStatistics() {
  const store = useTodoStore()
  const statistics = computed<TaskStatistics>(() => computeStatistics(store.visibleTodos))
  const heatmap = computed(() => buildHeatmapWeeks(statistics.value.daily))
  return { statistics, heatmap }
}
