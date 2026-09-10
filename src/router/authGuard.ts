/**
 * 路由守卫：登录保护 + 会话恢复
 *
 * 三个关键点：
 * 1. **先恢复会话再判断**：刷新页面时 `getSession()` 是异步的，如果不等它回来就判「未登录」，
 *    已登录用户会被踢到登录页再弹回来（经典闪跳）。所以每个导航前都 `await ensureReady()`。
 * 2. **未配置 Supabase 不拦人**：没有云配置就没有「登录」这回事，此时应用跑在本地模式，
 *    所有页面直接放行——否则用户会被锁在一个永远登不进去的登录页上。
 * 3. **回跳参数只认站内绝对路径**：`?redirect=//evil.com` 这类开放重定向必须挡掉，
 *    否则登录后会被跳到外站（钓鱼常用手法）。
 */

import type { NavigationGuardWithThis, RouteLocationNormalized, Router } from 'vue-router'

import { isSupabaseConfigured } from '@/api/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * 解析回跳地址：只接受以单个 `/` 开头的站内路径。
 * `//evil.com`、`https://evil.com`、相对路径一律丢弃。
 */
export function parseRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

/** 守卫依赖（可注入，便于单测不依赖真实 store） */
export interface AuthGuardDeps {
  /** 等待会话恢复完成 */
  ensureReady: () => Promise<void>
  /** 当前是否已登录 */
  isAuthed: () => boolean
  /** 是否需要登录（配置了 Supabase 才需要） */
  isAuthRequired: () => boolean
}

/** 生成守卫函数 */
export function createAuthGuard(deps: AuthGuardDeps): NavigationGuardWithThis<undefined> {
  return async (to: RouteLocationNormalized) => {
    // 守卫必须等会话恢复完再判断，否则刷新会闪跳登录页
    await deps.ensureReady()

    const isPublic = to.meta.public === true
    const target = parseRedirect(to.query.redirect)

    // 本地模式：没有云配置就没有登录环节，一律放行
    if (!deps.isAuthRequired()) return true

    if (isPublic) {
      // 已登录还去登录页：直接送回目标页（或仪表板）
      if (to.name === 'login' && deps.isAuthed()) return target ?? { name: 'dashboard' }
      return true
    }

    if (deps.isAuthed()) return true
    // 未登录：带上原目标，登录成功后回跳
    return { name: 'login', query: { redirect: to.fullPath } }
  }
}

/** 默认依赖：读真实 authStore / 环境配置 */
export function defaultAuthGuardDeps(): AuthGuardDeps {
  return {
    ensureReady: () => useAuthStore().ensureReady(),
    isAuthed: () => useAuthStore().isAuthed,
    isAuthRequired: () => isSupabaseConfigured(),
  }
}

/** 装到 router 上 */
export function installAuthGuard(
  router: Router,
  deps: AuthGuardDeps = defaultAuthGuardDeps(),
): void {
  router.beforeEach(createAuthGuard(deps))
}
