import { describe, expect, it } from 'vitest'

import { appUrl, buildAppUrl } from './appUrl'

describe('buildAppUrl（部署子路径感知）', () => {
  const ORIGIN = 'https://lihuazou1230.github.io'

  it('根目录部署：origin + / + path', () => {
    expect(buildAppUrl('https://app.example.com', '/', '')).toBe('https://app.example.com/')
    expect(buildAppUrl('https://app.example.com', '/', 'reset-password')).toBe(
      'https://app.example.com/reset-password',
    )
  })

  it('GitHub Pages 子路径部署：保留仓库前缀（回归保护）', () => {
    const base = '/vue3-smart-workspace/'
    expect(buildAppUrl(ORIGIN, base)).toBe(`${ORIGIN}/vue3-smart-workspace/`)
    expect(buildAppUrl(ORIGIN, base, 'reset-password')).toBe(
      `${ORIGIN}/vue3-smart-workspace/reset-password`,
    )
    expect(buildAppUrl(ORIGIN, base, 'login')).toBe(`${ORIGIN}/vue3-smart-workspace/login`)
  })

  it('base 缺尾斜杠时自动补，不会拼出 //', () => {
    expect(buildAppUrl(ORIGIN, '/vue3-smart-workspace', 'todos')).toBe(
      `${ORIGIN}/vue3-smart-workspace/todos`,
    )
  })

  it('path 带前导斜杠也正常（不会出现双斜杠）', () => {
    expect(buildAppUrl(ORIGIN, '/vue3-smart-workspace/', '/reset-password')).toBe(
      `${ORIGIN}/vue3-smart-workspace/reset-password`,
    )
  })

  it('base 为空时按根目录处理', () => {
    expect(buildAppUrl(ORIGIN, '', 'reset-password')).toBe(`${ORIGIN}/reset-password`)
  })

  it('origin 尾部多斜杠会被归一化', () => {
    expect(buildAppUrl('https://app.example.com/', '/', 'todos')).toBe(
      'https://app.example.com/todos',
    )
  })

  it('嵌套子路径同样成立', () => {
    expect(buildAppUrl(ORIGIN, '/a/b/', 'c')).toBe(`${ORIGIN}/a/b/c`)
  })
})

describe('appUrl（读当前 origin + 构建期 BASE_URL）', () => {
  it('测试环境的 BASE_URL 是 /：拼出当前 origin 下的地址', () => {
    expect(appUrl('reset-password')).toBe(`${location.origin}/reset-password`)
    expect(appUrl()).toBe(`${location.origin}/`)
  })

  it('BASE_URL 变成子路径时（模拟 GitHub Pages 构建），地址自动带上前缀', async () => {
    const original = import.meta.env.BASE_URL
    try {
      // 用 stub 让运行时 base 指向子路径，验证 appUrl 不是写死 origin
      ;(import.meta.env as Record<string, unknown>).BASE_URL = '/vue3-smart-workspace/'
      expect(appUrl('reset-password')).toBe(
        `${location.origin}/vue3-smart-workspace/reset-password`,
      )
    } finally {
      ;(import.meta.env as Record<string, unknown>).BASE_URL = original
    }
  })
})
