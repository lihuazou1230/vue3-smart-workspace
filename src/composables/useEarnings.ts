/**
 * 赚钱秒表组合式函数：连接配置持久化与实时重算。
 *
 * 实现要点：
 * - 每秒 tick 只做一件事：把 `now` 换成最新时间戳，金额由纯函数重新算一遍
 *   （差值式，不做累加），因此后台节流、休眠唤醒都不会产生误差。
 * - 用 VueUse 的 useEventListener 额外监听 `visibilitychange` / `focus`：
 *   标签页切回时立即补算一次，不必等下一个 tick，避免"切回来第一眼是旧数字"。
 * - 配置持久化复用 useLocalStorage，刷新后保留。
 */

import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { useEventListener, useIntervalFn } from '@vueuse/core'

import { useLocalStorage } from '@/composables/useLocalStorage'
import { DEFAULT_EARNINGS_CONFIG, EARNINGS_STORAGE_KEY } from '@/types/earnings'
import type { EarningsConfig, EarningsSnapshot } from '@/types/earnings'
import { computeEarnings, formatFen, isEarningsConfigured } from '@/utils/earnings'

export interface UseEarningsOptions {
  /** 可注入存储实现（默认 window.localStorage），便于测试 */
  storage?: Storage | null
  /** 可注入时钟（默认系统时间），便于测试 */
  clock?: () => Date
  /** 是否自动每秒重算；测试可传 false 后手动 refresh */
  autoTick?: boolean
}

export interface UseEarningsReturn {
  config: Ref<EarningsConfig>
  snapshot: ComputedRef<EarningsSnapshot>
  /** 今日已赚金额文本（主指标；元，两位小数，千分位） */
  amountText: ComputedRef<string>
  /** 本月已赚金额文本（次指标） */
  monthAmountText: ComputedRef<string>
  /** 是否已配置可用（月薪 > 0 且工作时段合法） */
  isConfigured: ComputedRef<boolean>
  /** 立即用最新时间戳重算 */
  refresh: () => void
  /** 合并更新配置 */
  updateConfig: (patch: Partial<EarningsConfig>) => void
  /** 恢复默认配置 */
  resetConfig: () => void
  start: () => void
  stop: () => void
}

const TICK_INTERVAL = 1000

export function useEarnings(options: UseEarningsOptions = {}): UseEarningsReturn {
  const clock = options.clock ?? (() => new Date())
  const autoTick = options.autoTick !== false

  const config = useLocalStorage<EarningsConfig>(
    EARNINGS_STORAGE_KEY,
    { ...DEFAULT_EARNINGS_CONFIG },
    options.storage,
  )

  /** 唯一的时间来源：每次 tick 只是刷新这个时间戳 */
  const now = ref<Date>(clock())
  const snapshot = computed<EarningsSnapshot>(() => computeEarnings(config.value, now.value))
  const amountText = computed(() => formatFen(snapshot.value.earnedFen))
  const monthAmountText = computed(() => formatFen(snapshot.value.monthEarnedFen))
  const isConfigured = computed(() => isEarningsConfigured(config.value))

  function refresh() {
    now.value = clock()
  }

  // 每秒重算（不是每秒累加）：组件卸载时 useIntervalFn 自动清理
  const { pause, resume } = useIntervalFn(refresh, TICK_INTERVAL, {
    immediate: autoTick,
    immediateCallback: autoTick,
  })

  // 切回标签页/窗口时立即补算，避免看到上一秒的旧数字
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh()
  })
  useEventListener(window, 'focus', refresh)

  function updateConfig(patch: Partial<EarningsConfig>) {
    config.value = { ...config.value, ...patch }
    refresh()
  }

  function resetConfig() {
    config.value = { ...DEFAULT_EARNINGS_CONFIG }
    refresh()
  }

  return {
    config,
    snapshot,
    amountText,
    monthAmountText,
    isConfigured,
    refresh,
    updateConfig,
    resetConfig,
    start: resume,
    stop: pause,
  }
}
