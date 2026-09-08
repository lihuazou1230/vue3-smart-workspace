/** 任务（Todo）领域类型 */

/** 任务状态 */
export type TodoStatus = 'active' | 'completed'

/** 任务优先级 */
export type TodoPriority = 'low' | 'medium' | 'high'

/** 列表筛选条件 */
export type TodoFilter = 'all' | 'active' | 'completed' | 'today'

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
