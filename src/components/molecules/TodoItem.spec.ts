import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
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

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染标题与优先级，勾选（未完成→完成）立即发射 toggle 且不左滑', async () => {
    const todo = makeTodo({ id: '1', title: '写周报', priority: 'high' })
    const wrapper = mount(TodoItem, { props: { todo, showDue: true } })
    expect(wrapper.text()).toContain('写周报')
    expect(wrapper.text()).toContain('高优先级')

    await wrapper.find('input[type="checkbox"]').setValue(true)
    // 全部视图语义：仅礼花、立即 emit、无左滑
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['1'])
    expect(wrapper.find('li').classes()).not.toContain('anim-slide-left')
    expect(wrapper.find('.particle').exists()).toBe(true)
  })

  it('completeSlide=true 时（进行中视图）左滑后发射 toggle', async () => {
    const todo = makeTodo({ id: '1', title: '写周报', priority: 'high' })
    const wrapper = mount(TodoItem, { props: { todo, completeSlide: true } })

    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.find('li').classes()).toContain('anim-slide-left')
    expect(wrapper.emitted('toggle')).toBeUndefined()

    vi.advanceTimersByTime(600)
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['1'])
  })

  it('已完成任务取消勾选，直接通知 toggle（无左滑动画）', async () => {
    const todo = makeTodo({ id: '1', title: '健身', status: 'completed' })
    const wrapper = mount(TodoItem, { props: { todo } })
    await wrapper.find('input[type="checkbox"]').setValue(false)
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

  it('畸形截止日期（6 位年份）不渲染日期徽章、不标红', () => {
    const todo = makeTodo({ id: '1', title: '异常日期', dueDate: '232233-10-01' })
    const wrapper = mount(TodoItem, { props: { todo, showDue: true } })
    expect(wrapper.text()).not.toContain('今日到期')
    expect(wrapper.text()).not.toContain('已逾期')
    expect(wrapper.text()).not.toContain('232233')
  })

  it('点击删除按钮先右滑后发射 remove', async () => {
    const todo = makeTodo({ id: '1', title: '写周报' })
    const wrapper = mount(TodoItem, { props: { todo } })
    await wrapper.find('button[aria-label="删除任务"]').trigger('click')
    expect(wrapper.find('li').classes()).toContain('anim-slide-right')
    expect(wrapper.emitted('remove')).toBeUndefined()

    vi.advanceTimersByTime(400)
    expect(wrapper.emitted('remove')?.[0]).toEqual(['1'])
  })

  it('撤销恢复（revealFromRight）播放从右滑入动画', async () => {
    const todo = makeTodo({ id: '1', title: '恢复的任务' })
    const wrapper = mount(TodoItem, { props: { todo, revealFromRight: true } })
    await nextTick()
    expect(wrapper.find('li').classes()).toContain('anim-reveal-right')
  })

  it('新建任务（enterFromLeft）播放从左滑入动画', async () => {
    const todo = makeTodo({ id: '1', title: '新建的任务' })
    const wrapper = mount(TodoItem, { props: { todo, enterFromLeft: true } })
    await nextTick()
    expect(wrapper.find('li').classes()).toContain('anim-enter-left')
  })
})
