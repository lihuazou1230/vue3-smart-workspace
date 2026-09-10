import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/api/auth', async () => (await import('@/test/authApiStub')).authApiStub)

import { AUTH_TEST_USER, authApiStub, resetAuthApiStub } from '@/test/authApiStub'
import Login from './Login.vue'

const TEST_ROUTES = [
  { path: '/login', name: 'login', component: Login },
  { path: '/', name: 'dashboard', component: { template: '<div>仪表板</div>' } },
  { path: '/todos', name: 'todos', component: { template: '<div>任务</div>' } },
]

/** 配置 Supabase 环境（默认按「已配置」测，未配置的场景单测时再清掉） */
function configureSupabase(configured = true) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://demo.supabase.co' : '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '')
}

async function mountLogin(query: Record<string, string> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes: TEST_ROUTES })
  await router.push({ name: 'login', query })
  await router.isReady()

  const wrapper = mount(Login, { global: { plugins: [pinia, router] } })
  await nextTick()
  return { wrapper, router }
}

/** 填表单（邮箱/密码通过 BaseInput 内部的 input） */
async function fill(
  wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper'],
  values: { email?: string; password?: string; confirm?: string; name?: string },
) {
  if (values.email !== undefined)
    await wrapper.find('[data-testid="login-email"] input').setValue(values.email)
  if (values.password !== undefined)
    await wrapper.find('[data-testid="login-password"] input').setValue(values.password)
  if (values.confirm !== undefined)
    await wrapper.find('[data-testid="login-confirm-password"] input').setValue(values.confirm)
  if (values.name !== undefined)
    await wrapper.find('[data-testid="login-display-name"] input').setValue(values.name)
}

