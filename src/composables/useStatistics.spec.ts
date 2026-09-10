import { describe, expect, it } from 'vitest'

import {
  aggregateByPriority,
  aggregateDaily,
  buildHeatmapWeeks,
  computeStatistics,
  heatmapLevel,
  lastNDays,
} from './useStatistics'

import type { Todo } from '@/types/todo'

/** 固定"现在"，保证日期计算确定性 */
const NOW = new Date(2026, 8, 8, 10, 0, 0) // 2026-09-08

function todo(partial: Partial<Todo> & { id: string }): Todo {
  return {
    title: partial.title ?? '任务',
    status: 'active',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    pinned: false,
    subtasks: [],
    ...partial,
  }
}

describe('lastNDays', () => {
  it('返回含今天、旧到新的 N 天日期键', () => {
    expect(lastNDays(3, NOW)).toEqual(['2026-09-06', '2026-09-07', '2026-09-08'])
  })

  it('跨月正确进位', () => {
    const oct = new Date(2026, 9, 2, 12, 0, 0) // 2026-10-02
    expect(lastNDays(3, oct)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02'])
  })
})

describe('aggregateByPriority', () => {
  it('按 高->中->低 排序，并统计总完成数', () => {
    const todos: Todo[] = [
      todo({ id: 'a', priority: 'high', status: 'completed' }),
      todo({ id: 'b', priority: 'high' }),
      todo({ id: 'c', priority: 'medium' }),
    ]
    const stats = aggregateByPriority(todos)
    expect(stats.map((s) => s.priority)).toEqual(['high', 'medium', 'low'])
    const high = stats[0]
    expect(high.total).toBe(2)
    expect(high.completed).toBe(1)
    expect(stats[1]).toMatchObject({ priority: 'medium', total: 1, completed: 0 })
  })
})

describe('aggregateDaily', () => {
  it('按 completedAt 归属到对应日期', () => {
    const todos: Todo[] = [
      todo({ id: 'a', status: 'completed', completedAt: '2026-09-07T09:00:00' }),
      todo({ id: 'b', status: 'completed', completedAt: '2026-09-07T18:00:00' }),
      todo({ id: 'c', status: 'completed', completedAt: '2026-09-05T09:00:00' }),
    ]
    const daily = aggregateDaily(todos, 5, NOW)
    expect(daily).toHaveLength(5)
    const byDate = Object.fromEntries(daily.map((d) => [d.date, d.completed]))
    expect(byDate).toEqual({
      '2026-09-04': 0,
      '2026-09-05': 1,
      '2026-09-06': 0,
      '2026-09-07': 2,
      '2026-09-08': 0,
    })
  })

  it('只统计已完成任务，未完成与范围外日期不计入', () => {
    const todos: Todo[] = [
      todo({ id: 'a', status: 'completed', completedAt: '2026-08-01T09:00:00' }), // 范围外
      todo({ id: 'b', status: 'active', completedAt: '2026-09-06T09:00:00' }), // 未完成，忽略
    ]
    const daily = aggregateDaily(todos, 5, NOW)
    expect(daily.every((d) => d.completed === 0)).toBe(true)
  })
})

describe('computeStatistics', () => {
  it('计算总数、完成数与完成率', () => {
    const todos: Todo[] = [
      todo({ id: 'a', status: 'completed', completedAt: '2026-09-07T09:00:00' }),
      todo({ id: 'b' }),
    ]
    const stats = computeStatistics(todos, NOW)
    expect(stats.total).toBe(2)
    expect(stats.completed).toBe(1)
    expect(stats.active).toBe(1)
    expect(stats.completionRate).toBe(50)
    expect(stats.daily).toHaveLength(90)
  })

  it('空列表完成率为 0', () => {
    const stats = computeStatistics([], NOW)
    expect(stats.completionRate).toBe(0)
    expect(stats.daily).toHaveLength(90)
  })
})

describe('heatmapLevel', () => {
  it('分档正确', () => {
    expect(heatmapLevel(0)).toBe(0)
    expect(heatmapLevel(1)).toBe(1)
    expect(heatmapLevel(2)).toBe(2)
    expect(heatmapLevel(3)).toBe(3)
    expect(heatmapLevel(4)).toBe(3)
    expect(heatmapLevel(5)).toBe(4)
    expect(heatmapLevel(10)).toBe(4)
  })
})

describe('buildHeatmapWeeks', () => {
  it('每周对齐并补齐 7 格，last 周不足补 null', () => {
    const daily = [
      { date: '2026-09-06', completed: 1 },
      { date: '2026-09-07', completed: 0 },
      { date: '2026-09-08', completed: 3 },
    ]
    const { weeks } = buildHeatmapWeeks(daily)
    expect(weeks.every((w) => w.length === 7)).toBe(true)

    // 所有非空格的日期与完成数一一对应
    const flat = weeks.flat().filter((c): c is NonNullable<typeof c> => c !== null)
    expect(flat.map((c) => c.date)).toEqual(['2026-09-06', '2026-09-07', '2026-09-08'])
    expect(flat.map((c) => c.completed)).toEqual([1, 0, 3])
    expect(flat[2].level).toBe(3)
  })

  it('真实首日前会出现前导空格以对齐周一', () => {
    const daily = [{ date: '2026-09-08', completed: 1 }]
    const { weeks, leadingBlank } = buildHeatmapWeeks(daily)
    expect(leadingBlank).toBeGreaterThanOrEqual(1)
    // 第一格为空格
    expect(weeks[0][0]).toBeNull()
    // 首个非空格必是真实日期
    expect(weeks[0].find((c) => c !== null)).toMatchObject({ date: '2026-09-08' })
  })
})
