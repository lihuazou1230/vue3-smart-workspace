<script setup lang="ts">
/**
 * 原子组件：基础复选框（v-model:boolean + 文案）
 */

const model = defineModel<boolean>({ default: false })

withDefaults(
  defineProps<{
    label?: string
    disabled?: boolean
  }>(),
  {
    label: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'change', value: boolean): void
}>()

function onChange(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  emit('change', checked)
}
</script>

<template>
  <label
    class="inline-flex cursor-pointer select-none items-center gap-2"
    :class="disabled ? 'cursor-not-allowed opacity-60' : ''"
  >
    <input
      v-model="model"
      type="checkbox"
      :disabled="disabled"
      class="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 focus:ring-indigo-500"
      @change="onChange"
    />
    <span v-if="label" class="text-sm text-slate-700 dark:text-slate-300">{{ label }}</span>
  </label>
</template>
