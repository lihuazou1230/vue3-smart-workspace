import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SupabaseUnavailableError } from './supabase'

/**
 * 认证 API 单测：把 supabase 客户端整块换成桩，
 * 这样能在不联网、不建真项目的前提下覆盖「成功 / 失败 / 未配置」三条路径。
 */
const holder = vi.hoisted(() => ({ client: null as unknown }))

vi.mock('./supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./supabase')>()
  return {
    ...actual,
    isSupabaseConfigured: () => holder.client !== null,
    getSupabaseClient: () => holder.client,
    requireSupabaseClient: () => {
      if (!holder.client) throw new actual.SupabaseUnavailableError()
      return holder.client
    },
  }
})

import {
  describeAuthError,
  emailPrefix,
  getCurrentSessionUser,
  resendConfirmEmail,
  signInWithGitHub,
  signInWithPassword,
  signOutUser,
  signUpWithPassword,
  subscribeAuthChanges,
  toAuthUser,
  updateAvatarMetadata,
} from './auth'

/** 造一个 auth 桩：默认全部成功，用例按需覆盖具体方法 */
function fakeClient(overrides: Record<string, unknown> = {}) {
  const auth = {
    signUp: vi.fn(async () => ({ data: { session: null }, error: null as unknown })),
    signInWithPassword: vi.fn(async () => ({ data: { session: {} }, error: null as unknown })),
    signInWithOAuth: vi.fn(async () => ({
      data: { url: 'https://github.com/login' },
      error: null as unknown,
    })),
    signOut: vi.fn(async () => ({ data: {}, error: null as unknown })),
    resend: vi.fn(async () => ({ data: {}, error: null as unknown })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null as unknown })),
    updateUser: vi.fn(async () => ({ data: { user: {} }, error: null as unknown })),
    onAuthStateChange: vi.fn<
      (cb: (event: string, session: unknown) => void) => {
        data: { subscription: { unsubscribe: () => void } }
      }
    >(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
  Object.assign(auth, overrides)
  return { auth }
}

describe('toAuthUser（Supabase user → 应用用户模型）', () => {
  it('优先用 display_name，并保留头像与登录方式', () => {
    expect(
      toAuthUser({
        id: 'u1',
        email: 'zhang@example.com',
        user_metadata: { display_name: '张三', avatar_url: 'https://x/a.webp?v=1' },
        app_metadata: { provider: 'github' },
      }),
    ).toEqual({
      id: 'u1',
      email: 'zhang@example.com',
      displayName: '张三',
      avatarUrl: 'https://x/a.webp?v=1',
      provider: 'github',
    })
  })

  it('没有 display_name 时依次回退 full_name / name / user_name', () => {
    const base = { id: 'u1', email: 'a@b.com' }
    expect(toAuthUser({ ...base, user_metadata: { full_name: 'Alice Zhang' } })?.displayName).toBe(
      'Alice Zhang',
    )
    expect(toAuthUser({ ...base, user_metadata: { name: 'Bob' } })?.displayName).toBe('Bob')
    expect(toAuthUser({ ...base, user_metadata: { user_name: 'carol' } })?.displayName).toBe(
      'carol',
    )
  })

  it('元数据全空时回退邮箱前缀，最后回退「未命名用户」', () => {
    expect(toAuthUser({ id: 'u1', email: 'zhang@example.com' })?.displayName).toBe('zhang')
    expect(toAuthUser({ id: 'u1', email: '' })?.displayName).toBe('未命名用户')
  })

  it('头像与登录方式缺失时有默认值', () => {
    const user = toAuthUser({ id: 'u1', email: 'a@b.com' })
    expect(user?.avatarUrl).toBe('')
    expect(user?.provider).toBe('email')
  })

  it('空 user 返回 null', () => {
    expect(toAuthUser(null)).toBeNull()
    expect(toAuthUser(undefined)).toBeNull()
    expect(toAuthUser({ id: '' })).toBeNull()
  })

  it('emailPrefix 处理异常邮箱', () => {
    expect(emailPrefix('zhang@example.com')).toBe('zhang')
    expect(emailPrefix('no-at-sign')).toBe('no-at-sign')
  })
})

