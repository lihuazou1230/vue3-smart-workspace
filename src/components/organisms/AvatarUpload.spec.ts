import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

import { AVATAR_SIZE } from '@/types/auth'
// 直接取 SFC 源码文本（Vite 的 ?raw），用来守住那条"载重" CSS
import avatarUploadSource from './AvatarUpload.vue?raw'

/** cropperjs 在 happy-dom 里没法真跑（需要布局与 canvas），换成可控的桩 */
const cropper = vi.hoisted(() => ({
  instances: [] as Array<{ element: unknown; options: unknown; destroyed: boolean }>,
  selection: null as unknown,
}))

vi.mock('cropperjs', () => ({
  default: class MockCropper {
    element: unknown
    options: unknown
    destroyed = false
    constructor(element: unknown, options?: unknown) {
      this.element = element
      this.options = options
      cropper.instances.push(this)
    }
    getCropperSelection() {
      return cropper.selection
    }
    destroy() {
      this.destroyed = true
    }
  },
}))

/** useAvatar 也用桩：本组件只负责「选图 → 裁剪 → 交给 saveAvatar」 */
const avatar = vi.hoisted(() => ({
  displayUrl: null as unknown,
  saving: null as unknown,
  fallbackInitial: null as unknown,
  saveAvatar: vi.fn<(blob: Blob) => Promise<{ ok: boolean; message: string }>>(),
  removeAvatar: vi.fn<() => Promise<{ ok: boolean; message: string }>>(),
  loadLocalAvatar: vi.fn(async () => {}),
  error: null as unknown,
  hasAvatar: null as unknown,
  dispose: vi.fn(),
}))

vi.mock('@/composables/useAvatar', () => ({
  useAvatar: () => ({
    displayUrl: avatar.displayUrl,
    saving: avatar.saving,
    fallbackInitial: avatar.fallbackInitial,
    saveAvatar: avatar.saveAvatar,
    removeAvatar: avatar.removeAvatar,
    loadLocalAvatar: avatar.loadLocalAvatar,
    hasAvatar: avatar.hasAvatar,
    error: avatar.error,
    dispose: avatar.dispose,
  }),
}))

import AvatarUpload from './AvatarUpload.vue'

/** 裁剪结果 canvas 的桩：toBlob 立即回调一个 webp blob */
const croppedBlob = new Blob(['cropped'], { type: 'image/webp' })
const toCanvas = vi.fn(async () => ({
  toBlob: (callback: (blob: Blob | null) => void) => callback(croppedBlob),
}))

