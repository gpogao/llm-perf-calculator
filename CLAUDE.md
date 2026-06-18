# CLAUDE

## 项目概述

`llm-perf-calculator` — 大语言模型性能估算工具。在选定模型与平台参数后，估算 TTFT、Prefill TPS、Decode TPS、运行时内存及关键公式推导结果。

- 首版聚焦 `DeepSeek V4` 家族（`DeepSeek-V4-Flash`、`DeepSeek-V4-Pro`）
- 模型选择：先选 `family` → 再选具体模型
- 交付形态：浏览器应用 + Tauri 桌面应用

## 技术栈

- 前端：`React + Vite`
- 桌面壳：`Tauri`
- 计算方式：本地公式计算，不依赖在线推理服务

## 事实源

设计与产品约定以下文档为准，有争议时回到文档：

- [主设计文档](docs/app/design/app-design-spec.md)
- [架构设计文档](docs/app/design/architecture-design.md)
- [性能计算页分页设计](docs/app/design/pages/performance-calculator.md)

讨论结果如影响页面结构、交互、术语、结果字段或目录职责，应同步更新这些文档。

## 仓库结构与分层约束

```
.
├── AGENTS.md / CLAUDE.md
├── data/
│   ├── models/            # 模型静态定义和结构化数据
│   └── platform-presets/  # 平台参数预设
├── docs/
├── scripts/               # 数据整理、校验、转换脚本
├── src/
│   ├── app/               # 入口、路由、布局、全局 provider、主题、全局样式
│   ├── pages/             # 页面级装配层，组合 feature，不承载复杂公式逻辑
│   ├── features/          # 面向页面的业务模块
│   ├── components/        # 可跨页面复用的 UI 组件
│   ├── domain/            # 核心业务类型与稳定接口定义
│   └── engines/           # 纯计算与策略层（模型注册、公式策略、性能估算）
└── src-tauri/             # Tauri 桌面宿主代码
```

### 分层规则

- **模型数据**：不要在手写模型列表。模型从 `src/engines/model-registry/` 统一提供，静态数据放 `data/models/`。
- **公式**：不同架构通过 `formulaStrategyId` 区分，不要把 DeepSeek V4 公式直接套到其他模型上。新公式通过 `src/engines/formula-strategies/` 扩展。
- **依赖方向**：`engines/` 不依赖 `pages/` 或 `features/`。页面层只消费统一结果对象，不直接耦合底层公式细节。
- **共享状态**：放在 `src/features/performance-calculator/state/`，由 `CalculatorProvider` 向多个页面提供一致的模型、输入、平台参数和计算假设。
- **新增 family**：先补模型注册表 → 再补对应公式策略 → 最后让页面按 `architectureKind` 条件展示。

## 新增模型流程

新增一个 model family 或 model 时，按以下两步执行。

### 第 1 步：模型结构分析（生成架构文档）

目标：弄清楚模型"长什么样"以及算力/显存瓶颈在哪，产出 `docs/$model_family/$model_id.md`。

**前置条件**：

- 模型 `config.json` 配置文件（如果没有则向用户索要）
- 本地 Python 环境中可用的 `transformers` 推理代码

**分析流程**：

1. **分析模型结构**：结合 `config.json` 中的超参和本地 `transformers` 源码（`modeling_*.py`、`configuration_*.py`），梳理模型结构：
   - 顶层结构（组件、超参速查表、层类型 schedule）
   - 单层内部残差流（attention site + FFN/MoE site）
   - Attention 内部（Q/KV 路径、压缩器、Indexer、输出投影）
   - MoE 内部（Router 选型、专家计算、共享专家）
   - Cache / KV Cache 设计
   - RoPE 与位置编码
   - 量化 / 部署相关

2. **生成 ASCII 字符图 / Mermaid 图**：为各层级绘制结构图，包含维度标注。

3. **总结算力与显存需求**：
   - **Prefill 阶段算力估算**：拆解每层 FLOPs（Q 路径、KV 投影、核心注意力、Compressor、Indexer、Output 路径、MoE），按层类型分类汇总，给出总算力和算力占比。
   - **Decode 阶段内存需求**：拆解权重常驻、持久 cache（按层类型分类）、单步临时工作集，给出总显存公式和 128K 场景数值。

4. **保存结果**：输出到 `docs/$model_family/$model_id.md`。
   - `$model_family`：与模型注册表中的 `family` 字段一致（例如 `deepseek_v4`）
   - `$model_id`：与 `ModelDefinition.id` 一致（例如 `DeepSeek-V4-Flash.md`）
   - `config.json` 放入 `docs/$model_family/config/$model_id-config.json`
   - 参考实例：`docs/deepseek_v4/DeepSeek-V4-Flash.md`

5. **与用户确认**：架构文档、算力/显存估算结果经用户确认无误后，进入第 2 步。有问题则修改直至确认。

### 第 2 步：工程适配

按分层规则将新模型接入工程：

1. **补 domain 类型**（如需要）：
   - 在 `src/domain/model/types.ts` 中新增 `architectureKind`（如模型结构是全新类别）或 `formulaStrategyId`（如公式口径不同）

2. **补模型注册表**：
   - 在 `src/engines/model-registry/` 下新增或扩展现有 family 文件（如 `deepseekV4Models.ts`），导出 `ModelDefinition[]`
   - 在 `src/engines/model-registry/index.ts` 中注册，更新 `familyDisplayNames`
   - `ModelDefinition` 各字段从第 1 步的 config 分析和架构文档中提取

3. **补公式策略**（如需要）：
   - 在 `src/engines/formula-strategies/` 下新增策略实现
   - 不同架构通过 `formulaStrategyId` 区分，不要复用其他架构的公式

4. **补模型静态数据**（如需要）：
   - 结构化数据放入 `data/models/$family/`

5. **页面适配**（如需要）：
   - 页面按 `architectureKind` 条件展示结构内容
   - 不要在页面中手写模型列表或硬编码公式

**提交前检查**：参见下方「提交前检查」清单。

## 实现原则

- **可追溯**：所有关键结果应可回溯到输入参数、模型配置、公式和中间量。
- **模型可扩展**：不能把 DeepSeek V4 写死成唯一支持对象。
- **Web / Desktop 统一**：不要引入只能在浏览器站点式场景成立的核心交互假设。
- **UI 定位**：高密度内部分析工具，允许高密度但层次清晰、可扫描。

## 文档同步

以下变更必须同步更新 `docs/app/design/` 下文档：

- 页面结构 / 核心输入项 / 结果字段 / 公式口径 / 模型支持范围 变化
- 新增或调整效果图 → 保存到 `docs/app/design/images/`

## 提交前检查

- 新代码是否放在正确分层
- 公式是否可追溯，命名是否清晰
- 页面是否仍符合高密度工程工具定位
- 设计文档是否需要同步更新
- 新增模型或平台预设是否已进入结构化数据目录
- 新增模型后是否已更新 family/model 两段式选择和相关文档
