import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'

/** 头像 composable 的桩（组件里只用到展示地址与首字母兜底） */
const avatarStub = vi.hoisted(() => ({
  displayUrl: null as unknown,
  fallbackInitial: null as unknown,
}))

vi.mock('@/api/auth', async () => (await import('@/test/authApiStub')).authApiStub)
vi.mock('@/api/todoRemote', () => ({
  fetchRemoteTodos: vi.fn(async () => []),
  pushRemoteTodos: vi.fn(async () => {}),
  deleteRemoteTodos: vi.fn(async () => {}),
  clearRemoteTodos: vi.fn(async () => {}),
}))
vi.mock('@/composables/useAvatar', () => ({
  useAvatar: () => ({
    displayUrl: avatarStub.displayUrl,
    saving: ref(false),
    fallbackInitial: avatarStub.fallbackInitial,
    saveAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    loadLocalAvatar: vi.fn(async () => {}),
    hasAvatar: ref(false),
    error: ref(''),
    dispose: vi.fn(),
  }),
}))

import { authApiStub, resetAuthApiStub, AUTH_TEST_USER } from '@/test/authApiStub'
import { useAuthStore } from '@/stores/authStore'
import { useTodoStore } from '@/stores/todoStore'
import SidebarNav from './SidebarNav.vue'

const TEST_ROUTES = [
  { path: '/', name: 'dashboard', component: { template: '<div />' } },
  { path: '/todos', name: 'todos', component: { template: '<div />' } },
  { path: '/stats', name: 'stats', component: { template: '<div />' } },
  { path: '/settings', name: 'settings', component: { template: '<div />' } },
  { path: '/login', name: 'login', component: { template: '<div />' } },
]

async function mountSidebar(options: { path?: string; collapsed?: boolean } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes: TEST_ROUTES })
  await router.push(options.path ?? '/todos')
  await router.isReady()

  const wrapper = mount(SidebarNav, {
    props: { collapsed: options.collapsed ?? false },
    global: { plugins: [pinia, router] },
  })
  await nextTick()
  return { wrapper, router }
}

describe('SidebarNav', () => {
  beforeEach(() => {
    resetAuthApiStub()
    // 显式清空而不是 unstubAllEnvs：后者会把开发机 .env.local 的真实配置读回来
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    localStorage.clear()
    avatarStub.displayUrl = ref('')
    avatarStub.fallbackInitial = ref('张三')
  })

  /** 模拟「已配置 Supabase」，否则 store 会直接判定为本地模式（不会去读会话） */
  function configureSupabase() {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  }

  it('渲染品牌、4 个导航项与姓名首字母兜底', async () => {
    const { wrapper } = await mountSidebar()

    expect(wrapper.text()).toContain('Vue 3 智能工作台')
    expect(wrapper.text()).toContain('仪表板')
    expect(wrapper.text()).toContain('任务')
    expect(wrapper.text()).toContain('统计')
    expect(wrapper.text()).toContain('设置')
    expect(wrapper.find('[data-testid="sidebar-avatar"]').text()).toBe('张三')
  })

  it('导航项指向对应路由，当前路由高亮', async () => {
    const { wrapper, router } = await mountSidebar({ path: '/stats' })

    const statsLink = wrapper.find('[data-testid="sidebar-nav-stats"]')
    expect(statsLink.attributes('href')).toBe('/stats')
    expect(statsLink.classes().join(' ')).toContain('bg-[var(--el-color-primary)]')

    // 非当前页不抢高亮
    const todosLink = wrapper.find('[data-testid="sidebar-nav-todos"]')
    expect(todosLink.classes().join(' ')).not.toContain('bg-[var(--el-color-primary)]')
    expect(router.currentRoute.value.name).toBe('stats')
  })

  it('折叠成 icon rail：只留图标与折叠按钮，品牌文案隐藏', async () => {
    const { wrapper } = await mountSidebar({ collapsed: true })

    expect(wrapper.find('[data-testid="sidebar"]').classes()).toContain('w-16')
    expect(wrapper.text()).not.toContain('仪表板')
    expect(wrapper.text()).not.toContain('Vue 3 智能工作台')
    expect(wrapper.find('[data-testid="sidebar-nav-dashboard"]').exists()).toBe(true)
  })

  it('展开时宽度是 240px，点折叠按钮向上抛事件', async () => {
    const { wrapper } = await mountSidebar({ collapsed: false })

    expect(wrapper.find('[data-testid="sidebar"]').classes()).toContain('w-60')
    await wrapper.find('[data-testid="sidebar-collapse"]').trigger('click')

    expect(wrapper.emitted('toggle-collapse')).toHaveLength(1)
  })

  it('未登录：显示「登录 / 注册」入口与本地模式提示', async () => {
    const { wrapper } = await mountSidebar()
    await useAuthStore().init()
    await nextTick()

    expect(wrapper.find('[data-testid="sidebar-sign-in"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sidebar-sign-out"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('本地访客')
  })

  it('已登录：显示昵称/邮箱、同步状态与退出按钮', async () => {
    configureSupabase()
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
    await authStore.init()
    // 激活云同步后侧边栏才会出现同步角标
    await useTodoStore().activateCloud(AUTH_TEST_USER.id)

    const router = createRouter({ history: createMemoryHistory(), routes: TEST_ROUTES })
    await router.push('/todos')
    const wrapper = mount(SidebarNav, {
      props: { collapsed: false },
      global: { plugins: [pinia, router] },
    })
    await nextTick()

    expect(wrapper.text()).toContain('张三')
    expect(wrapper.text()).toContain('zhang@example.com')
    expect(wrapper.find('[data-testid="sidebar-sign-out"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('云同步 · 已同步')
  })

  it('点退出登录：调用 signOut 并跳回登录页', async () => {
    configureSupabase()
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
    await authStore.init()

    const router = createRouter({ history: createMemoryHistory(), routes: TEST_ROUTES })
    await router.push('/todos')
    const wrapper = mount(SidebarNav, {
      props: { collapsed: false },
      global: { plugins: [pinia, router] },
    })
    await nextTick()

    await wrapper.find('[data-testid="sidebar-sign-out"]').trigger('click')
    await flushPromises()

    expect(authApiStub.signOutUser).toHaveBeenCalled()
    expect(authStore.isAuthed).toBe(false)
    expect(router.currentRoute.value.name).toBe('login')
  })
})
