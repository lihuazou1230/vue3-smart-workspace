<script setup lang="ts">
/**
 * 根组件：第二阶段任务管理界面
 * （后续阶段将替换为 layouts + router + pages 结构）
 */

import { computed } from 'vue'

import { useTodoStore } from '@/stores/todoStore'
import TodoForm from '@/components/organisms/TodoForm.vue'
import TodoList from '@/components/organisms/TodoList.vue'
import BaseBadge from '@/components/atoms/BaseBadge.vue'

const store = useTodoStore()

interface SummaryItem {
  label: string
  value: number
  tone: 'info' | 'warning' | 'success'
}

const summary = computed<SummaryItem[]>(() => [
  { label: '全部', value: store.totalCount, tone: 'info' },
  { label: '进行中', value: store.activeCount, tone: 'warning' },
  { label: '已完成', value: store.completedCount, tone: 'success' },
])

function handleCreate(payload: Parameters<typeof store.addTodo>[0]) {
  store.addTodo(payload)
}
</script>

<template>
  <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
        🧭 Vue 3 智能工作台
      </h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        第二阶段：任务管理闭环（CRUD + 筛选 + 持久化 + 撤销删除）
      </p>
    </header>

    <!-- 概览计数 -->
    <section class="mb-5 flex flex-wrap gap-2" aria-label="任务统计">
      <BaseBadge v-for="item in summary" :key="item.label" :tone="item.tone" size="sm">
        {{ item.label }} {{ item.value }}
      </BaseBadge>
    </section>

    <!-- 新建任务 -->
    <section class="glass mb-6 rounded-2xl p-4 shadow-sm">
      <TodoForm @create="handleCreate" />
    </section>

    <!-- 任务列表 -->
    <TodoList />
  </main>
</template>
