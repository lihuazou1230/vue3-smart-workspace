/**
 * 头像裁剪用的 cropperjs v2 模板：**只留手势，不留装饰**。
 *
 * 抽成独立模块是为了可测：这是"配置"，不是渲染逻辑，
 * 直接断言字符串比去正则匹配 .vue 源码可靠得多。
 *
 * 头像裁剪的标准交互是「固定裁剪框 + 拖动图片」，于是：
 * - 去掉 `cropper-grid` / `cropper-crosshair`（网格线与十字准星）
 * - 去掉 8 个 `*-resize` 手柄（那些蓝色小方块），也不给选区 `outlined`（描边）
 * - 选区**不给 `movable`**：cropperjs 的实现里，选区不可移动时拖动会转成"移动图片"
 *   （见 image 的 ACTION_MOVE 分支：`!selection.movable` 才走 `$move`）
 * - 选区里留一个 **透明的 move 手柄**：它是"圈内可拖动"的手势层，`theme-color="transparent"` 后完全看不见
 * - 画布**不加 `background`**：那是棋盘格背板，而我们要求"原图即画布"
 *
 * `aspect-ratio="1"` 保证导出素材是正方形（圆形头像的素材就是正方形）；
 * 圆形范围由组件里的白色引导环提示，纯视觉、不参与导出。
 */
export const AVATAR_CROPPER_TEMPLATE = `
<cropper-canvas>
  <cropper-image rotatable scalable skewable translatable></cropper-image>
  <cropper-handle action="select" plain></cropper-handle>
  <cropper-selection initial-coverage="0.8" aspect-ratio="1">
    <cropper-handle action="move" plain theme-color="transparent"></cropper-handle>
  </cropper-selection>
</cropper-canvas>
`
