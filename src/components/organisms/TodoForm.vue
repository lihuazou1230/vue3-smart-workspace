<script setup lang="ts">
/**
 * 有机体组件：新建任务表单
 * - 标题 + 优先级 + 截止日期（复用 Base 原子组件与 validation）
 * - 校验通过发射 create(TodoInput)，随后清空标题与日期
 */

import { ref } from 'vue'

import type { TodoInput, TodoPriority } from '@/types/todo'
import { DEFAULT_PRIORITY } from '@/types/todo'
import { validateTodoTitle } from '@/utils/validation'
import { priorityLabel } from '@/utils/priorityHelper'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseInput from '@/components/atoms/BaseInput.vue'

const emit = defineEmits<{
  (e: 'create', payload: TodoInput): void
}>()

const title = ref('')
const priority = ref<TodoPriority>(DEFAULT_PRIORITY)
const dueDate = ref('')
const error = ref('')

const priorityOptions: TodoPriority[] = ['low', 'medium', 'high']

function submit() {
  const check = validateTodoTitle(title.value)
  if (!check.valid) {
    error.value = check.message ?? '任务标题无效'
    return
  }
  error.value = ''
  emit('create', {
    title: title.value.trim(),
    priority: priority.value,
    dueDate: dueDate.value || undefined,
  })
  title.value = ''
  dueDate.value = ''
  priority.value = DEFAULT_PRIORITY
}

function onTitleEnter() {
  submit()
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="submit">
    <div class="flex gap-2">
      <BaseInput
        v-model="title"
        placeholder="添加新任务，回车即可…"
        input-class="flex-1"
        class="flex-1"
        @enter="onTitleEnter"
      />
      <BaseButton native-type="submit">添加</BaseButton>
    </div>

    <p v-if="error" class="text-xs text-rose-500" role="alert">{{ error }}</p>

    <div class="flex flex-wrap items-center gap-4">
      <fieldset class="flex items-center gap-1">
        <legend class="sr-only">优先级</legend>
        <BaseButton
          v-for="p in priorityOptions"
          :key="p"
          size="sm"
          :variant="priority === p ? 'primary' : 'secondary'"
          type="button"
          @click="priority = p"
        >
          {{ priorityLabel(p) }}
        </BaseButton>
      </fieldset>

      <label class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        截止
        <BaseInput v-model="dueDate" type="date" input-class="w-36" />
      </label>
    </div>
  </form>
</template>
