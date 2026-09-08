<script setup lang="ts">
/**
 * 分子组件：单个任务行
 * - 勾选切换完成状态
 * - 逾期标红 + 今日到期/截止日期徽章（dateFormatter）
 * - 删除发射 remove，由父级（TodoList）处理软删除与撤销
 */

import { computed } from 'vue'

import type { Todo } from '@/types/todo'
import { formatDueLabel, isOverdue, isToday } from '@/utils/dateFormatter'
import { isValidDateKey } from '@/utils/validation'
import { priorityLabel, priorityTone } from '@/utils/priorityHelper'
import BaseBadge from '@/components/atoms/BaseBadge.vue'
import BaseCheckbox from '@/components/atoms/BaseCheckbox.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'

const props = defineProps<{
  todo: Todo
  /** 是否展示截止日期徽章与逾期标红 */
  showDue?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle', id: string): void
  (e: 'remove', id: string): void
}>()

const isDone = computed(() => props.todo.status === 'completed')
/** 截止日期是否存在且格式合法（拦截 6 位年份等畸形值） */
const hasValidDue = computed(
  () => props.showDue === true && !!props.todo.dueDate && isValidDateKey(props.todo.dueDate),
)
const overdue = computed(() => hasValidDue.value && !isDone.value && isOverdue(props.todo.dueDate!))
const dueToday = computed(() => hasValidDue.value && !isDone.value && isToday(props.todo.dueDate!))
const dueLabel = computed(() => (hasValidDue.value ? formatDueLabel(props.todo.dueDate!) : ''))

function onToggle() {
  emit('toggle', props.todo.id)
}

function onRemove() {
  emit('remove', props.todo.id)
}
</script>

<template>
  <li
    class="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-600"
    :class="overdue ? 'border-rose-300 dark:border-rose-700' : ''"
  >
    <BaseCheckbox :model-value="isDone" aria-label="切换完成状态" @change="onToggle" />

    <div class="min-w-0 flex-1">
      <p
        class="truncate text-sm font-medium"
        :class="[
          isDone
            ? 'text-slate-400 line-through dark:text-slate-500'
            : 'text-slate-800 dark:text-slate-100',
          overdue ? 'text-rose-600 dark:text-rose-400' : '',
        ]"
      >
        {{ todo.title }}
      </p>
      <p v-if="hasValidDue" class="mt-0.5 flex items-center gap-1 text-xs">
        <BaseBadge :tone="overdue ? 'danger' : dueToday ? 'warning' : 'info'" size="xs">
          <template v-if="dueToday">📌 今日到期</template>
          <template v-else-if="overdue">⏰ 已逾期（{{ dueLabel }}）</template>
          <template v-else>{{ dueLabel }}</template>
        </BaseBadge>
      </p>
    </div>

    <BaseBadge :tone="priorityTone(todo.priority)" size="xs">
      {{ priorityLabel(todo.priority) }}优先级
    </BaseBadge>

    <BaseButton
      variant="ghost"
      size="sm"
      class="opacity-0 transition-opacity group-hover:opacity-100"
      aria-label="删除任务"
      @click="onRemove"
    >
      <svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path
          d="M6 1.75h4a.25.25 0 0 1 .25.25v1h-4.5V2a.25.25 0 0 1 .25-.25zM4.25 3v-.75A1.75 1.75 0 0 1 6 .5h4a1.75 1.75 0 0 1 1.75 1.75V3h2.75a.75.75 0 0 1 0 1.5h-.583L13.4 13a1.75 1.75 0 0 1-1.744 1.6H4.344A1.75 1.75 0 0 1 2.6 13L2.333 4.5h-.583a.75.75 0 0 1 0-1.5h2.5zm.836 1.5-.292 8.5a.25.25 0 0 0 .25.266h6.312a.25.25 0 0 0 .25-.266l-.292-8.5H5.086z"
        />
      </svg>
    </BaseButton>
  </li>
</template>
