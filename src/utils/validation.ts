/** 表单校验工具（纯函数） */

export const TITLE_MAX_LENGTH = 100

export interface ValidationResult {
  valid: boolean
  message?: string
}

/** 任务标题校验：非空 + 长度上限 */
export function validateTodoTitle(title: string): ValidationResult {
  const trimmed = title.trim()
  if (!trimmed) return { valid: false, message: '任务标题不能为空' }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return { valid: false, message: `任务标题不能超过 ${TITLE_MAX_LENGTH} 个字符` }
  }
  return { valid: true }
}

/** 校验 YYYY-MM-DD 是否为真实存在的日期键 */
export function isValidDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}
