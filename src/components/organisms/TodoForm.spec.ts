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

    // 通过暴露的 state 驱动截止日期（el-date-picker 在 happy-dom 中交互复杂，直接测逻辑）
    ;(wrapper.vm as unknown as { dueDate: string }).dueDate = '2026-10-01'
    await submitForm(wrapper)

    const created = wrapper.emitted('create')?.[0]?.[0] as Record<string, unknown>
    expect(created.priority).toBe('high')
    expect(created.dueDate).toBe('2026-10-01')
  })

  it('超长年份（如 232233）的日期不发射 create 且提示错误', async () => {
    const wrapper = mount(TodoForm)
    await wrapper.find('input[placeholder*="添加新任务"]').setValue('异常日期任务')
    ;(wrapper.vm as unknown as { dueDate: string }).dueDate = '232233-10-01'
    await submitForm(wrapper)

    expect(wrapper.emitted('create')).toBeUndefined()
    expect(wrapper.text()).toContain('截止日期格式不正确')
  })

  it('不存在的日期（如 2026-02-30）同样不发射 create', async () => {
    const wrapper = mount(TodoForm)
    await wrapper.find('input[placeholder*="添加新任务"]').setValue('不存在的日期')
    ;(wrapper.vm as unknown as { dueDate: string }).dueDate = '2026-02-30'
    await submitForm(wrapper)

    expect(wrapper.emitted('create')).toBeUndefined()
    expect(wrapper.text()).toContain('截止日期格式不正确')
  })
})
