<script setup lang="ts">
/**
 * 分子组件：搜索框（v-model 双向 + 复用 BaseInput）
 */

import BaseInput from '@/components/atoms/BaseInput.vue'

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  (e: 'enter', value: string): void
}>()

function onEnter(value: string) {
  emit('enter', value)
}
</script>

<template>
  <div class="relative">
    <svg
      class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" stroke-linecap="round" />
    </svg>
    <BaseInput
      v-model="model"
      input-class="pl-9"
      placeholder="搜索任务…"
      clearable
      @enter="onEnter"
    />
  </div>
</template>
