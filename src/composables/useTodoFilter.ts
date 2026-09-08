import type { Todo, TodoFilter, TodoStatus } from '@/types/todo'
import { todayKey } from '@/utils/dateFormatter'

export interface TodoFilterQuery {
  filter: TodoFilter
  keyword: string
  /** 用于 today 筛选的日期键（默认今天） */
  today?: string
}

/** 按状态过滤（不含 keyword） */
export function filterByStatus(todos: Todo[], filter: TodoFilter, today = todayKey()): Todo[] {
  switch (filter) {
    case 'active':
      return todos.filter((t) => t.status === 'active')
    case 'completed':
      return todos.filter((t) => t.status === 'completed')
    case 'today':
      return todos.filter((t) => t.dueDate === today)
    case 'all':
    default:
      return todos
  }
}

/** 关键字匹配：标题（大小写不敏感、忽略首尾空白） */
export function matchesKeyword(todo: Todo, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true
  return todo.title.toLowerCase().includes(kw)
}

/** 复合过滤：先按状态，再按关键字 */
export function filterTodos(todos: Todo[], query: TodoFilterQuery): Todo[] {
  const { filter, keyword, today } = query
  return filterByStatus(todos, filter, today).filter((t) => matchesKeyword(t, keyword))
}

/** 未完成数量 */
export function countActive(todos: Todo[]): number {
  return todos.filter((t) => t.status === 'active').length
}

/** 已完成数量 */
export function countCompleted(todos: Todo[]): number {
  return todos.filter((t) => t.status === 'completed').length
}

/** 校验一个值是否为合法状态 */
export function isTodoStatus(value: unknown): value is TodoStatus {
  return value === 'active' || value === 'completed'
}
