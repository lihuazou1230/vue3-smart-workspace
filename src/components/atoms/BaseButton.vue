<script setup lang="ts">
/**
 * 原子组件：基础按钮（纯展示，发射 click）
 * 样式走 Tailwind；variant 映射语义色，配合 CSS 变量主题（后续阶段接入主题色）
 */

const props = withDefaults(
  defineProps<{
    /** 视觉类型 */
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    /** 尺寸 */
    size?: 'sm' | 'md'
    disabled?: boolean
    /** 原生按钮类型 */
    nativeType?: 'button' | 'submit' | 'reset'
    /** 撑满容器 */
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    nativeType: 'button',
    block: false,
  },
)

const emit = defineEmits<{
  (e: 'click', ev: MouseEvent): void
}>()

const variantClass: Record<NonNullable<typeof props.variant>, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-300',
  secondary:
    'bg-slate-200 text-slate-700 hover:bg-slate-300 active:bg-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 disabled:bg-rose-300',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-200/70 active:bg-slate-300/70 dark:text-slate-300 dark:hover:bg-slate-700/60',
}

const sizeClass: Record<NonNullable<typeof props.size>, string> = {
  sm: 'px-2.5 py-1 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
}

function onClick(ev: MouseEvent) {
  if (props.disabled) return
  emit('click', ev)
}
</script>

<template>
  <button
    :type="nativeType"
    :disabled="disabled"
    class="inline-flex select-none items-center justify-center gap-1 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
    :class="[variantClass[variant], sizeClass[size], block ? 'w-full' : '']"
    @click="onClick"
  >
    <slot />
  </button>
</template>
