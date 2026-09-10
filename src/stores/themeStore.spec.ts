import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useThemeStore, THEME_STORAGE_KEY } from './themeStore'
import type { ThemePrefs } from './themeStore'

async function flush() {
  await Promise.resolve()
}

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('默认偏好：跟随系统 + emerald + 默认密度/圆角', () => {
    const store = useThemeStore()
    expect(store.prefs.mode).toBe('system')
    expect(store.prefs.colorName).toBe('emerald')
    expect(store.prefs.customColor).toBeNull()
    expect(store.prefs.density).toBe('default')
    expect(store.prefs.radius).toBe('medium')
  })

  it('主色默认取预设色，自定义色优先', () => {
    const store = useThemeStore()
    expect(store.primaryColor).toBe('#10b981')
    store.setCustomColor('#ff0000')
    expect(store.primaryColor).toBe('#ff0000')
    // 选择预设色会清除自定义色
    store.setColorName('lavender')
    expect(store.prefs.colorName).toBe('lavender')
    expect(store.prefs.customColor).toBeNull()
    expect(store.primaryColor).toBe('#7c8cf8')
  })

  it('isDark 依据 mode 与 systemDark', () => {
    const store = useThemeStore()
    store.setMode('dark')
    expect(store.isDark).toBe(true)
    store.setMode('light')
    expect(store.isDark).toBe(false)
    // system 模式跟随系统
    store.setMode('system')
    store.setSystemDark(true)
    expect(store.isDark).toBe(true)
    store.setSystemDark(false)
    expect(store.isDark).toBe(false)
  })

  it('elSize 密度映射', () => {
    const store = useThemeStore()
    store.setDensity('compact')
    expect(store.elSize).toBe('small')
    store.setDensity('loose')
    expect(store.elSize).toBe('large')
    store.setDensity('default')
    expect(store.elSize).toBe('default')
  })

  it('radiusPx 圆角映射', () => {
    const store = useThemeStore()
    store.setRadius('small')
    expect(store.radiusPx).toBe(8)
    store.setRadius('medium')
    expect(store.radiusPx).toBe(12)
    store.setRadius('large')
    expect(store.radiusPx).toBe(16)
  })

  it('偏好持久化到 localStorage，重置恢复默认', async () => {
    const store = useThemeStore()
    store.setMode('dark')
    store.setDensity('compact')
    await flush()
    const persisted = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!) as ThemePrefs
    expect(persisted.mode).toBe('dark')
    expect(persisted.density).toBe('compact')

    store.reset()
    expect(store.prefs.mode).toBe('system')
    expect(store.prefs.density).toBe('default')
  })
})
