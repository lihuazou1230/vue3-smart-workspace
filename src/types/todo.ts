/** 任务（Todo）领域类型 */

/** 任务状态 */
export type TodoStatus = 'active' | 'completed'

/** 任务优先级 */
export type TodoPriority = 'low' | 'medium' | 'high'

/** 列表筛选条件 */
export type TodoFilter = 'all' | 'active' | 'completed' | 'today' | 'week'

/** 优先级筛选：已选中的优先级集合；空数组表示不过滤（显示全部） */
export type PrioritySelection = TodoPriority[]

/** 子任务 */
export interface Subtask {
  id: string
  title: string
  completed: boolean
}

/** 单个任务 */
export interface Todo {
  id: string
  title: string
  status: TodoStatus
  priority: TodoPriority
  /** 截止日期，格式 YYYY-MM-DD（本地时区） */
  dueDate?: string
  /** 创建时间 ISO 字符串 */
  createdAt: string
  /** 完成时间 ISO 字符串 */
  completedAt?: string
  /** 置顶（今日聚焦/My Day） */
  pinned: boolean
  /** 子任务清单 */
  subtasks: Subtask[]
}

/** 新建任务入参 */
export type TodoInput = Pick<Todo, 'title' | 'priority' | 'dueDate'>

/** 默认优先级（TodoForm 未选择时使用） */
export const DEFAULT_PRIORITY: TodoPriority = 'medium'

/** 撤销删除窗口（毫秒）：1 分钟 */
export const UNDO_DELETE_TIMEOUT = 60_000

/** 待撤销删除的任务（软删除队列项，1 分钟内可撤销，超时才真正移除） */
export interface PendingDelete {
  todo: Todo
  /** 过期时间戳（ms），超过后真正移除 */
  expiresAt: number
}
