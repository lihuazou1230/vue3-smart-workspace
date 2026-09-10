import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import type { AuthResult, AuthUser, SignUpPayload } from '@/types/auth'

/** 认证 API 全部换成桩：这一层只验证 store 的状态流转（按真实签名声明，便于断言调用参数） */
const api = vi.hoisted(() => ({
  describeAuthError: vi.fn<(error: unknown) => string>(),
  getCurrentSessionUser: vi.fn<() => Promise<AuthUser | null>>(),
  signInWithGitHub: vi.fn<(redirectTo?: string) => Promise<AuthResult>>(),
  signInWithPassword: vi.fn<(email: string, password: string) => Promise<AuthResult>>(),
  signOutUser: vi.fn<() => Promise<AuthResult>>(),
  signUpWithPassword: vi.fn<(payload: SignUpPayload) => Promise<AuthResult>>(),
  subscribeAuthChanges: vi.fn<(cb: (user: AuthUser | null) => void) => () => void>(),
  updateAvatarMetadata: vi.fn<(avatarUrl: string) => Promise<AuthResult>>(),
}))

const supabase = vi.hoisted(() => ({ isSupabaseConfigured: vi.fn(() => true) }))

vi.mock('@/api/auth', () => api)
vi.mock('@/api/supabase', () => supabase)

import { useAuthStore } from './authStore'

const SESSION_USER: AuthUser = {
  id: 'u1',
  email: 'zhang@example.com',
  displayName: '张三',
  avatarUrl: 'https://x/a.webp?v=1',
  provider: 'github',
}

