<script setup lang="ts">
/**
 * 根组件：第四阶段（体验优化与交付）
 * - 挂载 el-config-provider（密度）+ 运行时主题 CSS 变量（themeVars）
 * - 明暗模式（useTheme）、外观设置抽屉、移动端底部导航
 * - 每日格言、赚钱秒表、今日聚焦、子任务、批量操作等阶段4能力
 */

import { computed, ref } from 'vue'

import { useThemeStore } from '@/stores/themeStore'
import { useTheme } from '@/composables/useTheme'
import { useTodoStore } from '@/stores/todoStore'
import DailyGreeting from '@/components/organisms/DailyGreeting.vue'
import EarningsClock from '@/components/organisms/EarningsClock.vue'
import TodoForm from '@/components/organisms/TodoForm.vue'
import TodoList from '@/components/organisms/TodoList.vue'
import MyDay from '@/components/organisms/MyDay.vue'
import StatisticsCard from '@/components/organisms/StatisticsCard.vue'
import ProductivityHeatmap from '@/components/organisms/ProductivityHeatmap.vue'
import WeatherWidget from '@/components/organisms/WeatherWidget.vue'
import MobileBottomNav from '@/components/organisms/MobileBottomNav.vue'
import SettingsPanel from '@/components/organisms/SettingsPanel.vue'
import ThemeToggle from '@/components/molecules/ThemeToggle.vue'
import BaseBadge from '@/components/atoms/BaseBadge.vue'

const store = useTodoStore()
const themeStore = useThemeStore()
const { themeVars } = useTheme()

/** 外观设置抽屉开关 */
const settingsOpen = ref(false)

interface SummaryItem {
  label: string
  value: number
  tone: 'info' | 'warning' | 'success'
}

const summary = computed<SummaryItem[]>(() => [
  { label: '全部', value: store.totalCount, tone: 'info' },
  { label: '进行中', value: store.activeCount, tone: 'warning' },
  { label: '已完成', value: store.completedCount, tone: 'success' },
])

function handleCreate(payload: Parameters<typeof store.addTodo>[0]) {
  store.addTodo(payload)
}
</script>

<template>
  <el-config-provider :size="themeStore.elSize">
    <div :style="themeVars" class="min-h-screen">
      <main class="mx-auto w-full max-w-3xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
        <header class="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              🧭 Vue 3 智能工作台
            </h1>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              第四阶段：体验优化与交付（主题 / 每日格言 / 赚钱秒表 / 今日聚焦 / 子任务 / 批量操作）
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:text-indigo-400"
              aria-label="打开外观设置"
              @click="settingsOpen = true"
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
            </button>
          </div>
        </header>

        <!-- 概览计数 -->
        <section class="mb-5 flex flex-wrap gap-2" aria-label="任务统计">
          <BaseBadge v-for="item in summary" :key="item.label" :tone="item.tone" size="sm">
            {{ item.label }} {{ item.value }}
          </BaseBadge>
        </section>

        <!-- 每日格言（时段问候 + 每日一句） -->
        <div class="mb-4">
          <DailyGreeting />
        </div>

        <!-- 赚钱秒表（实时跳动「今日已赚」） -->
        <div class="mb-4">
          <EarningsClock />
        </div>

        <!-- 今日聚焦 -->
        <div class="mb-6">
          <MyDay />
        </div>

        <!-- 新建任务 -->
        <section class="glass mb-6 rounded-2xl p-4 shadow-sm">
          <TodoForm @create="handleCreate" />
        </section>

        <!-- 任务列表 -->
        <TodoList />

        <!-- 第三阶段：可视化与天气 -->
        <section class="mt-8 space-y-4">
          <h2 class="sr-only">数据可视化与天气</h2>
          <StatisticsCard />
          <ProductivityHeatmap />
          <WeatherWidget />
        </section>
      </main>

      <!-- 外观设置抽屉 -->
      <el-drawer v-model="settingsOpen" title="外观设置" size="320px">
        <SettingsPanel />
      </el-drawer>

      <!-- 移动端底部导航 -->
      <MobileBottomNav @open-settings="settingsOpen = true" />
    </div>
  </el-config-provider>
</template>
