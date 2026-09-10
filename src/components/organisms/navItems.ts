/**
 * 导航项定义（桌面端侧边栏与移动端底部导航共用一份）
 * 两处各写一遍很容易改一处漏一处，抽出来当唯一数据源。
 */

/** 导航项的路由名（字面量联合：`route.meta.title` 与 `{ name }` 跳转都能拿到类型提示） */
export type NavRouteName = 'dashboard' | 'todos' | 'stats' | 'settings'

export interface NavItem {
  /** 路由名（router-link 用 { name } 跳转，避免手写路径） */
  name: NavRouteName
  label: string
  icon: string
}

/**
 * 侧边栏主导航（内容页）：设置**不在其中**——
 * 它属于「配置」而不是「内容」，放在侧栏底部独立区，和退出登录在一起。
 */
export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { name: 'dashboard', label: '仪表板', icon: '🏠' },
  { name: 'todos', label: '任务', icon: '✅' },
  { name: 'stats', label: '统计', icon: '📊' },
]

/** 设置项（侧栏底部独立区用） */
export const SETTINGS_NAV_ITEM: NavItem = { name: 'settings', label: '设置', icon: '⚙️' }

/** 全部导航项（移动端底部导航用：手机上没有"底部独立区"的说法，4 个平铺更直观） */
export const NAV_ITEMS: readonly NavItem[] = [...PRIMARY_NAV_ITEMS, SETTINGS_NAV_ITEM]
