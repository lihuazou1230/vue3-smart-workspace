/**
 * 主题组合式函数：应用 html.dark、监听系统深色偏好、生成 CSS 变量。
 * - 深色类挂 html（Tailwind darkMode: 'class' + Element Plus dark 共用）
 * - systemDark 通过 matchMedia 同步到 themeStore
 * - themeVars 供根节点绑 style，驱动 Element Plus 主题色/圆角
 */

import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import { useThemeStore } from '@/stores/themeStore'
import { darken, lighten } from '@/utils/themeColor'

export function useTheme() {
  const store = useThemeStore()

  let mql: MediaQueryList | null = null
  let handler: ((e: MediaQueryListEvent) => void) | null = null

  function applyDark(dark: boolean) {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }

  function setupSystemListener() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    mql = window.matchMedia('(prefers-color-scheme: dark)')
    handler = (e: MediaQueryListEvent) => store.setSystemDark(e.matches)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler)
    } else if (typeof mql.addListener === 'function') {
      ;(
        mql as MediaQueryList & { addListener: (cb: (e: MediaQueryListEvent) => void) => void }
      ).addListener(handler)
    }
  }

  function teardownSystemListener() {
    if (!mql || !handler) return
    if (typeof mql.removeEventListener === 'function') {
      mql.removeEventListener('change', handler)
    } else if (typeof mql.removeListener === 'function') {
      ;(
        mql as MediaQueryList & { removeListener: (cb: (e: MediaQueryListEvent) => void) => void }
      ).removeListener(handler)
    }
    mql = null
    handler = null
  }

  onMounted(() => {
    applyDark(store.isDark)
    setupSystemListener()
  })

  watch(
    () => store.isDark,
    (dark) => applyDark(dark),
  )

  onBeforeUnmount(teardownSystemListener)

  /** 浅色/深色 快速切换（system 模式时按当前实际明暗取反） */
  function toggleDark() {
    store.setMode(store.isDark ? 'light' : 'dark')
  }

  /** 运行时 CSS 变量：Element Plus 主题色系列 + 圆角 + 应用卡片圆角 */
  const themeVars = computed<Record<string, string>>(() => {
    const p = store.primaryColor
    return {
      '--el-color-primary': p,
      '--el-color-primary-light-3': lighten(p, 0.3),
      '--el-color-primary-light-5': lighten(p, 0.5),
      '--el-color-primary-light-7': lighten(p, 0.7),
      '--el-color-primary-light-8': lighten(p, 0.8),
      '--el-color-primary-light-9': lighten(p, 0.9),
      '--el-color-primary-dark-2': darken(p, 0.2),
      '--el-border-radius-base': `${store.radiusPx}px`,
      '--app-radius': `${store.radiusPx}px`,
    }
  })

  return { store, isDark: computed(() => store.isDark), toggleDark, themeVars }
}
