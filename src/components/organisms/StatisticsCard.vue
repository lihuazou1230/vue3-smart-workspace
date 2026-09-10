<script setup lang="ts">
/**
 * 有机体组件：统计卡片（ECharts 图表）
 * - 饼图（环形）：按优先级分布
 * - 折线图：近 30 天每日完成数趋势
 * - 顶部汇总：总数 / 完成率
 */

import { computed, ref } from 'vue'

import { useTaskStatistics } from '@/composables/useStatistics'
import { useECharts } from '@/composables/useECharts'
import { priorityLabel } from '@/utils/priorityHelper'

const { statistics } = useTaskStatistics()

const AXIS_COLOR = '#94a3b8'
const SPLIT_COLOR = 'rgba(148,163,184,0.25)'

const pieEl = ref<HTMLElement | null>(null)
const pieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c}（{d}%）' },
  legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: AXIS_COLOR } },
  series: [
    {
      name: '优先级',
      type: 'pie',
      radius: ['42%', '68%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontWeight: 'bold' } },
      data: statistics.value.byPriority.map((s) => ({
        name: priorityLabel(s.priority),
        value: s.total,
      })),
    },
  ],
}))

// 近 30 天每日完成数趋势
const recentDaily = computed(() => statistics.value.daily.slice(-30))
const lineEl = ref<HTMLElement | null>(null)
const lineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 36, right: 16, top: 24, bottom: 28 },
  xAxis: {
    type: 'category',
    data: recentDaily.value.map((d) => d.date.slice(5)),
    axisLabel: { color: AXIS_COLOR, fontSize: 10 },
    axisLine: { lineStyle: { color: SPLIT_COLOR } },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    splitLine: { lineStyle: { color: SPLIT_COLOR } },
    axisLabel: { color: AXIS_COLOR, fontSize: 10 },
  },
  series: [
    {
      name: '完成数',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: recentDaily.value.map((d) => d.completed),
      itemStyle: { color: '#6366f1' },
      areaStyle: { color: 'rgba(99,102,241,0.12)' },
    },
  ],
}))

useECharts(pieEl, () => pieOption.value)
useECharts(lineEl, () => lineOption.value)
</script>

<template>
  <section class="glass rounded-2xl p-4 shadow-sm" aria-label="任务统计">
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
        <div ref="lineEl" class="h-56 w-full"></div>
      </div>
    </div>
  </section>
</template>
