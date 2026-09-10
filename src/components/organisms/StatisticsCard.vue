<script setup lang="ts">
/**
 * 有机体组件：统计卡片（ECharts 图表）
 * - 环形饼图：按优先级分布
 * - 圆角柱状图：近 30 天每日完成数趋势（Finexy 风格：圆角柱、浅网格、图例小色点）
 * - 顶部汇总：总数 / 完成率
 */

import { computed, ref } from 'vue'

import { useTaskStatistics } from '@/composables/useStatistics'
import { useECharts } from '@/composables/useECharts'
import { useThemeStore } from '@/stores/themeStore'
import { priorityLabel } from '@/utils/priorityHelper'

const { statistics } = useTaskStatistics()
const themeStore = useThemeStore()

const AXIS_COLOR = '#94a3b8'
const SPLIT_COLOR = 'rgba(148,163,184,0.18)'

/** 柱子颜色跟随主题色（换主题色后图表自动重绘） */
const barColor = computed(() => themeStore.primaryColor)

const pieEl = ref<HTMLElement | null>(null)
const pieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c}（{d}%）' },
  // 图例用小色点，减少视觉重量
  legend: {
    bottom: 0,
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    textStyle: { color: AXIS_COLOR, fontSize: 11 },
  },
  series: [
    {
      name: '优先级',
      type: 'pie',
      radius: ['46%', '70%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 8, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontWeight: 'bold' } },
      data: statistics.value.byPriority.map((s) => ({
        name: priorityLabel(s.priority),
        value: s.total,
      })),
    },
  ],
}))

// 近 30 天每日完成数趋势（圆角柱）
const recentDaily = computed(() => statistics.value.daily.slice(-30))
const barEl = ref<HTMLElement | null>(null)
const barOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 32, right: 12, top: 20, bottom: 24 },
  xAxis: {
    type: 'category',
    data: recentDaily.value.map((d) => d.date.slice(5)),
    axisLabel: { color: AXIS_COLOR, fontSize: 10, interval: 4 },
    axisLine: { lineStyle: { color: SPLIT_COLOR } },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    // 去掉重网格线，只留极浅的分隔
    splitLine: { lineStyle: { color: SPLIT_COLOR } },
    axisLabel: { color: AXIS_COLOR, fontSize: 10 },
  },
  series: [
    {
      name: '完成数',
      type: 'bar',
      barMaxWidth: 10,
      itemStyle: { color: barColor.value, borderRadius: [6, 6, 0, 0] },
      data: recentDaily.value.map((d) => d.completed),
    },
  ],
}))

useECharts(pieEl, () => pieOption.value)
useECharts(barEl, () => barOption.value)
</script>

<template>
  <section class="card p-5" aria-label="任务统计">
    <header class="mb-4 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">📊 任务统计</h2>
      <span class="text-xs text-slate-500 dark:text-slate-400">
        共 {{ statistics.total }} · 完成率 {{ statistics.completionRate }}%
      </span>
    </header>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <p class="mb-2 text-xs text-slate-500 dark:text-slate-400">按优先级分布</p>
        <div ref="pieEl" class="h-56 w-full"></div>
      </div>
      <div>
        <p class="mb-2 text-xs text-slate-500 dark:text-slate-400">近 30 天完成趋势</p>
        <div ref="barEl" class="h-56 w-full"></div>
      </div>
    </div>
  </section>
</template>
