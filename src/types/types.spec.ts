import { describe, expect, it } from 'vitest'

import type { TodoPriority } from './todo'
import type { TemperatureUnit } from './weather'
import type { DailyStat, PriorityStat, TaskStatistics } from './statistics'

/** 类型定义冒烟测试：确保领域类型可被正确引用与构造 */
describe('domain types', () => {
  it('todo 类型构造正确', () => {
    const priority: TodoPriority = 'high'
    expect(priority).toBe('high')
  })

  it('weather 类型构造正确', () => {
    const unit: TemperatureUnit = 'metric'
    expect(unit).toBe('metric')
  })

  it('statistics 类型结构可用', () => {
    const daily: DailyStat = { date: '2025-01-01', completed: 3 }
    const byPriority: PriorityStat = { priority: 'medium', total: 2, completed: 1 }
    const stats: TaskStatistics = {
      total: 2,
      completed: 1,
      active: 1,
      completionRate: 50,
      byPriority: [byPriority],
      daily: [daily],
    }
    expect(stats.completionRate).toBe(50)
    expect(stats.daily[0].completed).toBe(3)
  })
})
