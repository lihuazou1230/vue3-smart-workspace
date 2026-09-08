<script setup lang="ts">
/**
 * 有机体组件：新建任务表单
 * - 标题 + 优先级 + 截止日期（复用 Base 原子组件与 validation）
 * - 校验通过发射 create(TodoInput)，随后清空标题与日期
 */

import { ref } from 'vue'

import type { TodoInput, TodoPriority } from '@/types/todo'
import { DEFAULT_PRIORITY } from '@/types/todo'
import { isValidDateKey, validateTodoTitle } from '@/utils/validation'
import { priorityLabel } from '@/utils/priorityHelper'
import { addDays, addMonths, todayKey } from '@/utils/dateFormatter'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseInput from '@/components/atoms/BaseInput.vue'

const emit = defineEmits<{
  (e: 'create', payload: TodoInput): void
}>()

const title = ref('')
const priority = ref<TodoPriority>(DEFAULT_PRIORITY)
/** 截止日期初始为真实当天 */
const dueDate = ref(todayKey())
const error = ref('')

const priorityOptions: TodoPriority[] = ['low', 'medium', 'high']

function submit() {
  const check = validateTodoTitle(title.value)
  if (!check.valid) {
    error.value = check.message ?? '任务标题无效'
    return
  }
  // 截止日期若非法（如年份超长/日期不存在），拦截并提示，避免 6 位年份等畸形值进入数据流
  if (dueDate.value && !isValidDateKey(dueDate.value)) {
    error.value = '截止日期格式不正确'
    return
  }
  error.value = ''
  emit('create', {
    title: title.value.trim(),
    priority: priority.value,
    dueDate: dueDate.value || undefined,
  })
  title.value = ''
  dueDate.value = todayKey()
  priority.value = DEFAULT_PRIORITY
}

function onTitleEnter() {
  submit()
}

/** 快捷调整截止日期：在现有日期上加 N 天/周/月 */
function shiftDue(days: number, months = 0) {
  const base = dueDate.value || todayKey()
  dueDate.value = days !== 0 ? addDays(base, days) : addMonths(base, months)
}

// 暴露内部状态便于单元测试驱动非法日期等场景
defineExpose({ title, priority, dueDate, error, shiftDue })
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

      <div class="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>截止</span>
        <span class="flex items-center gap-1">
          <BaseButton size="sm" variant="secondary" @click="shiftDue(1)">1天</BaseButton>
          <BaseButton size="sm" variant="secondary" @click="shiftDue(7)">1周</BaseButton>
          <BaseButton size="sm" variant="secondary" @click="shiftDue(0, 1)">1月</BaseButton>
        </span>
        <el-date-picker
          v-model="dueDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          placeholder="选择日期"
          clearable
          class="!w-40"
        />
      </div>
    </div>
  </form>
</template>
