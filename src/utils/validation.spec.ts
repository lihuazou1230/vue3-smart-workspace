import { describe, expect, it } from 'vitest'

import { TITLE_MAX_LENGTH, isValidDateKey, validateTodoTitle } from './validation'

describe('validation', () => {
  it('validateTodoTitle：空标题不通过', () => {
    expect(validateTodoTitle('').valid).toBe(false)
    expect(validateTodoTitle('   ').valid).toBe(false)
  })

  it('validateTodoTitle：超长不通过', () => {
    expect(validateTodoTitle('a'.repeat(TITLE_MAX_LENGTH + 1)).valid).toBe(false)
    expect(validateTodoTitle('a'.repeat(TITLE_MAX_LENGTH)).valid).toBe(true)
  })

  it('validateTodoTitle：trim 后通过', () => {
    const result = validateTodoTitle('  写周报  ')
    expect(result.valid).toBe(true)
  })

  it('isValidDateKey 识别合法/非法日期', () => {
    expect(isValidDateKey('2026-09-15')).toBe(true)
    expect(isValidDateKey('2024-02-29')).toBe(true) // 闰年
    expect(isValidDateKey('2026-02-30')).toBe(false) // 不存在
    expect(isValidDateKey('2026-13-01')).toBe(false)
    expect(isValidDateKey('2026/09/15')).toBe(false)
    expect(isValidDateKey('2026-9-5')).toBe(false)
    expect(isValidDateKey('')).toBe(false)
  })
})
