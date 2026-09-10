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

export const NAV_ITEMS: readonly NavItem[] = [
  { name: 'dashboard', label: '仪表板', icon: '🏠' },
  { name: 'todos', label: '任务', icon: '✅' },
  { name: 'stats', label: '统计', icon: '📊' },
  { name: 'settings', label: '设置', icon: '⚙️' },
]
