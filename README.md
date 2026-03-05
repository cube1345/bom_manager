# BOM Manager

`BOM Manager` 是一个面向电子硬件团队的 BOM 管理工具，支持元器件、类型、项目、PCB、采购记录与店铺评价的统一维护，并提供批量导入与导出能力。

## 功能概览

- 元器件管理：新增、编辑、删除元器件，维护型号、辅助信息、库存预警、采购记录等。
- 类型管理：支持一级/二级类型，列表按首字母自动排序，并按一级类型分组展示。
- 项目与 PCB 管理：一个项目可挂多个 PCB，每个 PCB 维护独立 BOM 明细。
- 需求统计：可按项目筛选并统计各元器件总需求，支持从元器件反查关联 PCB。
- 店铺评价：维护平台店铺评分（数字输入）、参考价格、邮费、主卖品等信息。
- 批量导入：支持 `.json/.csv/.xlsx/.xls`，支持列名自动识别与手动映射。
- 数据导出：支持导出 JSON 和 Excel。
- 界面偏好：支持中英文切换、亮色/暗色主题切换。
- 列表体验：主列表支持超长滚动展示，列表数据统一按首字母排序。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Electron + electron-builder

## 运行环境

- Node.js 20+
- pnpm 9+
- Windows（桌面打包目标）

## 快速开始

```bash
pnpm install
pnpm dev
```

浏览器打开：`http://127.0.0.1:3000`

## 常用命令

```bash
# Web 开发
pnpm dev

# Web 构建
pnpm build

# Web 生产启动
pnpm start

# 代码检查
pnpm lint

# Electron 开发模式
pnpm electron:dev

# Electron 安装包（NSIS）
pnpm electron:dist

# Electron 目录版（推荐，直接可运行）
pnpm electron:dist:dir

# Electron 便携版
pnpm electron:dist:portable
```

## 打包说明（Windows）

- 推荐使用 `pnpm electron:dist:dir`。
- 可执行文件路径：`dist/win-unpacked/BOMManager.exe`。
- 如果 `electron:dist` 或 `electron:dist:portable` 在 NSIS 阶段失败（例如 `mmap` 报错），通常不影响目录版 EXE 的生成。

## 数据与存储

- 默认数据文件：`data/bom-data.json`
- 导出目录：`data/exports/`
- 快照目录：`data/snapshots/`
- 可在“设置”页面修改数据存储目录。

## 项目目录（简版）

```text
app/                  # Next.js 页面与 API
components/           # 复用 UI 组件
lib/                  # 数据与工具函数
electron/             # Electron 主进程
data/                 # 本地数据与导出
scripts/              # 构建辅助脚本
```

测试一下codex，好用😋😋😋