describe('describeAuthError（英文报错 → 中文文案）', () => {
  it('映射常见错误', () => {
    expect(describeAuthError(new Error('Invalid login credentials'))).toBe('邮箱或密码不正确')
    expect(describeAuthError(new Error('Email not confirmed'))).toBe(
      '邮箱尚未验证，请先查收验证邮件',
    )
    expect(describeAuthError(new Error('User already registered'))).toBe('该邮箱已注册，请直接登录')
    expect(describeAuthError(new Error('Password should be at least 6 characters'))).toBe(
      '密码至少 6 位',
    )
    expect(describeAuthError(new Error('email rate limit exceeded'))).toBe(
      '操作过于频繁，请稍后再试',
    )
    expect(describeAuthError(new Error('Failed to fetch'))).toBe('网络不可用，请检查网络后重试')
  })

  it('发信失败翻译成可操作的中文（真凶往往是收件邮箱不存在）', () => {
    // GoTrue 对「SMTP 拒收」统一报这个英文错误，用户看不出问题在哪
    expect(describeAuthError(new Error('Error sending confirmation email'))).toContain(
      '邮箱真实存在',
    )
    expect(describeAuthError(new Error('Error sending recovery email'))).toContain('邮箱真实存在')
    expect(describeAuthError(new Error('Error sending magic link email'))).toContain('邮件发送失败')
  })

  it('未配置 Supabase 时给出配置引导', () => {
    expect(describeAuthError(new SupabaseUnavailableError())).toContain('.env.local')
  })

  it('未知错误原样返回，空错误给兜底文案', () => {
    expect(describeAuthError(new Error('boom'))).toBe('boom')
    expect(describeAuthError(null)).toBe('认证失败，请稍后重试')
  })
})

describe('认证动作（未配置 Supabase 时不抛错，只返回失败结果）', () => {
  beforeEach(() => {
    holder.client = null
  })

  it('未配置时登录/注册/登出/改头像都返回引导文案', async () => {
    const results = await Promise.all([
      signInWithPassword('a@b.com', '123456'),
      signUpWithPassword({ email: 'a@b.com', password: '123456', displayName: '张三' }),
      signInWithGitHub(),
      signOutUser(),
      updateAvatarMetadata('https://x/a.webp'),
    ])
    for (const result of results) {
      expect(result.ok).toBe(false)
      expect(result.message).toContain('.env.local')
    }
  })

  it('未配置时读会话返回 null，订阅返回空函数', async () => {
    expect(await getCurrentSessionUser()).toBeNull()
    expect(() => subscribeAuthChanges(() => {})()).not.toThrow()
  })
})

