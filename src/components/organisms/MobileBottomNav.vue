<script setup lang="ts">
/**
 * 组织体组件：移动端底部导航（md 以下显示）
 * - 首页：回到顶部
 * - 设置：打开外观设置抽屉
 */

const emit = defineEmits<{ (e: 'open-settings'): void }>()

function scrollTop() {
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-slate-200 bg-white/90 backdrop-blur-md md:hidden dark:border-slate-700 dark:bg-slate-900/90"
    aria-label="底部导航"
  >
    <button
      type="button"
      class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs text-slate-500 dark:text-slate-400"
      @click="scrollTop"
    >
      <span class="text-base leading-none">🏠</span>
      <span>首页</span>
    </button>
    <button
      type="button"
      class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs text-slate-500 dark:text-slate-400"
      @click="emit('open-settings')"
    >
      <span class="text-base leading-none">⚙️</span>
      <span>设置</span>
    </button>
  </nav>
</template>
