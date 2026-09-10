import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SUPABASE_SETUP_HINT,
  SupabaseUnavailableError,
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
    vi.unstubAllEnvs()
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