function fileOf(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

/**
 * el-dialog 的内容要等 Element Plus 内部的 rendered 标记（watch + nextTick）翻转后才渲染，
 * 所以挂载后统一多等几拍再返回，否则查不到弹窗内部节点。
 * 不 stub teleport：appendTo 默认 body 且未开 appendToBody，teleport 处于 disabled 状态，
 * 内容就地渲染，wrapper.find 可以直接查到。
 */
async function mountDialog(visible = true) {
  const wrapper = mount(AvatarUpload, {
    props: { modelValue: visible, 'onUpdate:modelValue': () => {} },
  })
  for (let i = 0; i < 3; i += 1) await nextTick()
  return wrapper
}

/** 挂载后的 wrapper 类型（mountDialog 是异步的，这里取出 resolved 类型） */
type DialogWrapper = Awaited<ReturnType<typeof mountDialog>>

async function chooseFile(wrapper: DialogWrapper, file: File) {
  const input = wrapper.find('[data-testid="avatar-file-input"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

describe('AvatarUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cropper.instances = []
    toCanvas.mockClear()
    cropper.selection = { $toCanvas: toCanvas }
    avatar.displayUrl = ref('')
    avatar.saving = ref(false)
    avatar.fallbackInitial = ref('张三')
    avatar.hasAvatar = ref(false)
    avatar.error = ref('')
    avatar.saveAvatar.mockResolvedValue({ ok: true, message: '头像已保存并同步到云端' })
    avatar.removeAvatar.mockResolvedValue({ ok: true, message: '已移除头像' })

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:mock'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  it('无头像时展示姓名首字母兜底', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.find('[data-testid="avatar-preview"]').text()).toBe('张三')
  })

  it('已有头像时用 <img> 展示', async () => {
    avatar.displayUrl = ref('https://cdn/a.webp?v=1')
    const wrapper = await mountDialog()
    const preview = wrapper.find('[data-testid="avatar-preview"]')
    expect(preview.element.tagName).toBe('IMG')
    expect(preview.attributes('src')).toBe('https://cdn/a.webp?v=1')
  })

  it('拦截非图片文件，不进入裁剪', async () => {
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('resume.pdf', 'application/pdf', 1024))

    expect(wrapper.find('[data-testid="avatar-message"]').text()).toContain('JPG / PNG / WebP')
    expect(cropper.instances).toHaveLength(0)
    expect(wrapper.find('[data-testid="avatar-crop-area"]').exists()).toBe(false)
  })

  it('拦截超过 5MB 的图片并提示实际体积', async () => {
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('big.jpg', 'image/jpeg', 8 * 1024 * 1024))

    const message = wrapper.find('[data-testid="avatar-message"]').text()
    expect(message).toContain('5.00 MB')
    expect(message).toContain('8.00 MB')
    expect(cropper.instances).toHaveLength(0)
  })

  it('合法图片进入裁剪：显示裁剪区并挂载 cropper（1:1 裁剪框）', async () => {
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('me.png', 'image/png', 1024))
    await wrapper.vm.$nextTick()

    const stage = wrapper.find('[data-testid="avatar-crop-area"]')
    expect(stage.exists()).toBe(true)
    // 正方形舞台：画布与圆形遮罩都按这个盒子居中对齐
    expect(stage.classes()).toContain('avatar-crop-stage')
    expect(stage.classes()).toContain('aspect-square')

    expect(cropper.instances).toHaveLength(1)
    expect((cropper.instances[0].options as { template: string }).template).toContain(
      'aspect-ratio="1"',
    )
    // 不再有「应用裁剪」这个中间步骤
    expect(wrapper.find('[data-testid="avatar-apply-crop"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="avatar-message"]').text()).toContain('圆形区域')
  })

  it('裁剪区不铺暗色背板：原图本身就是画布', () => {
    // 同理，背板/棋盘格在 happy-dom 里看不见，直接守住这两处配置
    expect(avatarUploadSource).not.toContain('bg-slate-900/90')
    expect(avatarUploadSource).toContain('<cropper-canvas>')
    expect(avatarUploadSource).not.toContain('<cropper-canvas background>')
  })

  it('裁剪区样式必须给 cropper-canvas 显式尺寸（否则画布塌成 0，图片会以原始尺寸飘在左上角）', () => {
    // 这类布局问题在 happy-dom 里测不出来（它不做排版），所以直接守住这条"载重" CSS
    expect(avatarUploadSource).toMatch(
      /\.avatar-crop-stage\s+:deep\(cropper-canvas\)[\s\S]{0,220}height:\s*100%/,
    )
  })

  it('没选图时保存按钮禁用，点了也不会发请求', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.find('[data-testid="avatar-save"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="avatar-save"]').trigger('click')
    expect(avatar.saveAvatar).not.toHaveBeenCalled()
  })

  it('点保存即自动裁剪：导出 256×256 的 webp 并交给 saveAvatar，成功后关闭对话框', async () => {
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('me.png', 'image/png', 1024))
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="avatar-save"]').trigger('click')
    await flushPromises()

    expect(toCanvas).toHaveBeenCalledWith({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    expect(avatar.saveAvatar).toHaveBeenCalledTimes(1)
    expect(avatar.saveAvatar.mock.calls[0][0]).toBe(croppedBlob)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('导出失败（拿不到 blob）：给出提示且不写云端', async () => {
    toCanvas.mockResolvedValueOnce({ toBlob: (cb: (b: Blob | null) => void) => cb(null) })
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('me.png', 'image/png', 1024))
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="avatar-save"]').trigger('click')
    await flushPromises()

    expect(avatar.saveAvatar).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="avatar-message"]').text()).toContain('裁剪失败')
  })

  it('保存失败：显示错误且不关闭对话框（用户可以重试）', async () => {
    avatar.saveAvatar.mockResolvedValue({ ok: false, message: '网络不可用，请检查网络后重试' })
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('me.png', 'image/png', 1024))
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="avatar-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="avatar-message"]').text()).toContain('网络不可用')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('移除头像走 removeAvatar，并清掉裁剪现场', async () => {
    avatar.displayUrl = ref('https://cdn/a.webp?v=1')
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('me.png', 'image/png', 1024))
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="avatar-remove"]').trigger('click')

    expect(avatar.removeAvatar).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="avatar-message"]').text()).toContain('已移除头像')
    expect(cropper.instances[0].destroyed).toBe(true)
  })

  it('关闭对话框时销毁 cropper 并释放 objectURL（防内存泄漏）', async () => {
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('me.png', 'image/png', 1024))
    await wrapper.vm.$nextTick()

    await wrapper.setProps({ modelValue: false })

    expect(cropper.instances[0].destroyed).toBe(true)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('卸载组件时同样收尾', async () => {
    const wrapper = await mountDialog()
    await chooseFile(wrapper, fileOf('me.png', 'image/png', 1024))
    await wrapper.vm.$nextTick()

    wrapper.unmount()
    expect(cropper.instances[0].destroyed).toBe(true)
  })
})
