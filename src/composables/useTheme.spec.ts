import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

import { useThemeStore } from '@/stores/themeStore'
import { useTheme } from './useTheme'

const Wrapper = defineComponent({
  setup() {
    const theme = useTheme()
    return { toggleDark: theme.toggleDark }
  },
  template: '<div />',
})

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
  })

  it('挂载时应用 isDark 到 html.dark 类', () => {
    const store = useThemeStore()
    store.setMode('dark')
    mount(Wrapper)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('切换 mode 时同步 html.dark 类', async () => {
    const store = useThemeStore()
    store.setMode('light')
    mount(Wrapper)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    store.setMode('dark')
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('system 模式跟随系统偏好', async () => {
    const store = useThemeStore()
    store.setMode('system')
    store.setSystemDark(false)
    store.setMode('light')
    mount(Wrapper)
    store.setMode('system')
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    store.setSystemDark(true)
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggleDark 在当前明暗间取反', async () => {
    const store = useThemeStore()
    store.setMode('light')
    const wrapper = mount(Wrapper)
    ;(wrapper.vm as unknown as { toggleDark: () => void }).toggleDark()
    await nextTick()
    expect(store.prefs.mode).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
