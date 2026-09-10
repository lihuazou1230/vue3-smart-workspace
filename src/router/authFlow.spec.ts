/**
 * 第五阶段验收项「未登录访问受保护页 → 重定向 /login → 登录后回到原目标页」的**端到端**接线测试。
 *
 * 与相邻测试的分工：
 * - `authGuard.spec.ts` 用注入依赖测守卫**逻辑**（不碰真实 store）
 * - `Login.spec.ts` 测登录**页面**（路由是桩）
 * - 本文件把三者接起来：真实 router（真实路由表）+ 真实 authStore + 真实的
 *   `isSupabaseConfigured()` 环境判定，验证「配置了 Supabase」这条链路上
 *   重定向、回跳、会话恢复、登出都对得上——中间任何一处接错（守卫装没装、store
 *   有没有先恢复会话、redirect 参数名不一致）都只有这类测试能发现。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'

import { routes } from './index'
import { installAuthGuard } from './authGuard'
import { useAuthStore } from '@/stores/authStore'
import { AUTH_TEST_USER, authApiStub, resetAuthApiStub } from '@/test/authApiStub'

vi.mock('@/api/auth', async () => (await import('@/test/authApiStub')).authApiStub)

/** 新 Pinia + 真实路由表 + 真实守卫（复刻 router/index.ts 的装配方式） */
function freshRouter(): Router {
  setActivePinia(createPinia())
  const router = createRouter({ history: createMemoryHistory(), routes })
  installAuthGuard(router)
  return router
}

/** 让环境进入「已配置 Supabase」的云端模式 */
function useCloudMode() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
}

beforeEach(() => {
  localStorage.clear()
  resetAuthApiStub()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  localStorage.clear()
})

describe('认证链路端到端（已配置 Supabase）', () => {
  it('未登录访问受保护页：重定向登录页，并带上原目标做回跳', async () => {
    useCloudMode()
    const router = freshRouter()

    await router.push('/todos')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/todos')
  })

  it('登录成功后回到原目标页（redirect 参数被 Login 页消费）', async () => {
    useCloudMode()
    const router = freshRouter()

    await router.push('/stats')
    expect(router.currentRoute.value.query.redirect).toBe('/stats')

    // 模拟登录成功：store 拿到用户
    authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
    const authStore = useAuthStore()
    await authStore.signIn('zhang@example.com', 'secret123')
    expect(authStore.isAuthed).toBe(true)

    // 登录页拿着 redirect 回跳
    const redirect = String(router.currentRoute.value.query.redirect)
    await router.push(redirect)
    expect(router.currentRoute.value.name).toBe('stats')
  })

  it('刷新页面（已有会话）：直接放行，不闪跳登录页', async () => {
    useCloudMode()
    authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
    const router = freshRouter()
    const authStore = useAuthStore()

    // main.ts 的启动顺序：先恢复会话再挂载 → 这里等价于「恢复完成后再导航」
    await authStore.init()
    expect(authStore.isAuthed).toBe(true)

    await router.push('/settings')
    expect(router.currentRoute.value.name).toBe('settings')
    expect(router.currentRoute.value.query.redirect).toBeUndefined()
  })

  it('初始 status 是 loading，守卫会等会话恢复完再判定（不会先踢去登录页）', async () => {
    useCloudMode()
    authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
    const router = freshRouter()
    const authStore = useAuthStore()

    // 注意：这里**不**手动 init，交给守卫内部的 ensureReady() 去恢复
    expect(authStore.status).toBe('loading')

    await router.push('/todos')
    expect(authStore.status).toBe('authed')
    expect(router.currentRoute.value.name).toBe('todos')
  })

  it('登出后再访问受保护页：重新被拦到登录页', async () => {
    useCloudMode()
    authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
    const router = freshRouter()
    const authStore = useAuthStore()
    await authStore.init()

    await router.push('/todos')
    expect(router.currentRoute.value.name).toBe('todos')

    await authStore.signOut()
    expect(authStore.isAuthed).toBe(false)

    await router.push('/stats')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/stats')
  })

  it('已登录访问登录页：被送回仪表板，而不是停在登录页', async () => {
    useCloudMode()
    authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
    const router = freshRouter()
    await useAuthStore().init()

    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('未登录也访问登录页 / 重置密码页：公开路由直接放行', async () => {
    useCloudMode()
    const router = freshRouter()

    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('login')

    await router.push('/reset-password')
    expect(router.currentRoute.value.name).toBe('resetPassword')
  })

  it('外站 redirect 不被采信（防开放重定向）', async () => {
    useCloudMode()
    authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
    const router = freshRouter()
    await useAuthStore().init()

    await router.push('/login?redirect=https://evil.example.com')
    // 已登录时守卫把非法 redirect 丢弃，回仪表板
    expect(router.currentRoute.value.name).toBe('dashboard')
  })
})

describe('未配置 Supabase（本地模式）的整条链路', () => {
  it('不做任何重定向，四个页面都直接可用', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const router = freshRouter()

    for (const path of ['/', '/todos', '/stats', '/settings']) {
      await router.push(path)
      expect(router.currentRoute.value.name).not.toBe('login')
    }
    expect(authApiStub.getCurrentSessionUser).not.toHaveBeenCalled()
  })

  it('未知路径回到仪表板（而不是白屏）', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    const router = freshRouter()

    await router.push('/not-exist-page')
    expect(router.currentRoute.value.name).toBe('dashboard')
  })
})
