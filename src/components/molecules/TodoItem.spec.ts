import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import type { Todo } from '@/types/todo'
import { addDays, todayKey } from '@/utils/dateFormatter'
import TodoItem from './TodoItem.vue'

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

describe('TodoItem', () => {
  const today = todayKey()

  it('渲染标题与优先级，勾选发射 toggle', async () => {
    const todo = makeTodo({ id: '1', title: '写周报', priority: 'high' })
    const wrapper = mount(TodoItem, { props: { todo, showDue: true } })
    expect(wrapper.text()).toContain('写周报')
    expect(wrapper.text()).toContain('高优先级')

    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['1'])
  })

  it('完成态显示删除线文案', () => {
    const todo = makeTodo({ id: '1', title: '健身', status: 'completed' })
    const wrapper = mount(TodoItem, { props: { todo } })
    expect(wrapper.find('p').classes()).toContain('line-through')
  })

  it('逾期任务标红并显示已逾期徽章', () => {
    const yesterday = addDays(today, -1)
    const todo = makeTodo({ id: '1', title: '补卡', dueDate: yesterday })
    const wrapper = mount(TodoItem, { props: { todo, showDue: true } })
    const li = wrapper.find('li')
    expect(li.classes()).toContain('border-rose-300')
    expect(wrapper.text()).toContain('已逾期')
  })

  it('今日到期显示今日徽章', () => {
    const todo = makeTodo({ id: '1', title: '开会', dueDate: today })
    const wrapper = mount(TodoItem, { props: { todo, showDue: true } })
    expect(wrapper.text()).toContain('今日到期')
  })

  it('未展示截止日期时（showDue=false）不渲染日期', () => {
    const todo = makeTodo({ id: '1', title: '看文档', dueDate: today })
    const wrapper = mount(TodoItem, { props: { todo } })
    expect(wrapper.text()).not.toContain('今日到期')
  })

  it('点击删除按钮发射 remove', async () => {
    const todo = makeTodo({ id: '1', title: '写周报' })
    const wrapper = mount(TodoItem, { props: { todo } })
    await wrapper.find('button[aria-label="删除任务"]').trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual(['1'])
  })
})
