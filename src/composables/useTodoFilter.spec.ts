import { describe, expect, it } from 'vitest'

import type { Todo } from '@/types/todo'
import {
  countActive,
  countCompleted,
  filterByStatus,
  filterTodos,
  matchesKeyword,
} from './useTodoFilter'

function makeTodo(partial: Partial<Todo> & { id: string; title: string }): Todo {
  return {
    status: 'active',
    priority: 'medium',
    createdAt: '2026-09-01T00:00:00.000Z',
    pinned: false,
    subtasks: [],
    ...partial,
  }
}

const list: Todo[] = [
  makeTodo({ id: '1', title: '写周报', priority: 'high' }),
  makeTodo({ id: '2', title: '健身', status: 'completed', dueDate: '2026-09-15' }),
  makeTodo({ id: '3', title: '阅读 Vue 文档', dueDate: '2026-09-20' }),
]

describe('useTodoFilter', () => {
  it('filterByStatus: all 返回全部', () => {
    expect(filterByStatus(list, 'all', '2026-09-15')).toHaveLength(3)
  })

  it('filterByStatus: active / completed', () => {
    expect(filterByStatus(list, 'active', '2026-09-15').map((t) => t.id)).toEqual(['1', '3'])
    expect(filterByStatus(list, 'completed', '2026-09-15').map((t) => t.id)).toEqual(['2'])
  })

  it('filterByStatus: today 匹配 dueDate === today', () => {
    expect(filterByStatus(list, 'today', '2026-09-15').map((t) => t.id)).toEqual(['2'])
    expect(filterByStatus(list, 'today', '2026-09-16')).toHaveLength(0)
  })

  it('matchesKeyword 大小写不敏感且忽略空白', () => {
    expect(matchesKeyword(list[0], ' 周报 ')).toBe(true)
    expect(matchesKeyword(list[0], 'ZHOUBAO')).toBe(false)
    expect(matchesKeyword(list[2], 'vue')).toBe(true)
    expect(matchesKeyword(list[0], '')).toBe(true)
  })

  it('filterTodos 组合状态与关键字', () => {
    const result = filterTodos(list, { filter: 'all', keyword: 'vue' })
    expect(result.map((t) => t.id)).toEqual(['3'])
  })

  it('countActive / countCompleted', () => {
    expect(countActive(list)).toBe(2)
    expect(countCompleted(list)).toBe(1)
  })
})
