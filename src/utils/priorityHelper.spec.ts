import { describe, expect, it } from 'vitest'

import {
  PRIORITY_ORDER,
  isTodoPriority,
  priorityLabel,
  priorityMeta,
  priorityTone,
} from './priorityHelper'

describe('priorityHelper', () => {
  it('标签映射', () => {
    expect(priorityLabel('low')).toBe('低')
    expect(priorityLabel('medium')).toBe('中')
    expect(priorityLabel('high')).toBe('高')
  })

  it('色板映射', () => {
    expect(priorityTone('low')).toBe('info')
    expect(priorityTone('medium')).toBe('warning')
    expect(priorityTone('high')).toBe('danger')
  })

  it('meta 聚合', () => {
    expect(priorityMeta('high')).toEqual({ label: '高', tone: 'danger', weight: 3 })
  })

  it('展示顺序高->低', () => {
    expect(PRIORITY_ORDER).toEqual(['high', 'medium', 'low'])
  })

  it('isTodoPriority 类型守卫', () => {
    expect(isTodoPriority('high')).toBe(true)
    expect(isTodoPriority('urgent')).toBe(false)
    expect(isTodoPriority(undefined)).toBe(false)
  })
})