describe('认证动作（已配置）', () => {
  beforeEach(() => {
    holder.client = fakeClient()
  })

  it('注册：开启邮箱验证时提示去邮箱确认', async () => {
    const result = await signUpWithPassword({
      email: 'a@b.com',
      password: '123456',
      displayName: '张三',
    })
    expect(result).toMatchObject({ ok: true, needsEmailConfirm: true })
    const client = holder.client as ReturnType<typeof fakeClient>
    expect(client.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@b.com',
        password: '123456',
        options: expect.objectContaining({ data: { display_name: '张三' } }),
      }),
    )
  })

  it('注册：直接拿到会话时提示已自动登录', async () => {
    holder.client = fakeClient({
      signUp: vi.fn(async () => ({ data: { session: { access_token: 't' } }, error: null })),
    })
    const result = await signUpWithPassword({
      email: 'a@b.com',
      password: '123456',
      displayName: '',
    })
    expect(result).toEqual({ ok: true, message: '注册成功，已自动登录' })
  })

  it('注册失败返回中文文案', async () => {
    holder.client = fakeClient({
      signUp: vi.fn(async () => ({
        data: { session: null },
        error: { message: 'User already registered' },
      })),
    })
    expect(
      await signUpWithPassword({ email: 'a@b.com', password: '123456', displayName: '' }),
    ).toEqual({ ok: false, message: '该邮箱已注册，请直接登录' })
  })

  it('登录成功与失败', async () => {
    expect(await signInWithPassword('a@b.com', 'pw')).toEqual({ ok: true, message: '登录成功' })

    holder.client = fakeClient({
      signInWithPassword: vi.fn(async () => ({
        data: {},
        error: { message: 'Invalid login credentials' },
      })),
    })
    expect(await signInWithPassword('a@b.com', 'bad')).toEqual({
      ok: false,
      message: '邮箱或密码不正确',
    })
  })

  it('GitHub OAuth：带 redirectTo 时透传给 supabase', async () => {
    const result = await signInWithGitHub('https://app.example.com/login')
    expect(result.ok).toBe(true)
    const client = holder.client as ReturnType<typeof fakeClient>
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: 'https://app.example.com/login' },
    })
  })

  it('退出登录调用 signOut', async () => {
    expect(await signOutUser()).toEqual({ ok: true, message: '已退出登录' })
    const client = holder.client as ReturnType<typeof fakeClient>
    expect(client.auth.signOut).toHaveBeenCalled()
  })

  it('读取会话：把 session.user 归一化', async () => {
    holder.client = fakeClient({
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'u1', email: 'a@b.com', user_metadata: { name: 'A' } } } },
        error: null,
      })),
    })
    expect(await getCurrentSessionUser()).toMatchObject({ id: 'u1', displayName: 'A' })
  })

  it('读取会话失败时抛错（由 store 兜住）', async () => {
    holder.client = fakeClient({
      getSession: vi.fn(async () => ({
        data: { session: null },
        error: { message: 'network down' },
      })),
    })
    await expect(getCurrentSessionUser()).rejects.toMatchObject({ message: 'network down' })
  })

  it('订阅登录态变化：事件回调带归一化用户，取消订阅可用', () => {
    const unsubscribe = vi.fn()
    // 桩在订阅瞬间同步回调一次（模拟 SIGNED_IN），再换一个桩模拟 SIGNED_OUT
    holder.client = fakeClient({
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        cb('SIGNED_IN', { user: { id: 'u1', email: 'a@b.com', user_metadata: {} } })
        return { data: { subscription: { unsubscribe } } }
      }),
    })

    const onChange = vi.fn()
    const stop = subscribeAuthChanges(onChange)
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'u1' }))

    const onSignOut = vi.fn()
    holder.client = fakeClient({
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        cb('SIGNED_OUT', null)
        return { data: { subscription: { unsubscribe } } }
      }),
    })
    subscribeAuthChanges(onSignOut)
    expect(onSignOut).toHaveBeenLastCalledWith(null)

    stop()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('重新发送验证邮件：调用 resend(type=signup) 并带上回跳地址', async () => {
    const result = await resendConfirmEmail('zhang@example.com', 'https://app.example.com')

    expect(result).toMatchObject({ ok: true })
    const client = holder.client as ReturnType<typeof fakeClient>
    expect(client.auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'signup',
        email: 'zhang@example.com',
        options: expect.objectContaining({ emailRedirectTo: 'https://app.example.com' }),
      }),
    )
  })

  it('重发遇到频率限制：翻译成中文提示（连续点会被限流）', async () => {
    holder.client = fakeClient({
      resend: vi.fn(async () => ({ data: {}, error: { message: 'email rate limit exceeded' } })),
    })

    expect(await resendConfirmEmail('zhang@example.com')).toEqual({
      ok: false,
      message: '操作过于频繁，请稍后再试',
    })
  })

  it('未配置 Supabase 时重发返回配置引导', async () => {
    holder.client = null
    const result = await resendConfirmEmail('zhang@example.com')
    expect(result.ok).toBe(false)
    expect(result.message).toContain('.env.local')
  })

  it('更新头像元数据成功后透传调用', async () => {
    expect(await updateAvatarMetadata('https://x/a.webp?v=2')).toEqual({
      ok: true,
      message: '头像已更新',
    })
    const client = holder.client as ReturnType<typeof fakeClient>
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      data: { avatar_url: 'https://x/a.webp?v=2' },
    })
  })
})
