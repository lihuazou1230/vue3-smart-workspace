<script setup lang="ts">
/**
 * 有机体组件：今日任务完成度（Finexy 风格的大数字 + 环形图卡）
 * - 环形图（ECharts donut）：今日完成 / 今日待办
 * - 大数字：今日完成度百分比（tabular-nums）
 * - 涨跌徽章：今日完成数相对昨日的涨跌
 * - 今日没有到期任务且未完成任何事时，换成"今日暂无到期任务"文案
 */

import { computed, ref } from 'vue'

import { useTodayProgress } from '@/composables/useStatistics'
import { useECharts } from '@/composables/useECharts'
import { useThemeStore } from '@/stores/themeStore'
import TrendBadge from '@/components/atoms/TrendBadge.vue'

const { progress } = useTodayProgress()
const themeStore = useThemeStore()

const ringEl = ref<HTMLElement | null>(null)

const ringOption = computed(() => {
  const { completedToday, dueTodayActive } = progress.value
  const hasTarget = completedToday + dueTodayActive > 0
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [
      {
        type: 'pie',
        radius: ['72%', '92%'],
        silent: true,
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderWidth: 0 },
        data: hasTarget
          ? [
              // 已完成用主题色，未完成用浅灰底环
              {
                name: '今日完成',
                value: completedToday,
                itemStyle: { color: themeStore.primaryColor },
              },
              { name: '今日待办', value: dueTodayActive, itemStyle: { color: '#e2e8f0' } },
            ]
          : [{ name: '暂无任务', value: 1, itemStyle: { color: '#e2e8f0' } }],
      },
    ],
  }
})

useECharts(ringEl, () => ringOption.value)
</script>

<template>
  <section class="card flex flex-col p-5" aria-label="今日任务完成度">
    <header class="mb-3 flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-slate-500 dark:text-slate-400">今日完成度</h2>
      <TrendBadge
        v-if="progress.hasTarget"
        :value="progress.deltaPercent"
        label="较昨日"
        data-testid="today-progress-trend"
      />
    </header>

    <!-- 环形图 + 居中大数字 -->
    <div class="relative mx-auto h-36 w-36">
      <div ref="ringEl" class="h-full w-full"></div>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          data-testid="today-progress-rate"
          class="text-4xl font-bold tabular-nums tracking-tight text-slate-800 dark:text-slate-100"
          >{{ progress.rate }}%</span
        >
        <span class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">已完成</span>
      </div>
    </div>

    <p class="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
      <template v-if="progress.hasTarget">
        今日完成 <span class="font-medium">{{ progress.completedToday }}</span> 项 · 待办
        <span class="font-medium">{{ progress.dueTodayActive }}</span> 项
      </template>
      <template v-else> 今日暂无到期任务，给任务设个截止日期就会出现在这里 </template>
    </p>
  </section>
</template>
