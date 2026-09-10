<script setup lang="ts">
/**
 * 原子组件：徽章（纯展示）
 */

withDefaults(
  defineProps<{
    /** 语义色 */
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
    size?: 'xs' | 'sm'
  }>(),
  {
    tone: 'info',
    size: 'sm',
  },
)

const toneClass: Record<string, string> = {
  // primary 跟随主题色（CSS 变量驱动，换主题色即时生效）
  primary: 'bg-[var(--el-color-primary)] text-white',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  info: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

const sizeClass: Record<string, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] rounded-md',
  sm: 'px-2 py-0.5 text-xs rounded-full',
}
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap font-medium"
    :class="[toneClass[tone], sizeClass[size]]"
  >
    <slot />
  </span>
</template>
