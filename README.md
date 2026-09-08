# Vue 3 智能工作台

一个集任务管理、数据可视化、天气信息、主题与外观自定义于一体的个人效率仪表板，基于 Vue 3 + TypeScript + Tailwind CSS + Element Plus 构建，无需后端服务。

> 📌 当前进度：**第一阶段 —— 基础建设已完成**（工程骨架 + 代码规范就绪）。
> 详细规划见仓库根目录《Vue3智能工作台-项目规划.md》。

## 技术栈

- **Vue 3** + `<script setup>` + **TypeScript**
- **Vite** 构建，路径别名 `@` → `src`
- **Tailwind CSS v3.4**（`darkMode: 'class'` 主题切换）
- **Element Plus**（unplugin 按需自动导入）
- **Pinia** 状态管理 / **Vue Router**（后续阶段引入）
- **Vitest** 单元测试 / ESLint + Prettier / Husky + commitlint

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 类型检查 / 构建
pnpm typecheck
pnpm build

# 测试 / Lint
pnpm test
pnpm lint
```

## Git 规范

- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)（husky + commitlint 强制校验）
- 提交前由 lint-staged 自动执行 ESLint/Prettier
