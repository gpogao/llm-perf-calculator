# AGENTS

## 项目概述

`llm-perf-calculator` 是一个面向内部研发与性能分析的应用，用于在选定模型与平台参数后，估算大语言模型在不同 token 长度下的：

- `TTFT`
- `Prefill TPS`
- `Decode TPS`
- 运行时内存需求
- 关键公式与中间推导结果

首版聚焦 `DeepSeek V4` 家族：

- `DeepSeek-V4-Flash`
- `DeepSeek-V4-Pro`

交付形态同时覆盖：

- 浏览器应用
- `Tauri` 桌面应用

## 当前技术方向

- 前端：`React + Vite`
- 桌面壳：`Tauri`
- 计算方式：解析公式优先，本地计算，不依赖在线推理服务

## 事实源

设计与产品约定以以下文档为准：

- 主设计文档：[docs/app/design/app-design-spec.md](docs/app/design/app-design-spec.md)
- 性能计算页分页设计：[docs/app/design/pages/performance-calculator.md](docs/app/design/pages/performance-calculator.md)

如讨论结果影响页面结构、交互、术语、结果字段或目录职责，应同步更新这些文档。

## 仓库结构

```text
.
├── AGENTS.md
├── data/
├── docs/
├── scripts/
├── src/
└── src-tauri/
```

各目录职责如下：

- `src/app/`
  - 应用入口、路由、布局、全局 provider、主题和全局样式。

- `src/pages/`
  - 页面级装配层。
  - 页面负责组合 feature，不直接承载复杂公式逻辑。

- `src/features/`
  - 面向页面的业务模块。
  - 例如 `performance-calculator`、`model-structure`、`formula-notes`。

- `src/components/`
  - 可跨页面复用的 UI 组件。

- `src/domain/`
  - 核心业务类型与稳定接口定义。

- `src/engines/`
  - 纯计算与策略层。
  - 包括模型注册、公式策略、性能估算逻辑。

- `data/models/`
  - 模型静态定义和结构化数据。

- `data/platform-presets/`
  - 平台参数预设。

- `src-tauri/`
  - Tauri 桌面宿主代码。

- `scripts/`
  - 数据整理、校验、转换等工程脚本。

## 分层约束

- 不要把模型结构常量直接散落在页面组件中。
- 新模型应优先通过 `data/models/` 和 `src/engines/model-registry/` 扩展。
- 新公式应优先通过 `src/engines/formula-strategies/` 扩展。
- `src/engines/` 不应依赖 `src/pages/` 或 `src/features/`。
- 页面层只消费统一结果对象，不直接耦合底层公式细节。

## 实现原则

- 优先保证工程可追溯。
  - 所有关键结果应可回溯到输入参数、模型配置、公式和中间量。

- 优先保证模型扩展性。
  - 不能把 `DeepSeek V4` 写死成唯一支持对象。

- 优先保证 Web / Desktop 统一体验。
  - 不要引入只能在浏览器站点式场景成立的核心交互假设。

- UI 应服务于内部分析工具场景。
  - 允许高密度，但必须层次清晰、可扫描。

## 文档同步规则

出现以下变更时，必须同步更新 `docs/app/design/` 下文档：

- 页面结构变化
- 核心输入项变化
- 结果字段变化
- 公式口径变化
- 模型支持范围变化
- 新增或调整效果图

效果图保存目录固定为：

- `docs/app/design/images/`

## 推荐开发顺序

1. 初始化前端工程基础文件。
2. 落地应用级路由、布局和左侧导航。
3. 定义 `domain` 层核心类型。
4. 建立模型注册表与公式策略接口。
5. 实现性能计算页静态骨架。
6. 接入计算引擎与趋势图。
7. 补模型结构页与公式说明页。
8. 最后接入 `Tauri` 桌面壳细节。

## 提交前检查

- 新代码是否放在正确分层。
- 公式是否可追溯，命名是否清晰。
- 页面是否仍然符合高密度工程工具定位。
- 设计文档是否需要同步更新。
- 新增模型或平台预设是否已进入结构化数据目录。
