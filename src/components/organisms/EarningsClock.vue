<script setup lang="ts">
/**
 * 有机体组件：赚钱秒表（EarningsClock）——仪表板 C 位的深绿强调卡
 *
 * - 主指标：今日已赚，**逐位上滑滚动**（odometer）实时跳动、精准到分；金额由「时间戳差值」重算，
 *   不做逐秒累加，所以切到后台再切回来数字依然准确（无跳变、无漂移）
 * - 次指标：本月已赚（含今日进度，封顶月薪）+ 相对上月同期的涨跌徽章
 * - 附属元素：「今日已赚 / 目标日收入」进度条
 * - 上班前 / 周末不显示「今日」金额（只给状态文案）；「本月已赚」是月度累计，始终展示
 * - 内嵌设置：月薪 / 上下班时间 / 午休 / 月计薪天数 / 是否仅工作日，改完即时生效并持久化
 */

import { computed, ref } from 'vue'

import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseInput from '@/components/atoms/BaseInput.vue'
import TrendBadge from '@/components/atoms/TrendBadge.vue'
import RollingAmount from '@/components/molecules/RollingAmount.vue'
import { useEarnings } from '@/composables/useEarnings'
import { EARNINGS_STATUS_TEXT } from '@/types/earnings'
import { formatDuration, formatFen } from '@/utils/earnings'

const { config, snapshot, amountText, monthAmountText, isConfigured, updateConfig, resetConfig } =
  useEarnings()

/** 设置区默认在「未配置」时展开，配置好后收起 */
const settingsOpen = ref(!isConfigured.value)

const statusText = computed(() => EARNINGS_STATUS_TEXT[snapshot.value.status])

/** 是否展示今日金额：计薪中 / 午休（冻结）/ 已下班（今日总计）；上班前与周末只给文案 */
const showAmount = computed(
  () =>
    snapshot.value.status === 'working' ||
    snapshot.value.status === 'lunch' ||
    snapshot.value.status === 'after-work',
)

const isRunning = computed(() => snapshot.value.status === 'working')
const progressPercent = computed(() => Math.round(snapshot.value.progress * 100))
const dailyAmountText = computed(() => formatFen(snapshot.value.dailyFen))
const hourlyAmountText = computed(() => formatFen(snapshot.value.hourlyFen))
/** 仅在能算出上月同期（> 0）时展示涨跌，避免月初第一个工作日显示无意义的 0% */
const showMonthTrend = computed(
  () => snapshot.value.monthEarnedFen > 0 && snapshot.value.monthDeltaPercent !== 0,
)

