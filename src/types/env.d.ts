/** 环境变量类型声明（`.env.local` 中的值由 Vite 注入 `import.meta.env`） */

interface ImportMetaEnv {
  /** 高德地图「Web服务」Key（天气功能） */
  readonly VITE_AMAP_KEY?: string
  /** Supabase 项目地址，如 https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon（公开）Key —— 权限由数据库 RLS 兜底，泄露也无法越权读写 */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
