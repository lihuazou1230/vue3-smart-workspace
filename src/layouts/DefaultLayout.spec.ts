import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mount } from '@vue/test-utils'

const avatarStub = vi.hoisted(() => ({
  displayUrl: null as unknown,
  fallbackInitial: null as unknown,
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

import { useTodoStore } from '@/stores/todoStore'
import DefaultLayout from './DefaultLayout.vue'

const Child = { template: '<div data-testid="page-child">子页面</div>' }

const TEST_ROUTES = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', name: 'dashboard', component: Child, meta: { title: '仪表板' } },
      { path: 'todos', name: 'todos', component: Child, meta: { title: '任务' } },
      { path: 'stats', name: 'stats', component: Child, meta: { title: '统计' } },
      { path: 'settings', name: 'settings', component: Child, meta: { title: '设置' } },
    ],
  },
  { path: '/login', name: 'login', component: { template: '<div />' } },
]

async function mountLayout(path = '/') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes: TEST_ROUTES })
  await router.push(path)
  await router.isReady()

  const wrapper = mount(DefaultLayout, { global: { plugins: [pinia, router] } })
  await nextTick()
  return { wrapper, router }
}

describe('DefaultLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    avatarStub.displayUrl = ref('')
    avatarStub.fallbackInitial = ref('访客')
  })

  it('装配侧边栏、顶栏搜索、页面标题、内容区与移动端底部导航', async () => {
    const { wrapper } = await mountLayout('/todos')

    expect(wrapper.find('[data-testid="sidebar"]').exists()).toBe(true)
    expect(wrapper.find('input[placeholder="搜索任务…"]').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('任务')
    expect(wrapper.find('[data-testid="page-child"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bottom-nav-dashboard"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bottom-nav-todos"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bottom-nav-stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bottom-nav-settings"]').exists()).toBe(true)
  })

  it('顶栏搜索直接写进 todoStore（任务搜索全局可达）', async () => {
    const { wrapper } = await mountLayout('/')
    const store = useTodoStore()

    await wrapper.find('input[placeholder="搜索任务…"]').setValue('周报')

    expect(store.keyword).toBe('周报')
  })

  it('顶栏不再重复放设置入口（设置统一在侧边栏底部）', async () => {
    const { wrapper } = await mountLayout('/')

    expect(wrapper.find('a[aria-label="打开设置"]').exists()).toBe(false)
    // 主题切换仍在顶栏
    expect(wrapper.find('header').text()).toBeDefined()
  })

  it('折叠按钮切换侧边栏宽度并记住状态', async () => {
    const { wrapper } = await mountLayout('/')
    expect(wrapper.find('[data-testid="sidebar"]').classes()).toContain('w-60')

    await wrapper.find('[data-testid="sidebar-collapse"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="sidebar"]').classes()).toContain('w-16')
    expect(localStorage.getItem('smart-workspace:sidebar-collapsed')).toBe('true')
  })

  it('折叠状态从本地记忆恢复', async () => {
    localStorage.setItem('smart-workspace:sidebar-collapsed', 'true')
    const { wrapper } = await mountLayout('/')
    expect(wrapper.find('[data-testid="sidebar"]').classes()).toContain('w-16')
  })
})
