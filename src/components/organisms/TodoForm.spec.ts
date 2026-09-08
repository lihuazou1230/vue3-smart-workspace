import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import TodoForm from './TodoForm.vue'

async function submitForm(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('form').trigger('submit')
}

describe('TodoForm', () => {
  it('输入标题提交，发射 create 并清空表单', async () => {
    const wrapper = mount(TodoForm)
    await wrapper.find('input[placeholder*="添加新任务"]').setValue('写周报')
    await submitForm(wrapper)

    const created = wrapper.emitted('create')?.[0]?.[0] as Record<string, unknown>
    expect(created.title).toBe('写周报')
    expect(created.priority).toBe('medium')
    expect(created.dueDate).toBeUndefined()

    // 表单清空
    expect(
      (wrapper.find('input[placeholder*="添加新任务"]').element as HTMLInputElement).value,
    ).toBe('')
  })

  it('回车提交同样生效', async () => {
    const wrapper = mount(TodoForm)
    await wrapper.find('input[placeholder*="添加新任务"]').setValue('回车任务')
    await wrapper.find('input[placeholder*="添加新任务"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('空白标题不发射 create 且提示错误', async () => {
    const wrapper = mount(TodoForm)
    await submitForm(wrapper)
    expect(wrapper.emitted('create')).toBeUndefined()
    expect(wrapper.text()).toContain('任务标题不能为空')
  })

  it('选择优先级与截止日期后发射对应字段', async () => {
    const wrapper = mount(TodoForm)
    await wrapper.find('input[placeholder*="添加新任务"]').setValue('重要任务')

    const highBtn = wrapper.findAll('button').find((b) => b.text() === '高')
    expect(highBtn).toBeTruthy()
    await highBtn!.trigger('click')

    await wrapper.find('input[type="date"]').setValue('2026-10-01')
    await submitForm(wrapper)

    const created = wrapper.emitted('create')?.[0]?.[0] as Record<string, unknown>
    expect(created.priority).toBe('high')
    expect(created.dueDate).toBe('2026-10-01')
  })
})
