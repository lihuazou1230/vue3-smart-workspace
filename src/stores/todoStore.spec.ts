import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { useTodoStore, TODO_STORAGE_KEY } from './todoStore'
import { todayKey } from '@/utils/dateFormatter'

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
    store.setFilter('all')
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

  it('togglePriority 多选按优先级过滤，三者全选自动清空', () => {
    const store = useTodoStore()
    store.addTodo({ title: '高优', priority: 'high' })
    store.addTodo({ title: '低优', priority: 'low' })
    store.addTodo({ title: '中优', priority: 'medium' })
    expect(store.filteredTodos).toHaveLength(3)

    store.togglePriority('high')
    expect(store.priority).toEqual(['high'])
    expect(store.filteredTodos.map((t) => t.title)).toEqual(['高优'])

    // 多选：再加 low，同时命中 high/low
    store.togglePriority('low')
    expect(store.priority).toEqual(['high', 'low'])
    expect(store.filteredTodos).toHaveLength(2)

    // 再选中 medium -> 三者全选 -> 自动清空（全部）
    store.togglePriority('medium')
    expect(store.priority).toEqual([])
    expect(store.filteredTodos).toHaveLength(3)

    // 先选中再取消
    store.togglePriority('high')
    store.togglePriority('high')
    expect(store.priority).toEqual([])

    // clearPriority
    store.togglePriority('medium')
    store.clearPriority()
    expect(store.priority).toEqual([])
  })

  it('计数 getters 正确', () => {
    const store = useTodoStore()
    seedTodos()
    expect(store.totalCount).toBe(2)
    expect(store.activeCount).toBe(1)
    expect(store.completedCount).toBe(1)
  })

  it('filteredTodos 按优先级高→低、同优先级截止早→晚排序', () => {
    const store = useTodoStore()
    store.addTodo({ title: '低-无日期', priority: 'low' })
    store.addTodo({ title: '高-早', priority: 'high', dueDate: '2026-09-05' })
    store.addTodo({ title: '中-早', priority: 'medium', dueDate: '2026-09-10' })
    store.addTodo({ title: '高-晚', priority: 'high', dueDate: '2026-09-20' })
    const titles = store.filteredTodos.map((t) => t.title)
    expect(titles).toEqual(['高-早', '高-晚', '中-早', '低-无日期'])
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

  it('默认筛选为进行中（active）', () => {
    const store = useTodoStore()
    expect(store.filter).toBe('active')
  })
})

describe('todoStore · 阶段4扩展', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useRealTimers()
  })

  it('子任务：增删切换', () => {
    const store = useTodoStore()
    const t = store.addTodo({ title: '母任务', priority: 'medium' })
    store.addSubtask(t.id, '子1')
    store.addSubtask(t.id, '子2')
    expect(store.todos[0].subtasks).toHaveLength(2)
    const subId = store.todos[0].subtasks[0].id
    store.toggleSubtask(t.id, subId)
    expect(store.todos[0].subtasks[0].completed).toBe(true)
    store.removeSubtask(t.id, subId)
    expect(store.todos[0].subtasks).toHaveLength(1)
  })

  it('置顶：togglePinned 并进入今日聚焦', () => {
    const store = useTodoStore()
    const t = store.addTodo({ title: '普通', priority: 'medium' })
    store.togglePinned(t.id)
    expect(store.todos[0].pinned).toBe(true)
    expect(store.myDayTodos.map((x) => x.id)).toContain(t.id)
  })

  it('今日聚焦：今日到期任务进入', () => {
    const store = useTodoStore()
    const t = store.addTodo({ title: '今天到期', priority: 'medium', dueDate: todayKey() })
    expect(store.myDayTodos.map((x) => x.id)).toContain(t.id)
  })

  it('多选与批量：完成/恢复/改优先级/删除', () => {
    const store = useTodoStore()
    const a = store.addTodo({ title: 'a', priority: 'medium' })
    const b = store.addTodo({ title: 'b', priority: 'low' })

    store.toggleSelect(a.id)
    store.toggleSelect(b.id)
    expect(store.selectedIds).toHaveLength(2)

    store.bulkSetStatus(store.selectedIds, true)
    expect(store.todos.every((t) => t.status === 'completed')).toBe(true)
    expect(store.selectedIds).toHaveLength(0)

    store.toggleSelect(a.id)
    store.bulkSetPriority(store.selectedIds, 'high')
    expect(store.todos.find((t) => t.id === a.id)?.priority).toBe('high')

    store.toggleSelect(b.id)
    store.bulkRemove(store.selectedIds)
    expect(store.pendingDeletes).toHaveLength(1)
  })

  it('moveTodo 重排并开启手动排序（拖拽落到目标位置）', () => {
    const store = useTodoStore()
    const a = store.addTodo({ title: 'a', priority: 'low' })
    const b = store.addTodo({ title: 'b', priority: 'high' })
    store.moveTodo(a.id, b.id)
    // 原 [a, b]，把 a 拖到 b 的位置 -> [b, a]
    expect(store.todos.map((t) => t.id)).toEqual([b.id, a.id])
    expect(store.manualOrder).toBe(true)
  })
})
