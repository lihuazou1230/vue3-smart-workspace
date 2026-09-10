import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

import { createAuthGuard, parseRedirect } from './authGuard'
import { routes } from './index'

/** 守卫测试用的路由桩（不加载真实页面组件） */
const TEST_ROUTES = [
  {
    path: '/login',
    name: 'login',
    component: { template: '<div />' },
    meta: { public: true },
  },
  {
    path: '/',
    component: { template: '<div><router-view /></div>' },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: { template: '<div />' },
        meta: { title: '仪表板' },
      },
      { path: 'todos', name: 'todos', component: { template: '<div />' }, meta: { title: '任务' } },
      { path: 'stats', name: 'stats', component: { template: '<div />' }, meta: { title: '统计' } },
      {
        path: 'settings',
        name: 'settings',
        component: { template: '<div />' },
        meta: { title: '设置' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
]

function guardedRouter(deps: {
  authed: boolean
  authRequired?: boolean
  ensureReady?: () => Promise<void>
}): Router {
  const router = createRouter({ history: createMemoryHistory(), routes: TEST_ROUTES })
  router.beforeEach(
    createAuthGuard({
      ensureReady: deps.ensureReady ?? (async () => {}),
      isAuthed: () => deps.authed,
      isAuthRequired: () => deps.authRequired ?? true,
    }),
  )
  return router
}

describe('parseRedirect（挡开放重定向）', () => {
  it('接受站内绝对路径', () => {
    expect(parseRedirect('/todos')).toBe('/todos')
    expect(parseRedirect('/todos?filter=all')).toBe('/todos?filter=all')
    expect(parseRedirect('  /stats  ')).toBe('/stats')
  })

  it('拒绝外站与协议相对地址', () => {
    expect(parseRedirect('//evil.com')).toBeNull()
    expect(parseRedirect('https://evil.com')).toBeNull()
    expect(parseRedirect('javascript:alert(1)')).toBeNull()
    expect(parseRedirect('todos')).toBeNull()
  })

  it('拒绝非字符串（数组 query / undefined）', () => {
    expect(parseRedirect(undefined)).toBeNull()
    expect(parseRedirect(['/todos', '/stats'])).toBeNull()
    expect(parseRedirect(123)).toBeNull()
  })
})

describe('路由守卫', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('已配置 Supabase（需要登录）', () => {
    it('未登录访问受保护页：重定向到登录页并带上原目标', async () => {
      const router = guardedRouter({ authed: false })
      await router.push('/todos')

      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/todos')
    })

    it('根路径同样受保护', async () => {
      const router = guardedRouter({ authed: false })
      await router.push('/')
      expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/')
    })

    it('已登录：正常放行', async () => {
      const router = guardedRouter({ authed: true })
      await router.push('/todos')
      expect(router.currentRoute.value.name).toBe('todos')
    })

    it('登录页是公开的：未登录也能进', async () => {
      const router = guardedRouter({ authed: false })
      await router.push('/login')
      expect(router.currentRoute.value.name).toBe('login')
    })

    it('已登录访问登录页：送回仪表板', async () => {
      const router = guardedRouter({ authed: true })
      await router.push('/login')
      expect(router.currentRoute.value.name).toBe('dashboard')
    })

    it('已登录访问登录页且带合法 redirect：回跳到原目标', async () => {
      const router = guardedRouter({ authed: true })
      await router.push({ name: 'login', query: { redirect: '/stats' } })
      expect(router.currentRoute.value.fullPath).toBe('/stats')
    })

    it('已登录但 redirect 是外站：忽略它，回仪表板（防开放重定向）', async () => {
      const router = guardedRouter({ authed: true })
      await router.push({ name: 'login', query: { redirect: '//evil.com' } })
      expect(router.currentRoute.value.name).toBe('dashboard')
    })

    it('会话恢复完成后才判定：不会先跳登录再弹回来', async () => {
      let resolveReady: () => void = () => {}
      const ready = new Promise<void>((resolve) => {
        resolveReady = resolve
      })
      // 模拟真实场景：getSession 返回之前是「未登录」，返回之后才确定已登录
      let authed = false
      const ensureReady = vi.fn(async () => {
        await ready
        authed = true
      })

      const router = createRouter({ history: createMemoryHistory(), routes: TEST_ROUTES })
      router.beforeEach(
        createAuthGuard({
          ensureReady,
          isAuthed: () => authed,
          isAuthRequired: () => true,
        }),
      )

      const navigation = router.push('/todos')
      // 给导航一点时间跑到守卫（守卫此刻正 await 会话恢复）
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(ensureReady).toHaveBeenCalled()
      // 会话恢复还没回来时，导航必须仍然挂起（而不是已经跳到登录页）
      expect(router.currentRoute.value.name).not.toBe('login')

      resolveReady()
      await navigation

      expect(router.currentRoute.value.name).toBe('todos')
    })
  })

  describe('未配置 Supabase（本地模式）', () => {
    it('未登录也放行所有页面（否则会被锁在登不进去的登录页）', async () => {
      const router = guardedRouter({ authed: false, authRequired: false })
      await router.push('/todos')
      expect(router.currentRoute.value.name).toBe('todos')

      await router.push('/settings')
      expect(router.currentRoute.value.name).toBe('settings')
    })

    it('登录页仍可直接访问（用于展示配置引导）', async () => {
      const router = guardedRouter({ authed: false, authRequired: false })
      await router.push('/login')
      expect(router.currentRoute.value.name).toBe('login')
    })
  })
})

describe('路由表', () => {
  it('四个受保护页面 + 一个公开登录页', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const names = router.getRoutes().map((route) => route.name)
    expect(names).toContain('dashboard')
    expect(names).toContain('todos')
    expect(names).toContain('stats')
    expect(names).toContain('settings')
    expect(names).toContain('login')

    expect(router.resolve('/login').meta.public).toBe(true)
    expect(router.resolve('/todos').meta.public).toBeUndefined()
    expect(router.resolve('/todos').meta.title).toBe('任务')
  })

  it('页面组件全部懒加载（首屏只加载仪表板）', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const pageRoutes = router.getRoutes().filter((route) => route.name)
    for (const route of pageRoutes) {
      expect(typeof route.components?.default).toBe('function')
    }
  })

  it('未知路径回到仪表板', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: TEST_ROUTES })
    await router.push('/not-exist')
    expect(router.currentRoute.value.name).toBe('dashboard')
  })
})
