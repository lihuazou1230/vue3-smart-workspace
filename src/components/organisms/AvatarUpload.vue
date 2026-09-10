<script setup lang="ts">
/**
 * 有机体组件：头像上传 + 圆形裁剪
 *
 * 完整链路（与规划里的「头像上传链路」对应）：
 *   选择文件 → 前置校验（类型白名单 / ≤5MB）→ cropperjs 裁剪（1:1 框 + 圆形引导）
 *   → 点「保存头像」时**自动**导出 `$toCanvas(256×256)` → `toBlob('image/webp', 0.9)` → 保存
 *   → 已登录：Supabase Storage `avatars/{user_id}/avatar.webp` + user_metadata.avatar_url
 *   → 未登录：IndexedDB 存 blob（原图不转 base64，避免撑爆 localStorage 配额）
 *
 * 交互上刻意只保留一步：**选图 → 拖动/缩放 → 保存**。
 * 没有「应用裁剪」这个中间按钮（多一步纯属多余），也没有暗色画布背板——
 * 原图本身就是画布，圆形引导环只用来提示「最终露出来的范围」。
 */

import Cropper from 'cropperjs'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import BaseButton from '@/components/atoms/BaseButton.vue'
import { useAvatar } from '@/composables/useAvatar'
import { AVATAR_SIZE, AVATAR_WEBP_QUALITY } from '@/types/auth'
import { validateAvatarFile } from '@/utils/avatarImage'

/** 对话框开关（v-model） */
const visible = defineModel<boolean>({ default: false })

const { displayUrl, saving, fallbackInitial, saveAvatar, removeAvatar } = useAvatar()

const fileInput = ref<HTMLInputElement | null>(null)
const cropContainer = ref<HTMLElement | null>(null)
const cropImage = ref<HTMLImageElement | null>(null)

/** 待裁剪的原图地址（objectURL） */
const sourceUrl = ref('')
const message = ref('')
const tone = ref<'info' | 'success' | 'error'>('info')
const busy = ref(false)

let cropper: Cropper | null = null

/** cropperjs v2 模板 + 1:1 选择框（aspect-ratio="1" 保证裁剪结果天然是正方形）
 *  注意不要加 `background` 属性——那会画出棋盘格背板，而我们要的是"原图即画布"。 */
const CROPPER_TEMPLATE = `
<cropper-canvas>
  <cropper-image rotatable scalable skewable translatable></cropper-image>
  <cropper-shade hidden></cropper-shade>
  <cropper-handle action="select" plain></cropper-handle>
  <cropper-selection initial-coverage="0.8" movable resizable aspect-ratio="1">
    <cropper-grid role="grid" covered></cropper-grid>
    <cropper-crosshair centered></cropper-crosshair>
    <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
    <cropper-handle action="n-resize"></cropper-handle>
    <cropper-handle action="e-resize"></cropper-handle>
    <cropper-handle action="s-resize"></cropper-handle>
    <cropper-handle action="w-resize"></cropper-handle>
    <cropper-handle action="ne-resize"></cropper-handle>
    <cropper-handle action="nw-resize"></cropper-handle>
    <cropper-handle action="se-resize"></cropper-handle>
    <cropper-handle action="sw-resize"></cropper-handle>
  </cropper-selection>
</cropper-canvas>
`

/** 显示用头像（云端优先，其次本地） */
const currentUrl = computed(() => displayUrl.value)
/** 是否已经选了图（决定「保存头像」是否可用） */
const hasSource = computed(() => sourceUrl.value !== '')

function setMessage(text: string, next: 'info' | 'success' | 'error' = 'info') {
  message.value = text
  tone.value = next
}

function revoke(url: string) {
  if (url) URL.revokeObjectURL(url)
}

/** 清掉裁剪现场（原图、cropper 实例） */
function resetCrop() {
  cropper?.destroy()
  cropper = null
  revoke(sourceUrl.value)
  sourceUrl.value = ''
}

function openFilePicker() {
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 清空 input：否则连续选同一个文件不会再触发 change
  input.value = ''
  if (!file) return

  const check = validateAvatarFile(file)
  if (!check.ok) {
    setMessage(check.message, 'error')
    return
  }

  resetCrop()
  sourceUrl.value = URL.createObjectURL(file)
  setMessage('拖动方框选择范围，滚轮缩放图片；圆形区域就是头像最终露出的部分', 'info')

  // 等 <img> 渲染出来再挂 cropper
  await nextTick()
  if (!cropImage.value) return
  cropper = new Cropper(cropImage.value, {
    template: CROPPER_TEMPLATE,
    container: cropContainer.value ?? undefined,
  })
}

/** canvas → Blob（优先 webp，浏览器不支持时退回 png） */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null)
      return
    }
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        // webp 编码不被支持时退回 png
        canvas.toBlob((fallback) => resolve(fallback), 'image/png')
      },
      'image/webp',
      AVATAR_WEBP_QUALITY,
    )
  })
}

/**
 * 按当前选区导出 256×256 的 webp。
 * 返回的 blob 不放进 ref：普通 ref 会把对象包成响应式 Proxy，
 * Blob 的方法依赖内部槽，Proxy 包装后在浏览器里上传会抛「Illegal invocation」。
 */
async function exportCroppedBlob(): Promise<Blob | null> {
  const selection = cropper?.getCropperSelection()
  if (!selection) return null

  const canvas = await selection.$toCanvas({ width: AVATAR_SIZE, height: AVATAR_SIZE })
  return canvasToBlob(canvas)
}

