<script setup lang="ts">
/**
 * 有机体组件：移动端底部导航（lg 以下显示）
 *
 * 第五阶段：从「首页/设置抽屉」改为 4 个路由 Tab，
 * 与桌面端侧边栏的导航项一一对应（同一份 NAV_ITEMS 数据源，避免两处改不同步）。
 */

import { NAV_ITEMS } from '@/components/organisms/navItems'

const ACTIVE_CLASS = 'text-[var(--el-color-primary)]'
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-slate-200 bg-white/90 backdrop-blur-md lg:hidden dark:border-slate-700 dark:bg-slate-900/90"
    aria-label="底部导航"
  >
    <router-link
      v-for="item in NAV_ITEMS"
      :key="item.name"
      :to="{ name: item.name }"
      class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs text-slate-500 transition-colors dark:text-slate-400"
      :active-class="item.name === 'dashboard' ? '' : ACTIVE_CLASS"
      :exact-active-class="ACTIVE_CLASS"
      :data-testid="`bottom-nav-${item.name}`"
    >
      <span class="text-base leading-none">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </router-link>
  </nav>
</template>
