<script setup lang="ts">
/**
 * 页面：仪表板（打开即看「今天赚了多少、该干什么、外面天气」）
 *
 * 三列 bento 布局：
 * - 赚钱秒表（深绿 C 位卡，跨 2 行）
 * - 今日完成度环形卡
 * - 天气卡
 * - 每日格言（跨 2 列）
 * - 今日聚焦 MyDay（跨 2 列）+ 任务概览徽章
 *
 * 任务增删改与列表搬到 /todos，统计图表搬到 /stats——首页只留「一眼看清」的内容。
 */

import { computed } from 'vue'

import DailyGreeting from '@/components/organisms/DailyGreeting.vue'
import EarningsClock from '@/components/organisms/EarningsClock.vue'
import MyDay from '@/components/organisms/MyDay.vue'
import TodayProgressCard from '@/components/organisms/TodayProgressCard.vue'
import WeatherWidget from '@/components/organisms/WeatherWidget.vue'
import BaseBadge from '@/components/atoms/BaseBadge.vue'
import { useTodoStore } from '@/stores/todoStore'

const store = useTodoStore()

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
</script>

<template>
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <!-- 赚钱秒表：深绿 C 位卡，跨 2 行 -->
    <EarningsClock class="lg:row-span-2" />
    <TodayProgressCard />
    <WeatherWidget />

    <!-- 每日格言 -->
    <DailyGreeting class="lg:col-span-2" />

    <!-- 今日聚焦 + 概览徽章 -->
    <MyDay class="lg:col-span-2" />
    <section class="card flex flex-col gap-3 p-5" aria-label="任务统计">
      <h2 class="text-sm font-semibold text-slate-500 dark:text-slate-400">任务概览</h2>
      <div class="flex flex-wrap gap-2">
        <BaseBadge v-for="item in summary" :key="item.label" :tone="item.tone" size="sm">
          {{ item.label }} {{ item.value }}
        </BaseBadge>
      </div>
      <p class="mt-auto text-xs text-slate-400 dark:text-slate-500">
        全部任务按优先级与截止日期排序，去「任务」页可筛选、搜索与批量操作。
      </p>
      <router-link
        :to="{ name: 'todos' }"
        data-testid="dashboard-goto-todos"
        class="text-sm font-medium text-[var(--el-color-primary)] underline-offset-2 hover:underline"
      >
        查看全部任务 →
      </router-link>
    </section>
  </div>
</template>
