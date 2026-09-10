<script setup lang="ts">
/**
 * 有机体组件：每日格言 + 时段问候
 * - 按时段显示问候语（凌晨好 / 早上好 / 中午好 / 下午好 / 晚上好）
 * - 每日一句：按日期哈希从本地 JSON 取句，同一天永远同一句
 * - 每分钟 + 切回标签页时校准，跨零点后自动换成新的一天
 */

import { computed, ref } from 'vue'

import { useEventListener, useIntervalFn } from '@vueuse/core'

import { todayKey } from '@/utils/dateFormatter'
import { formatDateLabel, greetingOf, quoteOfDay } from '@/utils/dailyQuote'

const now = ref(new Date())

function refresh() {
  now.value = new Date()
}

// 每分钟校准；切回标签页立即校准（若跨过零点，问候语与格言都会更新）
useIntervalFn(refresh, 60_000, { immediate: false })
useEventListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'visible') refresh()
})

const greeting = computed(() => greetingOf(now.value))
const dateLabel = computed(() => formatDateLabel(now.value))
const quote = computed(() => quoteOfDay(todayKey(now.value)))
</script>

<template>
  <section class="card p-5" aria-label="每日格言">
    <p class="text-base font-semibold text-slate-800 dark:text-slate-100">
      {{ greeting }}，今天是 {{ dateLabel }}
    </p>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      「{{ quote.text }}」
      <span class="ml-1 text-xs text-slate-400 dark:text-slate-500">—— {{ quote.author }}</span>
    </p>
  </section>
</template>
