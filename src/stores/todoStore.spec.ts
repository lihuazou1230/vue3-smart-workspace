import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { useTodoStore, TODO_STORAGE_KEY } from './todoStore'

function seedTodos() {
  const store = useTodoStore()
  const a = store.addTodo({ title: '写周报', priority: 'high', dueDate: '2026-09-10' })
  const b = store.addTodo({ title: '健身', priority: 'low' })
  store.toggleComplete(b.id)
  return { store, a, b }
}

describe('todoStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useRealTimers()
  })

  it('addTodo 生成默认字段', () => {
    const store = useTodoStore()
    const todo = store.addTodo({ title: '  写周报  ', priority: 'high' })
    expect(todo.title).toBe('写周报')
    expect(todo.status).toBe('active')
    expect(todo.pinned).toBe(false)
    expect(todo.subtasks).toEqual([])
    expect(todo.id).toBeTruthy()
    expect(store.totalCount).toBe(1)
  })

  it('updateTodo 合并部分字段', () => {
    const store = useTodoStore()
    const { a } = seedTodos()
    store.updateTodo(a.id, { title: '写月度周报', priority: 'low' })
    const updated = store.todos.find((t) => t.id === a.id)
    expect(updated?.title).toBe('写月度周报')
    expect(updated?.priority).toBe('low')
    expect(updated?.dueDate).toBe('2026-09-10')
  })

  it('toggleComplete 切换状态并记录/清除完成时间', () => {
    const store = useTodoStore()
    const { a } = seedTodos()
    store.toggleComplete(a.id)
    expect(store.todos.find((t) => t.id === a.id)?.status).toBe('completed')
    expect(store.todos.find((t) => t.id === a.id)?.completedAt).toBeTruthy()
    store.toggleComplete(a.id)
    expect(store.todos.find((t) => t.id === a.id)?.status).toBe('active')
    expect(store.todos.find((t) => t.id === a.id)?.completedAt).toBeUndefined()
  })

  it('filteredTodos 支持状态过滤', () => {
    const store = useTodoStore()
    seedTodos()
    expect(store.filteredTodos).toHaveLength(2)
    store.setFilter('completed')
    expect(store.filteredTodos).toHaveLength(1)
    expect(store.filteredTodos[0].title).toBe('健身')
  })

  it('filteredTodos 支持关键字搜索', () => {
    const store = useTodoStore()
    seedTodos()
    store.setKeyword(' 周报 ')
    expect(store.filteredTodos).toHaveLength(1)
    expect(store.filteredTodos[0].title).toBe('写周报')
  })

  it('计数 getters 正确', () => {
    const store = useTodoStore()
    seedTodos()
    expect(store.totalCount).toBe(2)
    expect(store.activeCount).toBe(1)
    expect(store.completedCount).toBe(1)
  })

  it('removeTodo 软删除：进入撤销队列，立即可撤销', () => {
    const store = useTodoStore()
    const { a, b } = seedTodos()
    store.removeTodo(a.id)
    // 进入撤销队列，可见列表已隐藏
    expect(store.pendingDeletes).toHaveLength(1)
    expect(store.latestPendingDelete?.todo.id).toBe(a.id)
    expect(store.visibleTodos.map((t) => t.id)).toEqual([b.id])
    // 软删除期间不落盘：todos 底层仍保留
    expect(store.todos.some((t) => t.id === a.id)).toBe(true)

    // 撤销恢复
    store.undoDelete(a.id)
    expect(store.pendingDeletes).toHaveLength(0)
    expect(store.visibleTodos.map((t) => t.id)).toContain(a.id)
  })

  it('undoDelete 后不再自动超时删除', async () => {
    vi.useFakeTimers()
    const store = useTodoStore()
    const { a } = seedTodos()
    store.removeTodo(a.id)

    // 撤销，取消定时器
    store.undoDelete(a.id)
    vi.advanceTimersByTime(60_000 + 100)
    expect(store.todos.some((t) => t.id === a.id)).toBe(true)
    expect(store.pendingDeletes).toHaveLength(0)
  })

  it('removeTodo 超时 60 秒后真正删除并落盘', async () => {
    vi.useFakeTimers()
    const store = useTodoStore()
    const { a, b } = seedTodos()
    store.removeTodo(a.id)
    await nextTick()

    vi.advanceTimersByTime(59_999)
    expect(store.todos.some((t) => t.id === a.id)).toBe(true)

    vi.advanceTimersByTime(1)
    expect(store.todos.some((t) => t.id === a.id)).toBe(false)
    expect(store.pendingDeletes).toHaveLength(0)
    expect(store.visibleTodos.map((t) => t.id)).toEqual([b.id])

    // 落盘后 localStorage 不含该任务
    await nextTick()
    const raw = localStorage.getItem(TODO_STORAGE_KEY)
    const persisted = JSON.parse(raw!) as { id: string }[]
    expect(persisted.some((t) => t.id === a.id)).toBe(false)
  })

  it('持久化：软删除不落盘，任务仍在 localStorage', async () => {
    const store = useTodoStore()
    const { a } = seedTodos()
    await nextTick()

    store.removeTodo(a.id)
    await nextTick()
    // 软删除窗口内任务仍保留在 localStorage
    const persisted = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY)!) as { id: string }[]
    expect(persisted).toHaveLength(2)
    expect(persisted.some((t) => t.id === a.id)).toBe(true)
  })

  it('重复 removeTodo 同一任务幂等', () => {
    const store = useTodoStore()
    const { a } = seedTodos()
    store.removeTodo(a.id)
    store.removeTodo(a.id)
    expect(store.pendingDeletes).toHaveLength(1)
  })

  it('filter 持久化在下次创建 store 时恢复', async () => {
    const store = useTodoStore()
    seedTodos()
    store.setFilter('active')
    await nextTick()

    const store2 = useTodoStore()
    expect(store2.filter).toBe('active')
  })
})
