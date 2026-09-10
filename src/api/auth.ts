/**
 * 认证 API 封装（Supabase Auth）
 *
 * 设计：全部函数 **不抛异常**，统一返回 `AuthResult`（`{ ok, message }`），
 * message 是可直接展示给用户的中文文案——组件里不用再写一层 try/catch + 文案映射。
 * 需要「返回值」的读取类接口（当前会话、订阅登录态）才可能抛错，由 store 兜住。
 */

import type { AuthResult, AuthUser, SignUpPayload } from '@/types/auth'
import {
  SupabaseUnavailableError,
  getSupabaseClient,
  isSupabaseConfigured,
  requireSupabaseClient,
} from './supabase'

/** Supabase user 的最小子集（结构类型，便于单测传普通对象） */
export interface SupabaseUserLike {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
  app_metadata?: { provider?: string } | null
}

/** 取元数据里第一个非空字符串 */
function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return ''
}

/** 邮箱前缀（`zhang@x.com` → `zhang`） */
export function emailPrefix(email: string): string {
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
}

/**
 * 把 Supabase user 归一化成应用内的 `AuthUser`（纯函数）。
 * 展示名优先级：display_name → full_name / name / user_name → 邮箱前缀 → 「未命名用户」；
 * 头像优先用我们上传的 `avatar_url`，GitHub OAuth 登录时 Supabase 也会带上 GitHub 头像。
 */
export function toAuthUser(user: SupabaseUserLike | null | undefined): AuthUser | null {
  if (!user || !user.id) return null

  const email = typeof user.email === 'string' ? user.email : ''
  const meta = user.user_metadata ?? {}
  const displayName =
    firstString(meta.display_name, meta.full_name, meta.name, meta.user_name) ||
    (email ? emailPrefix(email) : '') ||
    '未命名用户'

  return {
    id: user.id,
    email,
    displayName,
    avatarUrl: firstString(meta.avatar_url),
    provider: firstString(user.app_metadata?.provider) || 'email',
  }
}

/**
 * 把各种原始错误翻译成用户能看懂的中文。
 * Supabase 的错误信息是英文的，直接抛给用户体验很差，这里做一层映射。
 */
export function describeAuthError(error: unknown): string {
  if (error instanceof SupabaseUnavailableError) return error.message
  if (!error) return '认证失败，请稍后重试'

  const raw = typeof error === 'string' ? error : ((error as Error).message ?? '')
  const text = raw.toLowerCase()

  if (text.includes('invalid login credentials')) return '邮箱或密码不正确'
  if (text.includes('email not confirmed')) return '邮箱尚未验证，请先查收验证邮件'
  if (text.includes('already registered') || text.includes('already been registered'))
    return '该邮箱已注册，请直接登录'
  if (text.includes('password should be at least')) return '密码至少 6 位'
  if (text.includes('unable to validate email') || text.includes('invalid email'))
    return '邮箱格式不正确'
  if (text.includes('signups not allowed') || text.includes('signup is disabled'))
    return '当前项目已关闭注册，请使用已有账号登录'
  if (text.includes('rate limit') || text.includes('too many requests'))
    return '操作过于频繁，请稍后再试'
  if (text.includes('failed to fetch') || text.includes('networkerror'))
    return '网络不可用，请检查网络后重试'

  return raw || '认证失败，请稍后重试'
}

/** 统一包装成 AuthResult */
function failure(error: unknown): AuthResult {
  return { ok: false, message: describeAuthError(error) }
}

/** 邮箱注册（成功后若开启邮箱验证，则没有会话，需要去邮箱确认） */
export async function signUpWithPassword(payload: SignUpPayload): Promise<AuthResult> {
  try {
    const client = requireSupabaseClient()
    const { data, error } = await client.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: { display_name: payload.displayName },
        emailRedirectTo: typeof location !== 'undefined' ? location.origin : undefined,
      },
    })
    if (error) return failure(error)

    if (data.session) return { ok: true, message: '注册成功，已自动登录' }
    return {
      ok: true,
      message: '注册成功，请到邮箱完成验证后再登录',
      needsEmailConfirm: true,
    }
  } catch (error) {
    return failure(error)
  }
}

/** 邮箱密码登录 */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const client = requireSupabaseClient()
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) return failure(error)
    return { ok: true, message: '登录成功' }
  } catch (error) {
    return failure(error)
  }
}

/** GitHub OAuth 登录（会跳转到 GitHub 授权页，回来时由 detectSessionInUrl 自动换会话） */ export async function signInWithGitHub(
  redirectTo?: string,
): Promise<AuthResult> {
  try {
    const client = requireSupabaseClient()
    const { error } = await client.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectTo ?? (typeof location !== 'undefined' ? location.href : undefined),
      },
    })
    if (error) return failure(error)
    return { ok: true, message: '正在跳转 GitHub 授权…' }
  } catch (error) {
    return failure(error)
  }
}

/**
 * 重新发送注册验证邮件。
 *
 * 为什么必须有：开启「Confirm email」时，验证信走的是邮件通道，慢或进垃圾箱是常态。
 * 没有重发入口，用户只能干等，或者再点一次注册——而后者会得到「该邮箱已注册」，
 * 反而更懵。这里的错误也要翻译好：Supabase 对发信有频率限制，
 * 连续点会返回 rate limit，得明确告诉用户「过一会儿再试」。
 */
export async function resendConfirmEmail(email: string, redirectTo?: string): Promise<AuthResult> {
  try {
    const client = requireSupabaseClient()
    const { error } = await client.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo:
          redirectTo ?? (typeof location !== 'undefined' ? location.origin : undefined),
      },
    })
    if (error) return failure(error)
    return { ok: true, message: '验证邮件已重新发送，请稍候查收' }
  } catch (error) {
    return failure(error)
  }
}

/** 退出登录 */
export async function signOutUser(): Promise<AuthResult> {
  try {
    const client = requireSupabaseClient()
    const { error } = await client.auth.signOut()
    if (error) return failure(error)
    return { ok: true, message: '已退出登录' }
  } catch (error) {
    return failure(error)
  }
}

/** 读取当前会话（刷新页面时恢复登录态）；未配置时直接返回 null */
export async function getCurrentSessionUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) return null
  const client = requireSupabaseClient()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return toAuthUser(data.session?.user as SupabaseUserLike | null | undefined)
}

/**
 * 订阅登录态变化（token 刷新、登出、OAuth 回跳都会触发）。
 * 返回取消订阅函数；未配置时返回空函数。
 */
export function subscribeAuthChanges(onChange: (user: AuthUser | null) => void): () => void {
  const client = getSupabaseClient()
  if (!client) return () => {}

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    onChange(toAuthUser(session?.user as SupabaseUserLike | null | undefined))
  })
  return () => data.subscription.unsubscribe()
}

/** 把头像地址写回 user_metadata（跨设备同步头像 URL） */
export async function updateAvatarMetadata(avatarUrl: string): Promise<AuthResult> {
  try {
    const client = requireSupabaseClient()
    const { error } = await client.auth.updateUser({ data: { avatar_url: avatarUrl } })
    if (error) return failure(error)
    return { ok: true, message: '头像已更新' }
  } catch (error) {
    return failure(error)
  }
}
