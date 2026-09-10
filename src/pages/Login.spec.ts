import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    // 本文件默认按「已配置 Supabase」测；下面的用例再按需切回未配置
    configureSupabase(true)
    localStorage.clear()
    // 登录页挂载时会问一次「服务端开了哪些登录方式」，默认按 GitHub 已开启返回
    vi.stubGlobal('fetch', vi.fn(settingsResponse({ email: true, github: true })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** `/auth/v1/settings` 的响应桩 */
  function settingsResponse(external: Record<string, boolean>) {
    return async () => ({ ok: true, json: async () => ({ external }) })
  }

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

    it('需要邮箱验证时给出「重新发送」入口，并说明慢/进垃圾箱是常态', async () => {
      authApiStub.signUpWithPassword.mockResolvedValue({
        ok: true,
        message: '注册成功，请到邮箱完成验证后再登录',
        needsEmailConfirm: true,
      })
      const { wrapper } = await mountLogin()
      await wrapper.find('[data-testid="login-tab-signup"]').trigger('click')
      await fill(wrapper, {
        email: 'zhang@example.com',
        password: 'pw123456',
        confirm: 'pw123456',
        name: '',
      })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      const panel = wrapper.find('[data-testid="login-pending-confirm"]')
      expect(panel.exists()).toBe(true)
      expect(panel.text()).toContain('zhang@example.com')
      expect(panel.text()).toContain('垃圾箱')
      // 刚发过一次，进入 60 秒冷却
      const resend = wrapper.find('[data-testid="login-resend-confirm"]')
      expect(resend.attributes('disabled')).toBeDefined()
      expect(resend.text()).toContain('60s')
    })

    it('冷却结束后可重发，成功后重新进入冷却', async () => {
      vi.useFakeTimers()
      try {
        authApiStub.signUpWithPassword.mockResolvedValue({
          ok: true,
          message: '注册成功，请到邮箱完成验证后再登录',
          needsEmailConfirm: true,
        })
        const { wrapper } = await mountLogin()
        await wrapper.find('[data-testid="login-tab-signup"]').trigger('click')
        await fill(wrapper, {
          email: 'zhang@example.com',
          password: 'pw123456',
          confirm: 'pw123456',
          name: '',
        })
        await wrapper.find('form').trigger('submit')
        await flushPromises()

        // 等冷却走完
        await vi.advanceTimersByTimeAsync(60_000)
        await nextTick()
        expect(
          wrapper.find('[data-testid="login-resend-confirm"]').attributes('disabled'),
        ).toBeUndefined()

        await wrapper.find('[data-testid="login-resend-confirm"]').trigger('click')
        await flushPromises()

        expect(authApiStub.resendConfirmEmail).toHaveBeenCalledWith('zhang@example.com')
        expect(wrapper.find('[data-testid="login-feedback"]').text()).toContain('重新发送')
        expect(
          wrapper.find('[data-testid="login-resend-confirm"]').attributes('disabled'),
        ).toBeDefined()
      } finally {
        vi.useRealTimers()
      }
    })

    it('重发被限流时展示服务端文案，且不进入冷却（可以稍后再点）', async () => {
      authApiStub.signUpWithPassword.mockResolvedValue({
        ok: true,
        message: '注册成功，请到邮箱完成验证后再登录',
        needsEmailConfirm: true,
      })
      authApiStub.resendConfirmEmail.mockResolvedValue({
        ok: false,
        message: '操作过于频繁，请稍后再试',
      })
      vi.useFakeTimers()
      try {
        const { wrapper } = await mountLogin()
        await wrapper.find('[data-testid="login-tab-signup"]').trigger('click')
        await fill(wrapper, {
          email: 'zhang@example.com',
          password: 'pw123456',
          confirm: 'pw123456',
          name: '',
        })
        await wrapper.find('form').trigger('submit')
        await flushPromises()

        await vi.advanceTimersByTimeAsync(60_000)
        await nextTick()
        await wrapper.find('[data-testid="login-resend-confirm"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[data-testid="login-feedback"]').text()).toContain('过于频繁')
        // 失败不进冷却，用户等一会儿就能再试
        expect(
          wrapper.find('[data-testid="login-resend-confirm"]').attributes('disabled'),
        ).toBeUndefined()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('忘记密码', () => {
    it('登录页有「忘记密码？」入口，点了切到重置模式（只剩邮箱字段）', async () => {
      const { wrapper } = await mountLogin()

      const link = wrapper.find('[data-testid="login-forgot-password"]')
      expect(link.exists()).toBe(true)
      await link.trigger('click')

      expect(wrapper.text()).toContain('忘记密码')
      expect(wrapper.find('[data-testid="login-email"]').exists()).toBe(true)
      // 重置模式不需要密码/确认密码/GitHub 入口
      expect(wrapper.find('[data-testid="login-password"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="login-github"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="login-tab-signup"]').exists()).toBe(false)
      // 也不需要输入密码就能提交
      expect(wrapper.find('[data-testid="login-submit"]').text()).toContain('发送重置邮件')
    })

    it('邮箱不合法：本地校验拦住，不发请求', async () => {
      const { wrapper } = await mountLogin()
      await wrapper.find('[data-testid="login-forgot-password"]').trigger('click')
      await fill(wrapper, { email: 'not-an-email' })

      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('[data-testid="login-error-email"]').text()).toBe('邮箱格式不正确')
      expect(authApiStub.sendPasswordReset).not.toHaveBeenCalled()
    })

    it('提交成功：调用发信接口、显示已发送说明并进入 60 秒冷却', async () => {
      const { wrapper } = await mountLogin()
      await wrapper.find('[data-testid="login-forgot-password"]').trigger('click')
      await fill(wrapper, { email: 'zhang@example.com' })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(authApiStub.sendPasswordReset).toHaveBeenCalledWith('zhang@example.com')
      expect(wrapper.find('[data-testid="login-reset-sent"]').text()).toContain('zhang@example.com')
      const submit = wrapper.find('[data-testid="login-submit"]')
      expect(submit.attributes('disabled')).toBeDefined()
      expect(submit.text()).toContain('60s')
    })

    it('发信失败：展示服务端文案（例如收件邮箱不存在）', async () => {
      authApiStub.sendPasswordReset.mockResolvedValue({
        ok: false,
        message: '重置密码邮件发送失败：请确认这个邮箱真实存在且能收信',
      })
      const { wrapper } = await mountLogin()
      await wrapper.find('[data-testid="login-forgot-password"]').trigger('click')
      await fill(wrapper, { email: 'nobody@example.com' })

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('[data-testid="login-feedback"]').text()).toContain('邮箱真实存在')
      expect(wrapper.find('[data-testid="login-reset-sent"]').exists()).toBe(false)
    })

    it('可以返回登录模式', async () => {
      const { wrapper } = await mountLogin()
      await wrapper.find('[data-testid="login-forgot-password"]').trigger('click')
      await wrapper.find('[data-testid="login-back-to-signin"]').trigger('click')

      expect(wrapper.find('[data-testid="login-tab-signin"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="login-password"]').exists()).toBe(true)
    })

    it('本地模式不显示入口（没配 Supabase 时发不出重置邮件，避免死路）', async () => {
      configureSupabase(false)
      const { wrapper } = await mountLogin()

      expect(wrapper.find('[data-testid="login-forgot-password"]').exists()).toBe(false)
    })
  })

  describe('GitHub OAuth', () => {
    it('服务端开启了 GitHub 时按钮可见', async () => {
      const { wrapper } = await mountLogin()
      await flushPromises()
      expect(wrapper.find('[data-testid="login-github"]').exists()).toBe(true)
    })

    it('服务端没开 GitHub：不渲染按钮，改为给出开启指引（避免点了报 provider is not enabled）', async () => {
      vi.stubGlobal('fetch', vi.fn(settingsResponse({ email: true, github: false })))
      const { wrapper } = await mountLogin()
      await flushPromises()

      expect(wrapper.find('[data-testid="login-github"]').exists()).toBe(false)
      const hint = wrapper.find('[data-testid="login-github-disabled"]')
      expect(hint.exists()).toBe(true)
      expect(hint.text()).toContain('Authentication → Providers')
    })

    it('问不到服务端配置时按钮照常显示（不能因一次网络抖动把功能藏起来）', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        }),
      )
      const { wrapper } = await mountLogin()
      await flushPromises()

      expect(wrapper.find('[data-testid="login-github"]').exists()).toBe(true)
    })
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

    it('本地模式才给「先随便逛逛」出口', async () => {
      configureSupabase(false)
      const local = await mountLogin()
      expect(local.wrapper.find('[data-testid="login-browse-local"]').exists()).toBe(true)
    })
  })

  describe('已配置 Supabase', () => {
    it('不显示「先随便逛逛」：点了会被守卫弹回登录页，等于死链', async () => {
      const { wrapper } = await mountLogin()
      expect(wrapper.find('[data-testid="login-browse-local"]').exists()).toBe(false)
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

  describe('连接自检（登录失败时区分「地址错」与「密钥错」）', () => {
    it('已配置 Supabase 时给出自检入口，点击后显示结论', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, status: 401 })),
      )
      const { wrapper } = await mountLogin()

      const trigger = wrapper.find('[data-testid="login-connection-test"]')
      expect(trigger.exists()).toBe(true)

      await trigger.trigger('click')
      await flushPromises()

      const result = wrapper.find('[data-testid="login-connection-result"]')
      expect(result.text()).toContain('密钥无效')
      expect(result.text()).toContain('401')
    })

    it('地址连不上时提示多半是 Project URL 抄错，并摊出请求地址', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        }),
      )
      const { wrapper } = await mountLogin()

      await wrapper.find('[data-testid="login-connection-test"]').trigger('click')
      await flushPromises()

      const result = wrapper.find('[data-testid="login-connection-result"]')
      expect(result.text()).toContain('Project URL')
      expect(result.text()).toContain('https://demo.supabase.co/auth/v1/health')
    })

    it('本地模式没有可测的目标，不显示入口', async () => {
      configureSupabase(false)
      const { wrapper } = await mountLogin()
      expect(wrapper.find('[data-testid="login-connection-test"]').exists()).toBe(false)
    })
  })
})
