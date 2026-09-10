<script setup lang="ts">
/**
 * 原子组件：涨跌迷你徽章（箭头 + 数值，绿涨红跌，0 为灰）
 * 纯展示：只接收 value / suffix，不关心数据来源
 */

import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 变化量（正数为涨、负数为跌、0 为持平） */
    value: number
    /** 数值后缀，默认百分比 */
    suffix?: string
    /** 无障碍描述前缀，如「较昨日」 */
    label?: string
  }>(),
  { suffix: '%', label: '' },
)

type Trend = 'up' | 'down' | 'flat'

/** 先四舍五入到展示精度，再判定涨跌：-0.04% 展示为 0%，应算持平而非下跌 */
const roundedValue = computed(() => {
  if (!Number.isFinite(props.value)) return 0
  const rounded = Math.round(props.value * 10) / 10
  return rounded === 0 ? 0 : rounded
})

const trend = computed<Trend>(() => {
  if (roundedValue.value === 0) return 'flat'
  return roundedValue.value > 0 ? 'up' : 'down'
})

const trendClass: Record<Trend, string> = {
  up: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  down: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  flat: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

const arrow: Record<Trend, string> = { up: '↑', down: '↓', flat: '—' }

/** 保留一位小数并去掉多余的 .0，如 2.3% / 8% */
const text = computed(() => {
  const sign = roundedValue.value > 0 ? '+' : ''
  return `${sign}${roundedValue.value}${props.suffix}`
})

const ariaLabel = computed(
  () => `${props.label ? `${props.label} ` : ''}${trend.value === 'flat' ? '持平' : text.value}`,
)
</script>

<template>
  <span
    class="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
    :class="trendClass[trend]"
    :aria-label="ariaLabel"
  >
    <span aria-hidden="true">{{ arrow[trend] }}</span>
    <span>{{ text }}</span>
  </span>
</template>
