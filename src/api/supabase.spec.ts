import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import {
  SUPABASE_SETUP_HINT,
  SupabaseUnavailableError,
  checkSupabaseConnection,
  fetchAuthProviders,
  getSupabaseClient,
  isSupabaseConfigured,
  readSupabaseEnv,
  requireSupabaseClient,
  resetSupabaseClient,
} from './supabase'

/** 用桩替换真正的 createClient：这里只验证「何时创建、是否复用」，不发任何请求 */
const createClientMock = vi.hoisted(() => vi.fn(() => ({ kind: 'client' })))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

describe('Supabase 配置读取与客户端单例', () => {
  beforeEach(() => {
    // 显式清空而不是 unstubAllEnvs：后者会把开发机 .env.local 的真实配置读回来
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    resetSupabaseClient()
    createClientMock.mockClear()
  })

  it('未配置时读取到空串，且判定为未配置', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(readSupabaseEnv()).toEqual({ url: '', anonKey: '' })
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('只填一半视为未配置（避免半配置状态下白屏）', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('配置齐全后（含首尾空格）判定为已配置', () => {
    vi.stubEnv('VITE_SUPABASE_URL', ' https://demo.supabase.co ')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', ' anon-key ')
    expect(readSupabaseEnv()).toEqual({ url: 'https://demo.supabase.co', anonKey: 'anon-key' })
    expect(isSupabaseConfigured()).toBe(true)
  })

  it('未配置时 getSupabaseClient 返回 null，requireSupabaseClient 抛引导错误', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    expect(getSupabaseClient()).toBeNull()
    expect(() => requireSupabaseClient()).toThrow(SupabaseUnavailableError)
    try {
      requireSupabaseClient()
    } catch (error) {
      expect((error as Error).message).toBe(SUPABASE_SETUP_HINT)
      expect((error as Error).message).toContain('.env.local')
    }
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('已配置时按需创建并复用客户端（同样的配置只创建一次）', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const first = getSupabaseClient()
    const second = getSupabaseClient()
    expect(first).toBe(second)
    expect(createClientMock).toHaveBeenCalledTimes(1)
    expect(createClientMock).toHaveBeenCalledWith(
      'https://demo.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true }),
      }),
    )
  })

  it('配置变化时重建客户端（换 Supabase 项目不用刷新页面）', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://a.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key-a')
    const first = getSupabaseClient()

    vi.stubEnv('VITE_SUPABASE_URL', 'https://b.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key-b')
    const second = getSupabaseClient()

    expect(second).not.toBe(first)
    expect(createClientMock).toHaveBeenCalledTimes(2)
  })
})

describe('连接自检 checkSupabaseConnection', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('正常：打到 /auth/v1/health 且带上 apikey', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkSupabaseConnection()

    expect(result.ok).toBe(true)
    expect(result.message).toContain('连接正常')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://demo.supabase.co/auth/v1/health',
      expect.objectContaining({ headers: { apikey: 'anon-key' } }),
    )
  })

  it('密钥无效（401）：明确指出是密钥问题而不是网络问题', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401 })),
    )

    const result = await checkSupabaseConnection()

    expect(result.ok).toBe(false)
    expect(result.message).toContain('密钥无效')
    expect(result.detail).toContain('401')
  })

  it('HTTP 异常状态：原样报出状态码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    )
    const result = await checkSupabaseConnection()
    expect(result.ok).toBe(false)
    expect(result.detail).toContain('503')
  })

  it('域名解析不了（fetch 直接抛错）：提示多半是 Project URL 抄错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const result = await checkSupabaseConnection()

    expect(result.ok).toBe(false)
    expect(result.message).toContain('Project URL')
    // 把实际请求地址摊出来，方便对着 .env.local 核对
    expect(result.detail).toContain('https://demo.supabase.co/auth/v1/health')
  })

  it('超时（AbortError）：提示超时', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      }),
    )

    const result = await checkSupabaseConnection()
    expect(result.message).toContain('超时')
  })

  it('未配置时不发请求，直接给配置引导', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkSupabaseConnection()

    expect(result.ok).toBe(false)
    expect(result.message).toContain('本地模式')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('读取服务端开启的登录方式 fetchAuthProviders', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('按 /auth/v1/settings 的 external 字段返回', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ external: { email: true, github: false } }),
      })),
    )

    expect(await fetchAuthProviders()).toEqual({ email: true, github: false })
  })

  it('github 开启时返回 true；external 里没写 email 时按开启处理（它是主流程）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ external: { github: true } }) })),
    )

    expect(await fetchAuthProviders()).toEqual({ email: true, github: true })
  })

  it('请求失败 / 抛错都返回 null（调用方按「未知」处理，按钮照常显示）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    )
    expect(await fetchAuthProviders()).toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(await fetchAuthProviders()).toBeNull()
  })

  it('未配置 Supabase 时不发请求', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchAuthProviders()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
