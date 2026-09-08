import { computed, ref } from 'vue'

import { defineStore } from 'pinia'

import { useLocalStorage } from '@/composables/useLocalStorage'
import { filterTodos } from '@/composables/useTodoFilter'
import type { PendingDelete, Todo, TodoFilter, TodoInput } from '@/types/todo'
import { UNDO_DELETE_TIMEOUT } from '@/types/todo'

export const TODO_STORAGE_KEY = 'smart-workspace:todos'

function createId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const useTodoStore = defineStore('todo', () => {
  // ---- 持久化状态 ----
  /** 完整任务列表；软删除期间不落盘，真正删除（commitDelete）才写入 */
  const todos = useLocalStorage<Todo[]>(TODO_STORAGE_KEY, [])
  /** 当前筛选视图（持久化，刷新保留） */
  const filter = useLocalStorage<TodoFilter>(`${TODO_STORAGE_KEY}:filter`, 'all')

  // ---- 运行时状态（不持久化） ----
  /** 搜索关键字 */
  const keyword = ref('')
  /** 撤销删除队列：软删除中的任务（运行时，刷新即清空） */
  const pendingDeletes = ref<PendingDelete[]>([])
  /** id -> 真正删除定时器（运行时） */
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  // ---- getters ----
  /** 可见任务：排除软删除中（待撤销）的任务 */
  const visibleTodos = computed<Todo[]>(() => {
    const pendingIds = new Set(pendingDeletes.value.map((p) => p.todo.id))
    return todos.value.filter((t) => !pendingIds.has(t.id))
  })

  /** 过滤 + 搜索后的展示列表 */
  const filteredTodos = computed<Todo[]>(() =>
    filterTodos(visibleTodos.value, { filter: filter.value, keyword: keyword.value }),
  )

  const totalCount = computed(() => visibleTodos.value.length)
  const activeCount = computed(() => visibleTodos.value.filter((t) => t.status === 'active').length)
  const completedCount = computed(
    () => visibleTodos.value.filter((t) => t.status === 'completed').length,
  )
  /** 撤销条展示用：最近的待撤销任务 */
  const latestPendingDelete = computed<PendingDelete | null>(
    () => pendingDeletes.value[pendingDeletes.value.length - 1] ?? null,
  )

  // ---- actions ----
  function addTodo(input: TodoInput): Todo {
    const todo: Todo = {
      id: createId(),
      title: input.title.trim(),
      status: 'active',
      priority: input.priority,
      dueDate: input.dueDate,
      createdAt: new Date().toISOString(),
      pinned: false,
      subtasks: [],
    }
    todos.value = [...todos.value, todo]
    return todo
  }

  function updateTodo(id: string, patch: Partial<Pick<Todo, 'title' | 'priority' | 'dueDate'>>) {
    todos.value = todos.value.map((t) => (t.id === id ? { ...t, ...patch } : t))
  }

  function toggleComplete(id: string) {
    todos.value = todos.value.map((t) =>
      t.id === id
        ? {
            ...t,
            status: t.status === 'active' ? 'completed' : 'active',
            completedAt: t.status === 'active' ? new Date().toISOString() : undefined,
          }
        : t,
    )
  }

  /** 软删除：进入撤销队列，5 秒后真正移除并落盘 */
  function removeTodo(id: string) {
    if (pendingDeletes.value.some((p) => p.todo.id === id)) return
    const todo = todos.value.find((t) => t.id === id)
    if (!todo) return

    pendingDeletes.value = [
      ...pendingDeletes.value,
      { todo, expiresAt: Date.now() + UNDO_DELETE_TIMEOUT },
    ]
    const timer = setTimeout(() => commitDelete(id), UNDO_DELETE_TIMEOUT)
    timers.set(id, timer)
  }

  /** 撤销删除：取消定时器并移出队列（todos 从未被改动，无需恢复数据） */
  function undoDelete(id: string) {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    pendingDeletes.value = pendingDeletes.value.filter((p) => p.todo.id !== id)
  }

  /** 真正删除：从 todos 移除（触发持久化），清理队列与定时器 */
  function commitDelete(id: string) {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    pendingDeletes.value = pendingDeletes.value.filter((p) => p.todo.id !== id)
    todos.value = todos.value.filter((t) => t.id !== id)
  }

  /** 立即撤销/清理所有软删除（组件销毁等场景可调用） */
  function flushPendingDeletes() {
    for (const id of [...timers.keys()]) commitDelete(id)
  }

  function setFilter(next: TodoFilter) {
    filter.value = next
  }

  function setKeyword(next: string) {
    keyword.value = next
  }

  return {
    // 状态
    todos,
    filter,
    keyword,
    pendingDeletes,
    latestPendingDelete,
    // getters
    visibleTodos,
    filteredTodos,
    totalCount,
    activeCount,
    completedCount,
    // actions
    addTodo,
    updateTodo,
    toggleComplete,
    removeTodo,
    undoDelete,
    commitDelete,
    flushPendingDeletes,
    setFilter,
    setKeyword,
  }
})
