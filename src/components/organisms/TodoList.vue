<script setup lang="ts">
/**
 * 有机体组件：任务列表（连接 todoStore）
 * - 筛选 tab（全部/进行中/已完成/今日）+ 搜索
 * - 空状态 / 计数
 * - 5 秒撤销删除 Toast（点击可恢复）
 */

import { computed, onUnmounted, ref } from 'vue'

import type { TodoFilter } from '@/types/todo'
import { useTodoStore } from '@/stores/todoStore'
import SearchBar from '@/components/molecules/SearchBar.vue'
import TodoItem from '@/components/molecules/TodoItem.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'

const store = useTodoStore()

const FILTER_TABS: Array<{ key: TodoFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'today', label: '今日' },
]

const filterLabel = computed(() => FILTER_TABS.find((t) => t.key === store.filter)?.label ?? '全部')

/** 撤销条倒计时展示（每秒刷新剩余秒数，纯 UI） */
const remainingSeconds = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null

function startTicker(expiresAt: number) {
  stopTicker()
  const update = () => {
    remainingSeconds.value = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  }
  update()
  ticker = setInterval(update, 200)
}

function stopTicker() {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

// 撤销条出现时启动倒计时展示
function onPendingChange() {
  if (store.latestPendingDelete) {
    startTicker(store.latestPendingDelete.expiresAt)
  } else {
    stopTicker()
  }
}

onUnmounted(stopTicker)

function toggle(id: string) {
  store.toggleComplete(id)
}

function remove(id: string) {
  store.removeTodo(id)
  onPendingChange()
}

function undo() {
  const p = store.latestPendingDelete
  if (p) store.undoDelete(p.todo.id)
  onPendingChange()
}
</script>

<template>
  <section class="space-y-3">
    <!-- 工具栏：筛选 + 搜索 -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex gap-1" role="tablist" aria-label="任务筛选">
        <BaseButton
          v-for="tab in FILTER_TABS"
          :key="tab.key"
          size="sm"
          :variant="store.filter === tab.key ? 'primary' : 'secondary'"
          @click="store.setFilter(tab.key)"
        >
          {{ tab.label }}
        </BaseButton>
      </div>
      <div class="w-56">
        <SearchBar v-model="store.keyword" />
      </div>
    </div>

    <!-- 撤销删除 Toast -->
    <div
      v-if="store.latestPendingDelete"
      class="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      role="status"
    >
      <span class="flex-1">
        已删除「{{ store.latestPendingDelete.todo.title }}」
        <span class="text-xs opacity-70">（{{ remainingSeconds }}s 后可撤销）</span>
      </span>
      <BaseButton size="sm" variant="secondary" @click="undo">撤销</BaseButton>
    </div>

    <!-- 计数 -->
    <p class="text-xs text-slate-400 dark:text-slate-500">
      {{ filterLabel }} · {{ store.filteredTodos.length }} 项
    </p>

    <!-- 列表 -->
    <ul v-if="store.filteredTodos.length > 0" class="space-y-2">
      <TodoItem
        v-for="todo in store.filteredTodos"
        :key="todo.id"
        :todo="todo"
        show-due
        @toggle="toggle"
        @remove="remove"
      />
    </ul>

    <!-- 空状态 -->
    <div
      v-else
      class="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500"
    >
      🎉 暂无任务，添加一个开始吧
    </div>
  </section>
</template>
