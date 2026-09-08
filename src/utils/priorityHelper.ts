import type { TodoPriority } from '@/types/todo'

/** 优先级展示元信息 */
export type PriorityTone = 'info' | 'warning' | 'danger'

export interface PriorityMeta {
  label: string
  tone: PriorityTone
  /** 优先级排序权重（越大越高） */
  weight: number
}

export const PRIORITY_LABEL: Record<TodoPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

export const PRIORITY_TONE: Record<TodoPriority, PriorityTone> = {
  low: 'info',
  medium: 'warning',
  high: 'danger',
}

export const PRIORITY_WEIGHT: Record<TodoPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

/** 高 -> 低 的展示顺序 */
export const PRIORITY_ORDER: readonly TodoPriority[] = ['high', 'medium', 'low']

export function priorityLabel(priority: TodoPriority): string {
  return PRIORITY_LABEL[priority]
}

export function priorityTone(priority: TodoPriority): PriorityTone {
  return PRIORITY_TONE[priority]
}

export function priorityMeta(priority: TodoPriority): PriorityMeta {
  return {
    label: PRIORITY_LABEL[priority],
    tone: PRIORITY_TONE[priority],
    weight: PRIORITY_WEIGHT[priority],
  }
}

export function isTodoPriority(value: unknown): value is TodoPriority {
  return value === 'low' || value === 'medium' || value === 'high'
}