function configured(value: boolean) {
  supabase.isSupabaseConfigured.mockReturnValue(value)
}

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configured(true)
    api.describeAuthError.mockImplementation((error) => `err:${String(error)}`)
    api.getCurrentSessionUser.mockResolvedValue(null)
    api.subscribeAuthChanges.mockReturnValue(vi.fn())
    api.signInWithPassword.mockResolvedValue({ ok: true, message: '登录成功' })
    api.signInWithGitHub.mockResolvedValue({ ok: true, message: '正在跳转 GitHub 授权…' })
    api.signOutUser.mockResolvedValue({ ok: true, message: '已退出登录' })
    api.signUpWithPassword.mockResolvedValue({ ok: true, message: '注册成功，已自动登录' })
    api.updateAvatarMetadata.mockResolvedValue({ ok: true, message: '头像已更新' })
    setActivePinia(createPinia())
  })

  it('初始状态是 loading（守卫必须能区分「还没恢复完」与「未登录」）', () => {
    const store = useAuthStore()
    expect(store.status).toBe('loading')
    expect(store.isReady).toBe(false)
    expect(store.isAuthed).toBe(false)
  })

  it('未配置 Supabase：直接进入本地模式，不报错、不阻塞', async () => {
    configured(false)
    const store = useAuthStore()
    await store.init()

    expect(store.mode).toBe('local')
    expect(store.isLocalMode).toBe(true)
    expect(store.status).toBe('guest')
    expect(store.displayName).toBe('本地访客')
    expect(api.getCurrentSessionUser).not.toHaveBeenCalled()
  })

  it('已配置但无会话：恢复为未登录，并订阅登录态变化', async () => {
    const store = useAuthStore()
    await store.init()

    expect(store.mode).toBe('cloud')
    expect(store.status).toBe('guest')
    expect(api.getCurrentSessionUser).toHaveBeenCalledTimes(1)
    expect(api.subscribeAuthChanges).toHaveBeenCalledTimes(1)
  })

  it('刷新页面：用 getSession 恢复已登录状态', async () => {
    api.getCurrentSessionUser.mockResolvedValue(SESSION_USER)
    const store = useAuthStore()
    await store.init()

    expect(store.isAuthed).toBe(true)
    expect(store.displayName).toBe('张三')
    expect(store.email).toBe('zhang@example.com')
    expect(store.avatarUrl).toBe('https://x/a.webp?v=1')
    expect(store.initial).toBe('张三')
  })

  it('会话恢复失败时降级为未登录并记录原因，不抛错', async () => {
    api.getCurrentSessionUser.mockRejectedValue(new Error('network down'))
    const store = useAuthStore()
    await store.init()

    expect(store.status).toBe('guest')
    expect(store.lastError).toBe('err:Error: network down')
  })

  it('init 幂等：并发调用只恢复一次（守卫可放心 await）', async () => {
    const store = useAuthStore()
    await Promise.all([store.init(), store.init(), store.ensureReady()])
    expect(api.getCurrentSessionUser).toHaveBeenCalledTimes(1)
  })

  it('ensureReady 已完成时不再重复恢复', async () => {
    const store = useAuthStore()
    await store.init()
    await store.ensureReady()
    expect(api.getCurrentSessionUser).toHaveBeenCalledTimes(1)
  })

  it('订阅回调更新登录/登出状态', async () => {
    const emitters: Array<(user: AuthUser | null) => void> = []
    api.subscribeAuthChanges.mockImplementation((cb: (user: AuthUser | null) => void) => {
      emitters.push(cb)
      return vi.fn()
    })

    const store = useAuthStore()
    await store.init()
    expect(emitters).toHaveLength(1)
    expect(store.isAuthed).toBe(false)

    emitters.forEach((emit) => emit(SESSION_USER))
    expect(store.isAuthed).toBe(true)
    expect(store.displayName).toBe('张三')

    emitters.forEach((emit) => emit(null))
    expect(store.status).toBe('guest')
  })

  it('登录成功后立即刷新用户（不等 onAuthStateChange）', async () => {
    const store = useAuthStore()
    await store.init()

    api.getCurrentSessionUser.mockResolvedValue(SESSION_USER)
    const result = await store.signIn(' zhang@example.com ', 'pw123456')

    expect(result.ok).toBe(true)
    expect(api.signInWithPassword).toHaveBeenCalledWith('zhang@example.com', 'pw123456')
    expect(store.isAuthed).toBe(true)
  })

  it('登录失败：记录错误文案，状态保持未登录', async () => {
    api.signInWithPassword.mockResolvedValue({ ok: false, message: '邮箱或密码不正确' })
    const store = useAuthStore()
    await store.init()

    const result = await store.signIn('a@b.com', 'bad')

    expect(result).toEqual({ ok: false, message: '邮箱或密码不正确' })
    expect(store.lastError).toBe('邮箱或密码不正确')
    expect(store.isAuthed).toBe(false)
  })

  it('注册：需要邮箱验证时不算登录', async () => {
    api.signUpWithPassword.mockResolvedValue({
      ok: true,
      message: '注册成功，请到邮箱完成验证后再登录',
      needsEmailConfirm: true,
    })
    const store = useAuthStore()
    await store.init()

    const result = await store.signUp({
      email: 'a@b.com',
      password: 'pw123456',
      displayName: ' 李四 ',
    })

    expect(result.needsEmailConfirm).toBe(true)
    expect(api.signUpWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw123456',
      displayName: '李四',
    })
    expect(store.isAuthed).toBe(false)
  })

  it('GitHub 登录透传 redirectTo', async () => {
    const store = useAuthStore()
    await store.init()

    await store.signInWithGithub('https://app.example.com/login?redirect=/todos')
    expect(api.signInWithGitHub).toHaveBeenCalledWith(
      'https://app.example.com/login?redirect=/todos',
    )
  })

  it('退出登录：无论云端结果如何本地都清空（避免卡在疑似登录态）', async () => {
    api.getCurrentSessionUser.mockResolvedValue(SESSION_USER)
    const store = useAuthStore()
    await store.init()
    expect(store.isAuthed).toBe(true)

    api.signOutUser.mockResolvedValue({ ok: false, message: '网络不可用' })
    await store.signOut()

    expect(store.isAuthed).toBe(false)
    expect(store.user).toBeNull()
    expect(store.lastError).toBe('网络不可用')
  })

  it('更新头像地址后本地用户立刻反映新头像', async () => {
    api.getCurrentSessionUser.mockResolvedValue(SESSION_USER)
    const store = useAuthStore()
    await store.init()

    await store.setAvatarUrl('https://x/a.webp?v=2')
    expect(store.avatarUrl).toBe('https://x/a.webp?v=2')

    store.clearLocalAvatar()
    expect(store.avatarUrl).toBe('')
  })

  it('dispose 取消失订阅并允许重新初始化', async () => {
    const unsubscribe = vi.fn()
    api.subscribeAuthChanges.mockReturnValue(unsubscribe)

    const store = useAuthStore()
    await store.init()
    store.dispose()

    expect(unsubscribe).toHaveBeenCalled()
    expect(store.status).toBe('loading')

    await store.init()
    expect(api.getCurrentSessionUser).toHaveBeenCalledTimes(2)
  })
})