/** 保存头像：一步到位——现场裁剪 + 保存（不再需要「应用裁剪」） */
async function save() {
  if (!hasSource.value) {
    setMessage('请先选择一张图片', 'error')
    return
  }

  busy.value = true
  try {
    const blob = await exportCroppedBlob()
    if (!blob) {
      setMessage('裁剪失败：请重新选择图片，或用 JPG/PNG 格式再试一次', 'error')
      return
    }

    const result = await saveAvatar(blob)
    setMessage(result.message, result.ok ? 'success' : 'error')
    if (result.ok) visible.value = false
  } catch {
    setMessage('裁剪失败，请重新选择图片再试', 'error')
  } finally {
    busy.value = false
  }
}

/** 移除头像 */
async function remove() {
  const result = await removeAvatar()
  setMessage(result.message, result.ok ? 'success' : 'error')
  if (result.ok) resetCrop()
}

/** 关闭对话框时收尾：释放 objectURL、销毁 cropper，避免内存泄漏 */
watch(visible, (open) => {
  if (!open) {
    resetCrop()
    message.value = ''
  }
})

onBeforeUnmount(resetCrop)
</script>

<template>
  <el-dialog v-model="visible" title="更换头像" width="min(92vw, 480px)">
    <div class="space-y-4">
      <!-- 当前头像（圆形预览） -->
      <div class="flex items-center gap-4">
        <img
          v-if="currentUrl"
          data-testid="avatar-preview"
          :src="currentUrl"
          alt="头像预览"
          class="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-emerald-400/70"
        />
        <span
          v-else
          data-testid="avatar-preview"
          class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-semibold text-white ring-2 ring-emerald-400/40"
        >
          {{ fallbackInitial }}
        </span>
        <div class="text-xs text-slate-500 dark:text-slate-400">
          <p>支持 JPG / PNG / WebP，原图不超过 5MB。</p>
          <p>拖动方框选范围、滚轮缩放，点「保存头像」即自动压成 256×256 的 WebP。</p>
        </div>
      </div>

      <!-- 选择文件 -->
      <div class="flex flex-wrap gap-2">
        <BaseButton size="sm" variant="secondary" @click="openFilePicker">
          {{ sourceUrl ? '重新选择图片' : '选择图片' }}
        </BaseButton>
      </div>
      <input
        ref="fileInput"
        data-testid="avatar-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        @change="onFileChange"
      />

      <!--
        裁剪区：**原图自己就是画布**（不再铺暗色背板/压暗遮罩）。
        正方形舞台是必须的——cropperjs v2 的 <cropper-image> 绝对定位，
        尺寸由 <cropper-canvas> 的 client size 决定（见下方 :deep 样式）。
        圆形引导环只用来提示"最终露出来的范围"，不参与导出。
      -->
      <div
        v-if="sourceUrl"
        ref="cropContainer"
        data-testid="avatar-crop-area"
        class="avatar-crop-stage relative mx-auto aspect-square w-full max-w-[288px] overflow-hidden rounded-xl"
      >
        <img ref="cropImage" data-testid="avatar-crop-image" :src="sourceUrl" alt="待裁剪图片" />
        <div
          class="pointer-events-none absolute left-1/2 top-1/2 h-4/5 w-4/5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgba(15,23,42,0.35)]"
          aria-hidden="true"
        ></div>
      </div>

      <!-- 提示 / 错误 -->
      <p
        v-if="message"
        data-testid="avatar-message"
        class="text-xs"
        :class="{
          'text-rose-500': tone === 'error',
          'text-emerald-600 dark:text-emerald-400': tone === 'success',
          'text-slate-500 dark:text-slate-400': tone === 'info',
        }"
        role="status"
      >
        {{ message }}
      </p>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <BaseButton
          v-if="currentUrl"
          data-testid="avatar-remove"
          size="sm"
          variant="ghost"
          :disabled="saving"
          @click="remove"
        >
          移除头像
        </BaseButton>
        <span v-else></span>
        <div class="flex gap-2">
          <BaseButton size="sm" variant="secondary" @click="visible = false">取消</BaseButton>
          <BaseButton
            data-testid="avatar-save"
            size="sm"
            variant="primary"
            :disabled="!hasSource || saving || busy"
            @click="save"
          >
            {{ saving || busy ? '处理中…' : '保存头像' }}
          </BaseButton>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/**
 * cropperjs v2 的 <cropper-canvas> / <cropper-image> 是它自己动态插入的自定义元素，
 * 不在本组件模板里，普通 scoped 选择器作用不到它们（要用 :deep）。
 *
 * 为什么必须显式给尺寸：v2 里 <cropper-image> 是 `position: absolute`，
 * 它的布局尺寸由父级 <cropper-canvas> 的 client size 算出来。画布没有尺寸时
 * 高度会塌成 0，图片就以**原始像素**飘在左上角（当初踩的就是这个坑：
 * 图片缩在顶上一条、引导环下面全空）。
 *
 * 另外把画布自身的背景关掉：原图就是画布，不需要额外的暗色背板。
 */
.avatar-crop-stage :deep(cropper-canvas) {
  display: block;
  width: 100%;
  height: 100%;
  background: transparent;
}

.avatar-crop-stage :deep(cropper-image) {
  display: block;
}
</style>
