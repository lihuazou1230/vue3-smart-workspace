/**
 * Supabase 客户端（单例）
 *
 * 三个关键点：
 * 1. **按需创建**：只有 `.env.local` 里配好 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
 *    才会创建客户端；缺失时返回 null，应用降级为「本地模式」而不是白屏报错。
 * 2. **每次读 env**：配置在模块加载时读死会让测试无法切换「已配置 / 未配置」两条路径，
 *    所以统一走 `readSupabaseEnv()`，配置变化时重建客户端（缓存 key 比对）。
 * 3. **会话持久化交给 supabase-js**：`persistSession` + `autoRefreshToken` +
 *    `detectSessionInUrl`（GitHub OAuth 回调地址里带的 token 由它自动换会话）。
 */

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/** 未配置 Supabase 时给用户的引导文案（登录页 / 设置页共用） */
export const SUPABASE_SETUP_HINT =
  '尚未配置 Supabase：请在项目根目录 `.env.local` 填入 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，' +
  '并在 Supabase SQL Editor 执行 `supabase/schema.sql`'

/** Supabase 数据表名（集中一处，避免各文件写裸字符串） */
export const SUPABASE_TABLES = {
  todos: 'todos',
} as const

/** 环境变量读取结果 */
export interface SupabaseEnv {
  url: string
  anonKey: string
}

/** 缺配置时抛出的标识性错误（UI 层据此给出引导文案，而不是暴露原始报错） */
export class SupabaseUnavailableError extends Error {
  constructor(message: string = SUPABASE_SETUP_HINT) {
    super(message)
    this.name = 'SupabaseUnavailableError'
  }
}

/** 读取 Supabase 相关环境变量（已 trim，空串视为未配置） */
export function readSupabaseEnv(): SupabaseEnv {
  const env = import.meta.env ?? {}
  return {
    url: String(env.VITE_SUPABASE_URL ?? '').trim(),
    anonKey: String(env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
  }
}

/** 是否已配置 Supabase（决定应用跑在 cloud 还是 local 模式） */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = readSupabaseEnv()
  return url !== '' && anonKey !== ''
}

let client: SupabaseClient | null = null
/** 已建客户端对应的配置指纹（配置变了要重建） */
let clientFingerprint = ''

/**
 * 取 Supabase 客户端；未配置时返回 null（调用方走降级分支）。
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null

  const { url, anonKey } = readSupabaseEnv()
  const fingerprint = `${url}::${anonKey}`
  if (!client || clientFingerprint !== fingerprint) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
    clientFingerprint = fingerprint
  }
  return client
}

/** 取 Supabase 客户端；未配置时抛出带引导文案的错误（写操作入口用） */
export function requireSupabaseClient(): SupabaseClient {
  const resolved = getSupabaseClient()
  if (!resolved) throw new SupabaseUnavailableError()
  return resolved
}

/** 清空单例（测试与「切换 Supabase 项目」场景用） */
export function resetSupabaseClient(): void {
  client = null
  clientFingerprint = ''
}
