import { computed, ref } from 'vue'

import { defineStore } from 'pinia'

import { useLocalStorage } from '@/composables/useLocalStorage'
import { filterTodos, sortTodos } from '@/composables/useTodoFilter'
import { todayKey } from '@/utils/dateFormatter'
import type {
  PendingDelete,
  PrioritySelection,
  Subtask,
  Todo,
  TodoFilter,
  TodoInput,
  TodoPriority,
} from '@/types/todo'
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

  // ---- 运行时状态（不持久化） ----
  /** 当前筛选视图（默认进行中；运行时，进入页面即重置为进行中） */
  const filter = ref<TodoFilter>('active')
  /** 已选中的优先级（多选；空数组 = 全部） */
  const priority = ref<PrioritySelection>([])
  /** 搜索关键字 */
  const keyword = ref('')
  /** 是否处于多选模式（批量操作；运行时） */
  const selectionMode = ref(false)
  /** 已选中的任务 id（多选；运行时） */
  const selectedIds = ref<string[]>([])
  /** 是否已手动排序（拖拽后关闭自动排序） */
  const manualOrder = ref(false)
  /** 撤销删除队列：软删除中的任务（1 分钟窗口，运行时，刷新即清空） */
  const pendingDeletes = ref<PendingDelete[]>([])
  /** id -> 真正删除定时器（运行时） */
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  // ---- getters ----
  /** 可见任务：排除软删除中（待撤销）的任务 */
  const visibleTodos = computed<Todo[]>(() => {
    const pendingIds = new Set(pendingDeletes.value.map((p) => p.todo.id))
    return todos.value.filter((t) => !pendingIds.has(t.id))
  })

  /** 过滤 + 搜索后的展示列表（按优先级高→低、截止日期早→晚排序；手动排序后不再重排） */
  const filteredTodos = computed<Todo[]>(() => {
    const base = filterTodos(visibleTodos.value, {
      filter: filter.value,
      keyword: keyword.value,
      priority: priority.value,
    })
    return manualOrder.value ? base : sortTodos(base)
  })

  /** 今日聚焦（My Day）：置顶 或 今日到期 的任务 */
  const myDayTodos = computed<Todo[]>(() => {
    const today = todayKey()
    return visibleTodos.value.filter((t) => t.pinned || (t.dueDate && t.dueDate === today))
  })

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

  /** 软删除：进入撤销队列，1 分钟后真正移除并落盘 */
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

  /** 撤销删除：取消定时器并移出队列（todos 未被改动，无需恢复数据） */
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

  /** 立即清理所有软删除（组件销毁等场景） */
  function flushPendingDeletes() {
    for (const id of [...timers.keys()]) commitDelete(id)
  }

  function setFilter(next: TodoFilter) {
    filter.value = next
    manualOrder.value = false
    clearSelection()
  }

  /**
   * 切换某个优先级是否选中（多选）。
   * 特殊规则：当高/中/低三者都被选中时，自动清空选择（即回到"全部"），
   * 使三个按钮均不被选中。
   */
  function togglePriority(p: TodoPriority) {
    const cur = priority.value
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
    priority.value = next.length === 3 ? [] : next
    manualOrder.value = false
  }

  /** 清空优先级选择（显示全部） */
  function clearPriority() {
    priority.value = []
    manualOrder.value = false
  }

  function setKeyword(next: string) {
    keyword.value = next
    manualOrder.value = false
  }

  // ---- 子任务 ----
  function toggleSubtask(todoId: string, subtaskId: string) {
    todos.value = todos.value.map((t) =>
      t.id === todoId
        ? {
            ...t,
            subtasks: t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, completed: !s.completed } : s,
            ),
          }
        : t,
    )
  }

  function addSubtask(todoId: string, title: string) {
    const text = title.trim()
    if (!text) return
    const subtask: Subtask = { id: createId(), title: text, completed: false }
    todos.value = todos.value.map((t) =>
      t.id === todoId ? { ...t, subtasks: [...t.subtasks, subtask] } : t,
    )
  }

  function removeSubtask(todoId: string, subtaskId: string) {
    todos.value = todos.value.map((t) =>
      t.id === todoId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t,
    )
  }

  // ---- 置顶（今日聚焦/My Day） ----
  function togglePinned(id: string) {
    todos.value = todos.value.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t))
  }

  // ---- 多选批量 ----
  function toggleSelectionMode() {
    selectionMode.value = !selectionMode.value
    clearSelection()
  }

  function toggleSelect(id: string) {
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((x) => x !== id)
      : [...selectedIds.value, id]
  }

  function clearSelection() {
    selectedIds.value = []
  }

  function getSelectedTodos(): Todo[] {
    return todos.value.filter((t) => selectedIds.value.includes(t.id))
  }

  /** 批量设置完成状态 */
  function bulkSetStatus(ids: string[], completed: boolean) {
    todos.value = todos.value.map((t) => {
      if (!ids.includes(t.id)) return t
      const target = completed ? 'completed' : 'active'
      if (t.status === target) return t
      return {
        ...t,
        status: target,
        completedAt: completed ? (t.completedAt ?? new Date().toISOString()) : undefined,
      }
    })
    clearSelection()
  }

  /** 批量删除（复用软删除 + 撤销） */
  function bulkRemove(ids: string[]) {
    ids.forEach((id) => removeTodo(id))
    clearSelection()
  }

  /** 批量修改优先级 */
  function bulkSetPriority(ids: string[], priority: TodoPriority) {
    todos.value = todos.value.map((t) => (ids.includes(t.id) ? { ...t, priority } : t))
    clearSelection()
  }

  // ---- 拖拽排序 ----
  /** 将 movedId 移动到 targetId 之前的位置（按底层数组顺序），并开启手动排序 */
  function moveTodo(movedId: string, targetId: string) {
    const list = [...todos.value]
    const movedIdx = list.findIndex((t) => t.id === movedId)
    const targetIdx = list.findIndex((t) => t.id === targetId)
    if (movedIdx < 0 || targetIdx < 0 || movedIdx === targetIdx) return
    const [moved] = list.splice(movedIdx, 1)
    list.splice(targetIdx, 0, moved)
    todos.value = list
    manualOrder.value = true
  }

  return {
    // 状态
    todos,
    filter,
    priority,
    keyword,
    pendingDeletes,
    latestPendingDelete,
    selectionMode,
    selectedIds,
    manualOrder,
    // getters
    visibleTodos,
    filteredTodos,
    myDayTodos,
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
    togglePriority,
    clearPriority,
    setKeyword,
    toggleSubtask,
    addSubtask,
    removeSubtask,
    togglePinned,
    toggleSelectionMode,
    toggleSelect,
    clearSelection,
    getSelectedTodos,
    bulkSetStatus,
    bulkRemove,
    bulkSetPriority,
    moveTodo,
  }
})
