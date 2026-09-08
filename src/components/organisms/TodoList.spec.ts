import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

import { useTodoStore } from '@/stores/todoStore'
import TodoList from './TodoList.vue'

function mountWithStore() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useTodoStore()
  const wrapper = mount(TodoList, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

describe('TodoList', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染 store 中的任务', async () => {
    const { wrapper, store } = mountWithStore()
    store.addTodo({ title: '任务甲', priority: 'high' })
    store.addTodo({ title: '任务乙', priority: 'low' })
    await nextTick()

    const liText = wrapper
      .findAll('li')
      .map((li) => li.text())
      .join(' | ')
    expect(liText).toContain('任务甲')
    expect(liText).toContain('任务乙')
  })

  it('新建任务从左滑入（anim-enter-left）', async () => {
    const { wrapper, store } = mountWithStore()
    store.addTodo({ title: '新任务', priority: 'high' })
    await nextTick()
    const li = wrapper.find('li')
    expect(li.classes()).toContain('anim-enter-left')
  })

  it('空状态提示', () => {
    const { wrapper } = mountWithStore()
    expect(wrapper.text()).toContain('暂无任务')
  })

  it('切换筛选 tab 过滤列表', async () => {
    const { wrapper, store } = mountWithStore()
    store.addTodo({ title: '未完成甲', priority: 'medium' })
    const b = store.addTodo({ title: '已完成乙', priority: 'medium' })
    store.toggleComplete(b.id)
    await nextTick()

    // 点击“已完成”
    const completedBtn = wrapper.findAll('button').find((btn) => btn.text() === '已完成')
    expect(completedBtn).toBeTruthy()
    await completedBtn!.trigger('click')
    await nextTick()

    const liText = wrapper
      .findAll('li')
      .map((li) => li.text())
      .join(' | ')
    expect(liText).toContain('已完成乙')
    expect(liText).not.toContain('未完成甲')
  })

  it('搜索关键字过滤', async () => {
    const { wrapper, store } = mountWithStore()
    store.addTodo({ title: '写周报', priority: 'medium' })
    store.addTodo({ title: '健身', priority: 'low' })
    await nextTick()
    await wrapper.find('input[placeholder*="搜索任务"]').setValue('健身')
    await nextTick()

    const liText = wrapper
      .findAll('li')
      .map((li) => li.text())
      .join(' | ')
    expect(liText).toContain('健身')
    expect(liText).not.toContain('写周报')
  })

  it('点击优先级按钮过滤任务', async () => {
    const { wrapper, store } = mountWithStore()
    store.addTodo({ title: '高优甲', priority: 'high' })
    store.addTodo({ title: '低优乙', priority: 'low' })
    await nextTick()

    const high = wrapper.findAll('button').find((btn) => btn.text() === '高')
    expect(high).toBeTruthy()
    await high!.trigger('click')
    await nextTick()

    const liText = wrapper
      .findAll('li')
      .map((li) => li.text())
      .join(' | ')
    expect(liText).toContain('高优甲')
    expect(liText).not.toContain('低优乙')
  })

  it('勾选任务调用 toggleComplete', async () => {
    const { wrapper, store } = mountWithStore()
    const a = store.addTodo({ title: '任务', priority: 'medium' })
    await nextTick()
    await wrapper.find('li input[type="checkbox"]').setValue(true)
    vi.advanceTimersByTime(800)
    await nextTick()
    expect(store.todos.find((t) => t.id === a.id)?.status).toBe('completed')
  })

  it('删除后出现撤销 Toast，点击撤销恢复', async () => {
    const { wrapper, store } = mountWithStore()
    const a = store.addTodo({ title: '待删除', priority: 'medium' })
    await nextTick()

    await wrapper.find('li button[aria-label="删除任务"]').trigger('click')
    vi.advanceTimersByTime(700)
    await nextTick()

    // Toast 出现
    expect(wrapper.text()).toContain('已删除「待删除」')
    expect(store.pendingDeletes).toHaveLength(1)

    // 点击撤销
    const undoBtn = wrapper.findAll('button').find((btn) => btn.text() === '撤销')
    expect(undoBtn).toBeTruthy()
    await undoBtn!.trigger('click')
    await nextTick()

    expect(store.pendingDeletes).toHaveLength(0)
    expect(store.visibleTodos.some((t) => t.id === a.id)).toBe(true)
    expect(wrapper.text()).not.toContain('已删除')
  })

  it('删除软隐藏、撤销条出现并可恢复（1 分钟窗口）', async () => {
    const { wrapper, store } = mountWithStore()
    const a = store.addTodo({ title: '将被删除', priority: 'medium' })
    await nextTick()
    store.removeTodo(a.id)
    await nextTick()

    // 软删除：可见列表隐藏，但底层仍保留
    expect(store.visibleTodos).toHaveLength(0)
    expect(store.todos.some((t) => t.id === a.id)).toBe(true)
    // 撤销条仍显示
    expect(wrapper.text()).toContain('已删除「将被删除」')

    // 撤销恢复
    store.undoDelete(a.id)
    await nextTick()
    expect(store.visibleTodos.some((t) => t.id === a.id)).toBe(true)
    expect(wrapper.text()).not.toContain('已删除')
  })
})
