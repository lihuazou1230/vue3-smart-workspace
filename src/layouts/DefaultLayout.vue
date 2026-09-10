<script setup lang="ts">
/**
 * 布局组件：默认布局（桌面端侧边栏 + 顶栏 + 内容区 + 移动端底部导航）
 *
 * 结构（对应规划里的布局图）：
 * ┌──────────┬──────────────────────────────────┐
 * │ Sidebar  │ 顶栏: 🔍 SearchBar   🌙 主题  ⚙ 设置 │
 * │ 👤 头像   ├──────────────────────────────────┤
 * │ 4 导航项  │        <router-view>             │
 * │ 🚪 退出   │   （keep-alive 保留各页状态）        │
 * └──────────┴──────────────────────────────────┘
 *
 * 两个实现要点：
 * - 顶栏搜索直接绑 todoStore.keyword：任务搜索全局可达，不用先进任务页
 * - router-view 外套 keep-alive：切走再切回任务页，筛选条件与滚动位置都还在
 */

import { computed } from 'vue'
import { useRoute } from 'vue-router'

import SearchBar from '@/components/molecules/SearchBar.vue'
import ThemeToggle from '@/components/molecules/ThemeToggle.vue'
import MobileBottomNav from '@/components/organisms/MobileBottomNav.vue'
import SidebarNav from '@/components/organisms/SidebarNav.vue'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useTodoStore } from '@/stores/todoStore'

/** 侧边栏折叠状态（本地记忆） */
const SIDEBAR_COLLAPSED_KEY = 'smart-workspace:sidebar-collapsed'

const collapsed = useLocalStorage(SIDEBAR_COLLAPSED_KEY, false)
const route = useRoute()
const todoStore = useTodoStore()

const pageTitle = computed(() => route.meta.title ?? '仪表板')
</script>

<template>
  <div class="flex min-h-screen">
    <SidebarNav :collapsed="collapsed" @toggle-collapse="collapsed = !collapsed" />

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- 顶栏 -->
      <header
        class="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 dark:border-slate-800 dark:bg-slate-900/80"
      >
        <div class="w-full max-w-xs">
          <SearchBar v-model="todoStore.keyword" />
        </div>
        <h1
          class="ml-auto hidden text-sm font-semibold text-slate-700 sm:block dark:text-slate-200"
        >
          {{ pageTitle }}
        </h1>
        <div class="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <router-link
            :to="{ name: 'settings' }"
            class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[var(--el-color-primary)] hover:text-[var(--el-color-primary)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            aria-label="打开设置"
          >
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </router-link>
        </div>
      </header>

      <!-- 内容区：keep-alive 保留各页状态（筛选条件、滚动位置） -->
      <main class="flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-8">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </main>

      <MobileBottomNav />
    </div>
  </div>
</template>