describe('Login 页', () => {
  beforeEach(() => {
    resetAuthApiStub()
    vi.unstubAllEnvs()
    configureSupabase(true)
    localStorage.clear()
  })

  describe('表单校验（纯函数驱动，不消耗一次网络请求）', () => {
    it('邮箱为空：提示且不调用登录接口', async () => {
      const { wrapper } = await mountLogin()
      await fill(wrapper, { password: '123456' })

      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('[data-testid="login-error-email"]').text()).toBe('请输入邮箱')
      expect(authApiStub.signInWithPassword).not.toHaveBeenCalled()
    })

    it('邮箱格式不对：提示格式错误', async () => {
      const { wrapper } = await mountLogin()
      await fill(wrapper, { email: 'zhang.example.com', password: '123456' })

      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('[data-testid="login-error-email"]').text()).toBe('邮箱格式不正确')
      expect(authApiStub.signInWithPassword).not.toHaveBeenCalled()
    })

    it('密码不足 6 位：提示且不发请求', async () => {
      const { wrapper } = await mountLogin()
      await fill(wrapper, { email: 'zhang@example.com', password: '123' })

      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('[data-testid="login-error-password"]').text()).toContain('6')
      expect(authApiStub.signInWithPassword).not.toHaveBeenCalled()
    })
  })

  describe('登录', () => {
    it('成功：调用 signInWithPassword 并跳到仪表板', async () => {
      const { wrapper, router } = await mountLogin()
      await fill(wrapper, { email: ' zhang@example.com ', password: 'pw123456' })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(authApiStub.signInWithPassword).toHaveBeenCalledWith('zhang@example.com', 'pw123456')
      expect(router.currentRoute.value.name).toBe('dashboard')
    })

    it('成功且带 redirect：回到原目标页', async () => {
      const { wrapper, router } = await mountLogin({ redirect: '/todos' })
      await fill(wrapper, { email: 'zhang@example.com', password: 'pw123456' })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('todos')
    })

    it('redirect 是外站：忽略它，回仪表板（防开放重定向）', async () => {
      const { wrapper, router } = await mountLogin({ redirect: '//evil.com' })
      await fill(wrapper, { email: 'zhang@example.com', password: 'pw123456' })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('dashboard')
    })

    it('失败：显示服务端返回的中文文案，且留在登录页', async () => {
      authApiStub.signInWithPassword.mockResolvedValue({ ok: false, message: '邮箱或密码不正确' })
      const { wrapper, router } = await mountLogin()
      await fill(wrapper, { email: 'zhang@example.com', password: 'wrong123' })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('[data-testid="login-feedback"]').text()).toBe('邮箱或密码不正确')
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  describe('注册', () => {
    it('切到注册 Tab 才出现昵称与确认密码字段', async () => {
      const { wrapper } = await mountLogin()
      expect(wrapper.find('[data-testid="login-display-name"]').exists()).toBe(false)

      await wrapper.find('[data-testid="login-tab-signup"]').trigger('click')

      expect(wrapper.find('[data-testid="login-display-name"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="login-confirm-password"]').exists()).toBe(true)
    })

    it('两次密码不一致：提示且不发请求', async () => {
      const { wrapper } = await mountLogin()
      await wrapper.find('[data-testid="login-tab-signup"]').trigger('click')
      await fill(wrapper, {
        email: 'zhang@example.com',
        password: 'pw123456',
        confirm: 'pw654321',
        name: '张三',
      })

      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('[data-testid="login-error-confirm-password"]').text()).toBe(
        '两次输入的密码不一致',
      )
      expect(authApiStub.signUpWithPassword).not.toHaveBeenCalled()
    })

    it('注册成功（拿到会话）：传递昵称并跳转', async () => {
      const { wrapper, router } = await mountLogin()
      await wrapper.find('[data-testid="login-tab-signup"]').trigger('click')
      await fill(wrapper, {
        email: 'zhang@example.com',
        password: 'pw123456',
        confirm: 'pw123456',
        name: '张三',
      })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(authApiStub.signUpWithPassword).toHaveBeenCalledWith({
        email: 'zhang@example.com',
        password: 'pw123456',
        displayName: '张三',
      })
      expect(router.currentRoute.value.name).toBe('dashboard')
    })

    it('注册成功但需要邮箱验证：留在登录页并给出提示', async () => {
      authApiStub.signUpWithPassword.mockResolvedValue({
        ok: true,
        message: '注册成功，请到邮箱完成验证后再登录',
        needsEmailConfirm: true,
      })
      const { wrapper, router } = await mountLogin()
      await wrapper.find('[data-testid="login-tab-signup"]').trigger('click')
      await fill(wrapper, {
        email: 'zhang@example.com',
        password: 'pw123456',
        confirm: 'pw123456',
        name: '',
      })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('[data-testid="login-feedback"]').text()).toContain('验证')
      expect(router.currentRoute.value.name).toBe('login')
    })
  })

  describe('GitHub OAuth', () => {
    it('点击后调用 OAuth 并带当前地址做回跳', async () => {
      const { wrapper } = await mountLogin()

      await wrapper.find('[data-testid="login-github"]').trigger('click')
      await flushPromises()

      expect(authApiStub.signInWithGitHub).toHaveBeenCalledWith(window.location.href)
      expect(wrapper.find('[data-testid="login-feedback"]').text()).toContain('GitHub')
    })
  })

  describe('未配置 Supabase（本地模式）', () => {
    it('显示配置引导，并提供「以本地模式进入」', async () => {
      configureSupabase(false)
      const { wrapper, router } = await mountLogin()

      const hint = wrapper.find('[data-testid="login-setup-hint"]')
      expect(hint.exists()).toBe(true)
      expect(hint.text()).toContain('.env.local')

      await wrapper.find('[data-testid="login-enter-local"]').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('dashboard')
    })
  })

  describe('已登录用户', () => {
    it('身份展示不阻塞页面（store 有会话时进入登录页不报错）', async () => {
      authApiStub.getCurrentSessionUser.mockResolvedValue(AUTH_TEST_USER)
      const { wrapper } = await mountLogin()
      await nextTick()

      expect(wrapper.find('[data-testid="login-card"]').exists()).toBe(true)
    })
  })
})