const workHoursText = computed(() => {
  const total = snapshot.value.dailyWorkSeconds
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`
})

/** 副文案：倒计时或今日总计 */
const hintText = computed(() => {
  const s = snapshot.value
  const duration = formatDuration(s.secondsToNextChange)
  if (s.status === 'after-work') return `今日总计 ¥${dailyAmountText.value}`
  if (s.status === 'lunch') return `距离下午上班还有 ${duration}`
  if (s.status === 'before-work') return `距离上班还有 ${duration}`
  if (s.status === 'working') {
    return s.nextChange === 'lunch' ? `距离午休还有 ${duration}` : `距离下班还有 ${duration}`
  }
  return ''
})

// ---- 设置表单绑定（输入框为字符串语义，这里做双向换算） ----
const salaryModel = computed({
  get: () => (config.value.monthlySalary > 0 ? String(config.value.monthlySalary) : ''),
  set: (value: string) => updateConfig({ monthlySalary: Math.max(0, Number(value) || 0) }),
})

const monthWorkDaysModel = computed({
  get: () => String(config.value.monthWorkDays),
  set: (value: string) => updateConfig({ monthWorkDays: Math.max(0, Number(value) || 0) }),
})

const workStartModel = computed({
  get: () => config.value.workStart,
  set: (value: string) => updateConfig({ workStart: value }),
})

const workEndModel = computed({
  get: () => config.value.workEnd,
  set: (value: string) => updateConfig({ workEnd: value }),
})

const lunchStartModel = computed({
  get: () => config.value.lunchStart,
  set: (value: string) => updateConfig({ lunchStart: value }),
})

const lunchEndModel = computed({
  get: () => config.value.lunchEnd,
  set: (value: string) => updateConfig({ lunchEnd: value }),
})

const weekdaysOnlyModel = computed({
  get: () => config.value.weekdaysOnly,
  set: (value: boolean) => updateConfig({ weekdaysOnly: value }),
})

function clearLunch() {
  updateConfig({ lunchStart: '', lunchEnd: '' })
}

function restoreDefaults() {
  resetConfig()
}
</script>

<template>
  <section class="card-accent flex flex-col p-5 text-white" aria-label="赚钱秒表">
    <header class="mb-3 flex items-center justify-between gap-2">
      <h2 class="flex items-center gap-1.5 text-sm font-semibold text-emerald-50">
        💰 赚钱秒表
        <span
          v-if="isRunning"
          class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200"
          aria-hidden="true"
        ></span>
      </h2>
      <button
        type="button"
        class="rounded-full px-2.5 py-1 text-xs font-medium text-emerald-50 transition-colors hover:bg-white/15"
        @click="settingsOpen = !settingsOpen"
      >
        {{ settingsOpen ? '收起设置' : '设置' }}
      </button>
    </header>

    <!-- 主指标：今日已赚（逐位滚动） -->
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <template v-if="showAmount">
        <p
          data-testid="earnings-today"
          class="font-mono text-4xl font-bold tabular-nums tracking-tight sm:text-5xl"
        >
          <span class="text-2xl text-emerald-200">¥</span><RollingAmount :value="amountText" />
        </p>
        <span class="text-xs text-emerald-100">{{ statusText }}</span>
      </template>
      <p v-else class="text-base font-medium text-emerald-50">
        {{ statusText }}
      </p>
    </div>

    <!-- 次指标：本月已赚（月度累计，非计薪日也保留展示） -->
    <p
      v-if="isConfigured"
      data-testid="earnings-month"
      class="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-emerald-100"
    >
      <span>本月已赚</span>
      <span class="font-mono font-semibold tabular-nums text-white"
        >¥<RollingAmount :value="monthAmountText"
      /></span>
      <span class="text-xs text-emerald-200/90"
        >已计薪 {{ snapshot.monthElapsedPaidDays }}/{{ snapshot.monthPaidDays }} 天</span
      >
      <TrendBadge
        v-if="showMonthTrend"
        :value="snapshot.monthDeltaPercent"
        label="较上月同期"
        data-testid="earnings-month-trend"
      />
    </p>

    <!-- 倒计时 / 总计 -->
    <p v-if="hintText" class="mt-1 text-xs text-emerald-100/90">{{ hintText }}</p>

    <!-- 目标进度条：今日已赚 / 目标日收入 -->
    <div v-if="isConfigured" class="mt-3">
      <div class="mb-1 flex items-center justify-between text-xs text-emerald-100/90">
        <span>今日进度 · 目标日收入 ¥{{ dailyAmountText }}</span>
        <span class="tabular-nums">{{ progressPercent }}%</span>
      </div>
      <div
        class="h-1.5 w-full overflow-hidden rounded-full bg-white/20"
        role="progressbar"
        :aria-valuenow="progressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`今日已赚进度 ${progressPercent}%`"
      >
        <div
          class="h-full rounded-full bg-white/90 transition-all duration-500 ease-out"
          :style="{ width: `${progressPercent}%` }"
        ></div>
      </div>
    </div>

    <!-- 明细 -->
    <p v-if="isConfigured" class="mt-2 text-xs text-emerald-100/80">
      时薪 ¥{{ hourlyAmountText }} · 日薪 ¥{{ dailyAmountText }} · 每日计薪 {{ workHoursText }} ·
      月计薪 {{ config.monthWorkDays }} 天
    </p>

    <!-- 未配置引导 -->
    <p v-if="!isConfigured" class="mt-2 text-xs text-emerald-100/80">
      填写月薪与上下班时间后，这里会逐位滚动显示「今日已赚」。
    </p>

    <!-- 设置表单 -->
    <div
      v-if="settingsOpen"
      class="mt-4 space-y-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm"
      data-testid="earnings-settings"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-xs text-emerald-50/90">月薪（元）</span>
          <BaseInput v-model="salaryModel" type="number" placeholder="例如 15000" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-emerald-50/90">月计薪天数</span>
          <BaseInput v-model="monthWorkDaysModel" type="number" placeholder="21.75" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-emerald-50/90">上班时间</span>
          <BaseInput v-model="workStartModel" type="time" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-emerald-50/90">下班时间</span>
          <BaseInput v-model="workEndModel" type="time" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-emerald-50/90">午休开始（留空 = 不扣午休）</span>
          <BaseInput v-model="lunchStartModel" type="time" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-emerald-50/90">午休结束</span>
          <BaseInput v-model="lunchEndModel" type="time" />
        </label>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="flex items-center gap-2 text-xs text-emerald-50">
          <el-switch v-model="weekdaysOnlyModel" size="small" />
          仅周一 ~ 周五计薪
        </label>
        <div class="flex gap-2">
          <BaseButton size="sm" variant="secondary" @click="clearLunch">不扣午休</BaseButton>
          <BaseButton size="sm" variant="secondary" @click="restoreDefaults">恢复默认</BaseButton>
        </div>
      </div>

      <p class="text-xs text-emerald-100/80">
        金额按「月薪 ÷ 月计薪天数 ÷ 每日计薪时长」换算，只在上班时间内累计，配置自动保存在浏览器。
      </p>
    </div>
  </section>
</template>
