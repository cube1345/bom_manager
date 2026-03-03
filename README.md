# 电子元器件智能管理系统

基于 Next.js + 本地 JSON 数据库实现，支持：

- 类型管理（CRUD）
- 元器件管理（CRUD）
- 采购记录管理（CRUD）
- 关键词搜索 + 多条件筛选
- 批量导入（JSON / CSV）
- 库存预警（阈值可配置）
- 导出 JSON / Excel（`.xls`）
- PCB 管理（CRUD）与项目用量统计
- 自动导出 `latest JSON/Excel` + 历史快照
- 项目管理（一个项目可管理多个 PCB）
- 自定义数据存储路径（自动迁移并持续保存）
- 打包 Windows 可执行文件（Electron）

## 1. 路由结构

- `/`：系统首页
- `/types`：类型管理
- `/components`：元器件列表（搜索、筛选、预警）
- `/components/manage`：元器件管理（含采购记录和批量导入）
- `/pcbs`：PCB 管理（含 PCB BOM 明细与项目需求统计）
- `/settings`：系统设置（数据存储路径）

## 2. 运行开发环境

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。

本地数据库文件路径：`data/bom-data.json`。

## 3. 元器件字段

- 类型（单选，类型本身可 CRUD）
- 型号
- 辅助信息
- 备注
- 库存预警阈值
- 记录（采购平台、购买链接、数目、价格（元/个）、购买时间）
- 总数目（自动计算）
- 最低价格（自动记录）
- 创建时间
- 更新时间

说明：采购记录中的购买时间由提交记录时自动生成。

## 4. 批量导入

支持 `.json` 和 `.csv`。

### CSV 头部示例

```csv
typeName,model,auxInfo,note,warningThreshold,platform,link,quantity,pricePerUnit
```

规则：
- 同 `typeName + model` 会合并为同一个元器件。
- 已存在的同型号元器件将被更新，并追加采购记录。
- 不存在的类型会自动创建。

## 5. 导出数据

页面支持：

- 导出 JSON
- 导出 Excel（`.xls`，可用 Excel 直接打开）

系统自动导出：

- `data/exports/bom-data.latest.json`
- `data/exports/bom-data.latest.xls`

持续记忆（历史快照）：

- `data/snapshots/bom-data.YYYY-MM-DDTHH-mm-ss-sssZ.json`
- 每次新增/编辑/删除都会自动生成快照，并自动保留最近 120 份。

## 6. 打包 Windows 可执行文件

```bash
pnpm install
pnpm build
pnpm electron:dist
```

生成目录：`dist/`（包含 `.exe` 安装包）。

说明：打包后的软件仍使用本地 `data` 目录进行持久化，重启后会自动恢复数据。

## 7. Electron 本地调试

```bash
pnpm install
pnpm electron:dev
```

该命令会同时启动 Next.js 与 Electron 窗口。
