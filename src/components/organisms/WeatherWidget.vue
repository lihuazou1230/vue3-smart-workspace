<script setup lang="ts">
/**
 * 有机体组件：当前位置天气卡片
 * - 进站自动定位，只展示当前位置的天气（无城市搜索 / 无城市快捷按钮）
 * - 定位不可用时按「上次的位置 → 默认城市」逐级回落，并在卡片内说明原因
 * - 本地缓存：10 分钟内命中缓存不请求接口（显示「缓存」标记，可手动刷新）
 * - 未配置 API Key 时给出配置指引
 */

import { onMounted } from 'vue'

import { useWeather } from '@/composables/useWeather'
import BaseButton from '@/components/atoms/BaseButton.vue'

const {
  weather,
  state,
  error,
  configured,
  fromCache,
  locating,
  located,
  locateHint,
  placeLabel,
  init,
  locate,
  refresh,
  retry,
} = useWeather()

onMounted(() => {
  if (configured.value) void init()
})

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <section class="card p-5" aria-label="当前位置天气">
    <header class="mb-3 flex items-center justify-between gap-2">
      <h2
        class="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
      >
        ☀️ 天气
        <span
          v-if="located"
          class="text-[10px] font-normal text-indigo-500 dark:text-indigo-400"
          title="当前展示的是定位到的位置"
          >📍 当前位置</span
        >
      </h2>
      <div class="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <span v-if="weather && state === 'success'">
          更新于 {{ formatTime(weather.updatedAt) }}
          <span
            v-if="fromCache"
            class="ml-1 rounded bg-slate-100 px-1 text-[10px] dark:bg-slate-700"
            title="10 分钟内命中本地缓存，未请求接口"
            >缓存</span
          >
        </span>
        <button
          v-if="configured"
          type="button"
          class="rounded px-1 transition-colors hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="locating"
          title="重新定位到当前位置"
          aria-label="重新定位"
          @click="locate"
        >
          {{ locating ? '定位中…' : '📍 定位' }}
        </button>
        <button
          v-if="weather && state === 'success'"
          type="button"
          class="rounded px-1 transition-colors hover:text-indigo-500"
          title="跳过缓存，重新获取"
          aria-label="刷新天气"
          @click="refresh"
        >
          ↻ 刷新
        </button>
      </div>
    </header>

    <!-- 定位提示：成功 / 失败原因 / 回落说明 -->
    <p v-if="configured && locateHint" class="mb-2 text-xs text-slate-400 dark:text-slate-500">
      {{ locateHint }}
    </p>

    <!-- 未配置 API Key -->
    <div
      v-if="!configured"
      class="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500"
    >
      未配置天气 API Key<br />
      <span class="text-xs"
        >请在项目根目录 <code>.env.local</code> 中设置 <code>VITE_AMAP_KEY</code> 后刷新页面。</span
      >
    </div>

    <template v-else>
      <!-- 定位 / 加载中 -->
      <div v-if="state === 'loading'" class="space-y-2" role="status" aria-busy="true">
        <p v-if="locating" class="text-xs text-slate-400 dark:text-slate-500">正在获取你的位置…</p>
        <div class="h-8 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/50"></div>
        <div class="h-4 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-700/50"></div>
        <div class="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700/50"></div>
      </div>

      <!-- 错误 -->
      <div
        v-else-if="state === 'error'"
        class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
        role="alert"
      >
        <p class="mb-2">{{ error }}</p>
        <BaseButton size="sm" variant="secondary" @click="retry">重试</BaseButton>
      </div>

      <!-- 天气展示 -->
      <div v-else-if="weather" class="space-y-2">
        <div class="flex items-center gap-3">
          <span class="text-4xl leading-none" aria-hidden="true">{{ weather.icon }}</span>
          <div>
            <p class="text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {{ Math.round(weather.temperature) }}°C
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ weather.description }}</p>
          </div>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-300">{{ placeLabel }}</p>
        <div class="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span v-if="weather.feelsLike !== undefined">
            体感 {{ Math.round(weather.feelsLike) }}°C
          </span>
          <span>湿度 {{ weather.humidity }}%</span>
          <span v-if="weather.windDirection || weather.windPower">
            {{ weather.windDirection }}{{ weather.windDirection ? '风' : ''
            }}{{ weather.windPower ? ` ${weather.windPower}级` : '' }}
          </span>
          <span v-else-if="weather.windSpeed !== undefined">
            风速 {{ weather.windSpeed }} m/s
          </span>
        </div>
        <p class="text-[10px] text-slate-400 dark:text-slate-500">数据来源：高德地图</p>
      </div>
    </template>
  </section>
</template>
