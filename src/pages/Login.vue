<script setup lang="ts">
/**
 * 页面：登录 / 注册（公开路由，不套 DefaultLayout，独立全屏）
 *
 * 一页双 Tab：
 * - 登录：邮箱 + 密码
 * - 注册：昵称（可空）+ 邮箱 + 密码 + 确认密码
 * - GitHub OAuth：一键跳转授权，回跳后由 supabase-js 自动换会话
 *
 * 两个设计决策：
 * 1. **校验全用纯函数**（utils/validation）：逻辑可单测，组件只负责把错误显示出来
 * 2. **未配置 Supabase 时给配置引导 + 「以本地模式进入」**：
 *    没有云配置就永远登不进去，不能让用户卡死在这个页面
 */

import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseInput from '@/components/atoms/BaseInput.vue'
import { useAuthStore } from '@/stores/authStore'
import { SUPABASE_SETUP_HINT, checkSupabaseConnection } from '@/api/supabase'
import type { ConnectionCheck } from '@/api/supabase'
import {
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from '@/utils/validation'
import { parseRedirect } from '@/router/authGuard'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

type Tab = 'signIn' | 'signUp'
const tab = ref<Tab>('signIn')

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const displayName = ref('')

const submitting = ref(false)
const formErrors = ref<Record<string, string>>({})
const feedback = ref<{ ok: boolean; message: string } | null>(null)

/** 登录后回跳目标（只认站内路径，挡开放重定向） */
const redirectTarget = computed(() => parseRedirect(route.query.redirect) ?? '/')
const isLocalMode = computed(() => authStore.isLocalMode)

function switchTab(next: Tab) {
  tab.value = next
  formErrors.value = {}
  feedback.value = null
}

/** 表单校验（纯函数），返回是否通过 */
function validateForm(): boolean {
  const errors: Record<string, string> = {}

  const emailCheck = validateEmail(email.value)
  if (!emailCheck.valid) errors.email = emailCheck.message ?? '邮箱格式不正确'

  const passwordCheck = validatePassword(password.value)
  if (!passwordCheck.valid) errors.password = passwordCheck.message ?? '密码不符合要求'

  if (tab.value === 'signUp') {
    const nameCheck = validateDisplayName(displayName.value)
    if (!nameCheck.valid) errors.displayName = nameCheck.message ?? '昵称不符合要求'

    const confirmCheck = validatePasswordConfirm(password.value, confirmPassword.value)
    if (!confirmCheck.valid) errors.confirmPassword = confirmCheck.message ?? '两次密码不一致'
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submit() {
  feedback.value = null
  if (!validateForm()) return

  submitting.value = true
  try {
    const result =
      tab.value === 'signIn'
        ? await authStore.signIn(email.value, password.value)
        : await authStore.signUp({
            email: email.value,
            password: password.value,
            displayName: displayName.value,
          })

    feedback.value = { ok: result.ok, message: result.message }
    // 需要邮箱验证时不跳转：还没有会话，进去也会被守卫送回登录页
    if (result.ok && !result.needsEmailConfirm) await router.push(redirectTarget.value)
  } finally {
    submitting.value = false
  }
}

async function signInWithGithub() {
  feedback.value = null
  submitting.value = true
  try {
    const result = await authStore.signInWithGithub(window.location.href)
    feedback.value = { ok: result.ok, message: result.message }
  } finally {
    submitting.value = false
  }
}

/** 本地模式：直接进应用（没有云配置时不该把用户挡在门外） */
function enterLocalMode() {
  void router.push(redirectTarget.value)
}

// ---- 连接自检：登录失败时先分清「地址写错」还是「密钥不对」 ----
const checking = ref(false)
const connectionResult = ref<ConnectionCheck | null>(null)

async function testConnection() {
  checking.value = true
  try {
    connectionResult.value = await checkSupabaseConnection()
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 dark:bg-slate-950"
  >
    <div class="w-full max-w-md">
      <header class="mb-6 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          🧭 Vue 3 智能工作台
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          登录后任务数据多设备同步；不登录也能先用本地模式
        </p>
      </header>

      <section class="card p-6" data-testid="login-card">
        <!-- 未配置 Supabase：给配置引导，而不是让用户对着报错发懵 -->
        <div
          v-if="isLocalMode"
          data-testid="login-setup-hint"
          class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <p class="mb-1 font-semibold">当前是本地模式（未配置 Supabase）</p>
          <p>{{ SUPABASE_SETUP_HINT }}</p>
          <BaseButton
            data-testid="login-enter-local"
            class="mt-3"
            size="sm"
            variant="secondary"
            @click="enterLocalMode"
          >
            以本地模式进入应用
          </BaseButton>
        </div>

        <!-- Tab 切换 -->
        <div class="mb-5 flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            data-testid="login-tab-signin"
            class="flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              tab === 'signIn'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
            "
            @click="switchTab('signIn')"
          >
            登录
          </button>
          <button
            type="button"
            data-testid="login-tab-signup"
            class="flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              tab === 'signUp'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
            "
            @click="switchTab('signUp')"
          >
            注册
          </button>
        </div>

        <form class="space-y-4" novalidate @submit.prevent="submit">
          <!-- 昵称（仅注册） -->
          <div v-if="tab === 'signUp'">
            <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              昵称（可留空，默认用邮箱前缀）
            </label>
            <BaseInput v-model="displayName" data-testid="login-display-name" placeholder="张三" />
            <p
              v-if="formErrors.displayName"
              data-testid="login-error-display-name"
              class="mt-1 text-xs text-rose-500"
            >
              {{ formErrors.displayName }}
            </p>
          </div>

          <!-- 邮箱 -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              邮箱
            </label>
            <BaseInput
              v-model="email"
              data-testid="login-email"
              type="text"
              placeholder="you@example.com"
            />
            <p
              v-if="formErrors.email"
              data-testid="login-error-email"
              class="mt-1 text-xs text-rose-500"
            >
              {{ formErrors.email }}
            </p>
          </div>

          <!-- 密码 -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              密码
            </label>
            <BaseInput
              v-model="password"
              data-testid="login-password"
              type="password"
              placeholder="至少 6 位"
            />
            <p
              v-if="formErrors.password"
              data-testid="login-error-password"
              class="mt-1 text-xs text-rose-500"
            >
              {{ formErrors.password }}
            </p>
          </div>

          <!-- 确认密码（仅注册） -->
          <div v-if="tab === 'signUp'">
            <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              确认密码
            </label>
            <BaseInput
              v-model="confirmPassword"
              data-testid="login-confirm-password"
              type="password"
              placeholder="再次输入密码"
            />
            <p
              v-if="formErrors.confirmPassword"
              data-testid="login-error-confirm-password"
              class="mt-1 text-xs text-rose-500"
            >
              {{ formErrors.confirmPassword }}
            </p>
          </div>

          <!-- 提交 -->
          <BaseButton
            data-testid="login-submit"
            native-type="submit"
            variant="primary"
            block
            :disabled="submitting"
          >
            {{ tab === 'signIn' ? '登录' : '注册并登录' }}
          </BaseButton>
        </form>

        <!-- GitHub OAuth -->
        <div class="my-5 flex items-center gap-3">
          <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
          <span class="text-xs text-slate-400">或</span>
          <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
        </div>
        <BaseButton
          data-testid="login-github"
          variant="secondary"
          block
          :disabled="submitting"
          @click="signInWithGithub"
        >
          <span class="mr-2">🐙</span>使用 GitHub 登录
        </BaseButton>

        <!-- 反馈 -->
        <p
          v-if="feedback"
          data-testid="login-feedback"
          class="mt-4 text-center text-xs"
          :class="feedback.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'"
          role="status"
        >
          {{ feedback.message }}
        </p>

        <!-- 连接自检：把「网络不可用」拆成可定位的结论 -->
        <div v-if="!isLocalMode" class="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            type="button"
            data-testid="login-connection-test"
            class="text-xs text-slate-500 underline-offset-2 hover:underline disabled:opacity-50 dark:text-slate-400"
            :disabled="checking"
            @click="testConnection"
          >
            {{ checking ? '检测中…' : '🔌 登录失败？点这里测试与 Supabase 的连接' }}
          </button>
          <p
            v-if="connectionResult"
            data-testid="login-connection-result"
            class="mt-2 rounded-xl border p-3 text-xs leading-relaxed"
            :class="
              connectionResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200'
            "
          >
            <span class="font-semibold">{{ connectionResult.ok ? '✅' : '❌' }}</span>
            {{ connectionResult.message }}
            <code class="mt-1 block break-all opacity-70">{{ connectionResult.detail }}</code>
          </p>
        </div>
      </section>

      <!-- 只在本地模式下给「随便逛逛」出口：配了 Supabase 后点它会被守卫弹回来，等于死链 -->
      <p
        v-if="isLocalMode"
        data-testid="login-browse-local"
        class="mt-4 text-center text-xs text-slate-400 dark:text-slate-500"
      >
        <router-link :to="{ name: 'dashboard' }" class="underline hover:text-slate-600">
          先随便逛逛（本地模式）
        </router-link>
      </p>
    </div>
  </div>
</template>
