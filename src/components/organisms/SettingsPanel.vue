<script setup lang="ts">
/**
 * 有机体组件：外观自定义面板（Settings 抽屉内容）
 * - 明暗模式：浅色 / 深色 / 跟随系统
 * - 主题色：预设色板 + 自定义取色器
 * - 圆角：小 / 中 / 大
 * - 密度：紧凑 / 默认 / 宽松
 * - 全部通过 themeStore 即时生效并持久化
 */

import { computed } from 'vue'

import { useThemeStore } from '@/stores/themeStore'
import type { ThemeDensity, ThemeMode, ThemeRadius } from '@/stores/themeStore'
import { THEME_COLOR_NAMES, THEME_COLOR_PRESETS } from '@/utils/themeColor'

const store = useThemeStore()

const MODES: Array<{ key: ThemeMode; label: string }> = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
  { key: 'system', label: '跟随系统' },
]

const DENSITIES: Array<{ key: ThemeDensity; label: string }> = [
  { key: 'compact', label: '紧凑' },
  { key: 'default', label: '默认' },
  { key: 'loose', label: '宽松' },
]

const RADII: Array<{ key: ThemeRadius; label: string }> = [
  { key: 'small', label: '小' },
  { key: 'medium', label: '中' },
  { key: 'large', label: '大' },
]

/** 当前生效的预设色名（自定义色优先时为空） */
const activeColor = computed(() => (store.prefs.customColor ? null : store.prefs.colorName))
</script>

<template>
  <div class="space-y-6">
    <!-- 明暗模式 -->
    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">明暗模式</h3>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="m in MODES"
          :key="m.key"
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm transition-colors"
          :class="
            store.prefs.mode === m.key
              ? 'bg-[var(--el-color-primary)] text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
          "
          @click="store.setMode(m.key)"
        >
          {{ m.label }}
        </button>
      </div>
    </section>

    <!-- 主题色 -->
    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">主题色</h3>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="name in THEME_COLOR_NAMES"
          :key="name"
          type="button"
          class="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
          :style="{ backgroundColor: THEME_COLOR_PRESETS[name] }"
          :class="
            activeColor === name ? 'border-slate-800 dark:border-slate-100' : 'border-transparent'
          "
          :aria-label="`主题色：${name}`"
          @click="store.setColorName(name)"
        ></button>
        <!-- 自定义色 -->
        <el-color-picker v-model="store.prefs.customColor" size="small" class="ml-1" />
      </div>
      <p v-if="store.prefs.customColor" class="mt-1.5 text-xs text-slate-400">
        已使用自定义色
        <code class="ml-1 rounded bg-slate-100 px-1 text-[10px] dark:bg-slate-800">{{
          store.prefs.customColor
        }}</code>
      </p>
    </section>

    <!-- 圆角 -->
    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">圆角</h3>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="r in RADII"
          :key="r.key"
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm transition-colors"
          :class="
            store.prefs.radius === r.key
              ? 'bg-[var(--el-color-primary)] text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
          "
          @click="store.setRadius(r.key)"
        >
          {{ r.label }}
        </button>
      </div>
    </section>

    <!-- 密度 -->
    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">密度</h3>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="d in DENSITIES"
          :key="d.key"
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm transition-colors"
          :class="
            store.prefs.density === d.key
              ? 'bg-[var(--el-color-primary)] text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
          "
          @click="store.setDensity(d.key)"
        >
          {{ d.label }}
        </button>
      </div>
    </section>

    <!-- 重置 -->
    <section class="border-t border-slate-200 pt-4 dark:border-slate-700">
      <button
        type="button"
        class="text-sm text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300"
        @click="store.reset()"
      >
        恢复默认外观
      </button>
    </section>
  </div>
</template>
