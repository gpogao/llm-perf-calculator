# Performance Calculator Page Spec

## 1. 页面目的

`Performance Calculator` 是应用的主工作台页面，用于在给定模型、平台参数和 token 输入条件下，计算并展示：

- `TTFT`
- `Prefill TPS`
- `Decode TPS`
- `Total Runtime Memory`
- `Bottleneck Classification`
- `Formula Trace`
- `Token Sweep Trend`

页面面向内部研发和性能分析人员，优先保证高密度、可追溯和工程可解释性。

## 2. 页面范围

本页负责：

- 模型选择
- 平台参数输入
- token 输入与范围输入
- 单点性能计算
- token 趋势图计算与展示
- 显存估算摘要展示
- 结构摘要跳转
- 公式说明跳转

本页不负责：

- 完整结构详情展示
- 完整公式文档浏览
- 多模型并排对比
- 历史记录存档

## 3. 页面状态模型

页面共享一份工作台状态 `calculatorState`，至少包含：

### 3.1 Model State

```ts
type SelectedModelState = {
  modelFamily: "deepseek-v4";
  modelId: "deepseek-v4-flash" | "deepseek-v4-pro";
};
```

### 3.2 Platform Input State

```ts
type PlatformInputState = {
  computeThroughputTflops: number | null;
  memoryBandwidthTbps: number | null;
  memoryCapacityGb: number | null;
  computeEfficiency: number;
  bandwidthEfficiency: number;
  batchSize: number;
  precisionAssumptions: string;
  useMemoryCeilingClamp: boolean;
};
```

默认值建议：

- `computeEfficiency = 0.7`
- `bandwidthEfficiency = 0.75`
- `batchSize = 1`
- `precisionAssumptions = "FP8 weights + BF16 activations + FP4 experts"`
- `useMemoryCeilingClamp = true`

### 3.3 Workload Input State

```ts
type WorkloadInputState = {
  prefillTokenLength: number | null;
  decodeContextLength: number | null;
  decodeOutputTokens: number | null;
  tokenRangeStart: number | null;
  tokenRangeEnd: number | null;
  tokenRangeStep: number | null;
  tokenSweepMode: "fixed-step";
};
```

默认值建议：

- `prefillTokenLength = 131072`
- `decodeContextLength = 131072`
- `decodeOutputTokens = 512`
- `tokenRangeStart = 4096`
- `tokenRangeEnd = 131072`
- `tokenRangeStep = 4096`
- `tokenSweepMode = "fixed-step"`

### 3.4 View State

```ts
type PerformancePageViewState = {
  showIntermediateMetrics: boolean;
  showFormulaTrace: boolean;
  selectedTrendMetric: "prefillTps" | "decodeTps" | "ttft" | "totalRuntimeMemory";
  showBottleneckBackground: boolean;
  showTrendDataPoints: boolean;
  selectedBreakdownMode: "prefill" | "decode";
};
```

默认值建议：

- `showIntermediateMetrics = true`
- `showFormulaTrace = true`
- `selectedTrendMetric = "prefillTps"`
- `showBottleneckBackground = true`
- `showTrendDataPoints = true`
- `selectedBreakdownMode = "prefill"`

### 3.5 Computation State

```ts
type CalculationStatus =
  | "idle"
  | "invalid"
  | "ready"
  | "calculating"
  | "calculated"
  | "error";
```

```ts
type CalculationState = {
  status: CalculationStatus;
  validationErrors: Record<string, string>;
  lastCalculatedAt: string | null;
  results: PerformanceResultState | null;
};
```

## 4. 结果数据契约

```ts
type PerformanceResultState = {
  summary: {
    ttftMs: number;
    prefillTps: number;
    decodeTps: number;
    totalRuntimeMemoryGb: number;
    prefillBottleneck: BottleneckType;
    decodeBottleneck: BottleneckType;
    memoryFitsCapacity: boolean | null;
    memoryExcessGb: number | null;
  };
  comparison: {
    dominantCostPrefill: string;
    dominantCostDecode: string;
    computeDemandPrefill: number;
    computeDemandDecode: number;
    memoryTrafficPrefill: number;
    memoryTrafficDecode: number;
    effectiveThroughputPrefill: number;
    effectiveThroughputDecode: number;
  };
  breakdown: {
    prefill: BreakdownRow[];
    decode: BreakdownRow[];
  };
  intermediateMetrics: IntermediateMetric[];
  memoryBreakdown: MemoryBreakdownRow[];
  formulaTrace: FormulaTraceSection[];
  tokenSweepSeries: TokenSweepSeriesPoint[];
  structureSummary: StructureSummarySnapshot;
};
```

```ts
type BottleneckType = "compute-bound" | "bandwidth-bound" | "memory-cap-limited";
```

```ts
type BreakdownRow = {
  module: "attention-core" | "compressor" | "indexer" | "moe" | "output-projection";
  value: number;
  share: number;
  boundBy: BottleneckType;
};
```

```ts
type IntermediateMetric = {
  key: string;
  symbol: string;
  value: number | string;
  unit: string;
  source: "config" | "derived" | "formula";
};
```

```ts
type MemoryBreakdownRow = {
  key: "weights" | "persistentDecodeCache" | "peakTempWorkingSet" | "runtimeOverhead" | "estimatedTotal";
  valueGb: number;
  share: number | null;
  note: string;
};
```

```ts
type FormulaTraceSection = {
  category: "prefill" | "decode" | "memory";
  rows: {
    label: string;
    expression: string;
    evaluated: string;
  }[];
};
```

```ts
type TokenSweepSeriesPoint = {
  tokenLength: number;
  prefillTps: number;
  decodeTps: number;
  ttftMs: number;
  totalRuntimeMemoryGb: number;
  prefillBottleneck: BottleneckType;
  decodeBottleneck: BottleneckType;
  intermediateSummary: {
    prefillFlops?: number;
    decodeCacheGb?: number;
    kvVisibleLength?: number;
  };
};
```

## 5. 布局规格

## 5.1 整体骨架

页面采用三层结构：

1. 左侧导航
2. 顶部应用栏
3. 主内容工作区

主内容工作区采用：

- `参数控制区`
- `结果分析区`

结果分析区采用 `60 / 40` 双列布局：

- 左列：核心分析与趋势图
- 右列：结构摘要、显存、公式追踪

## 5.2 参数控制区布局

参数控制区为四个卡片组，桌面默认一行，宽度不足时换成两行。

### Card 1: 模型选择

字段：

- `模型家族`
- `模型`

只读摘要：

- `Layers`
- `Hidden Size`
- `Attention Heads`
- `Experts`
- `Context Limit`

交互：

- 切换模型后，结构摘要、公式追踪和计算结果上下文都同步切换
- 切换模型不会自动清空平台参数

### Card 2: 输入长度

字段：

- `Prefill Token Length`
- `Decode Context Length`
- `Decode Output Tokens`

趋势图范围：

- `Token Sweep Start`
- `Token Sweep End`
- `Token Sweep Step`

快捷按钮：

- `4K`
- `32K`
- `128K`
- `1M`

交互：

- 点击快捷按钮时，应同时更新：
  - `prefillTokenLength`
  - `decodeContextLength`
  - 若当前趋势范围为空，可同步初始化 `tokenRangeEnd`
- `Start <= End`
- `Step > 0`
- `Step` 不允许大于 `End - Start`，若大于则显示校验错误

### Card 3: 平台参数

字段：

- `Compute Throughput (TFLOPS)`
- `Memory Bandwidth (TB/s)`
- `HBM / VRAM Capacity (GB)`
- `Platform Template`

首版要求：

- `Platform Template` 至少支持 `Custom`
- 模板切换后会写入对应默认值，但用户仍可继续修改

### Card 4: 计算假设

字段：

- `Batch Size`
- `Compute Efficiency`
- `Bandwidth Efficiency`
- `Use Memory Ceiling Clamp`
- `Show Intermediate Metrics`
- `Show Formula Trace`

交互：

- `Show Intermediate Metrics` 控制中间量表的展示，不影响计算
- `Show Formula Trace` 控制公式追踪卡的展示，不影响计算
- `Use Memory Ceiling Clamp` 会影响最终 `Prefill TPS` / `Decode TPS`

### 参数区底部操作条

组件：

- `计算性能`
- `重置`
- `复制当前配置`
- `状态提示`

状态规则：

- 所有必填项合法时：`ready`
- 存在非法输入时：`invalid`
- 点击计算后进入：`calculating`
- 计算完成：`calculated`

## 5.3 左列布局

### Section A: 核心指标卡组

四张卡：

- `TTFT`
- `Prefill TPS`
- `Decode TPS`
- `Total Runtime Memory`

每张卡必须显示：

- 主数值
- 单位
- 解释副标题
- 绑定标签

示例：

- `Prefill TPS`
  - main: `1234`
  - unit: `tokens/s`
  - sub: `Current platform estimate`
  - tag: `Compute-bound`

### Section B: Prefill / Decode 对比表

固定行：

- `Dominant Cost`
- `Compute Demand`
- `Memory Traffic`
- `Effective Throughput`
- `Latency`

展示规则：

- 统一左右列对比
- 单位明确
- 对差异大的行做视觉强调

### Section C: Token 趋势图区

这是页面的一等区域，默认展开。

#### 顶部控制

字段：

- `Metric`
  - `Prefill TPS`
  - `Decode TPS`
  - `TTFT`
  - `Total Runtime Memory`
- `Sweep Mode`
  - 首版固定 `Fixed Step`
- `Show Bottleneck Background`
- `Show Data Points`

#### 图表契约

X 轴：

- `Token Length`

Y 轴：

- 由 `selectedTrendMetric` 决定

展示规则：

- 若 `selectedTrendMetric` 为 `prefillTps`：
  - 主曲线显示 `prefillTps`
  - 次曲线可同时显示 `decodeTps`
- 若 `selectedTrendMetric` 为 `decodeTps`：
  - 主曲线显示 `decodeTps`
  - 次曲线可同时显示 `prefillTps`
- 若 `selectedTrendMetric` 为 `ttft` 或 `totalRuntimeMemory`：
  - 单曲线模式

Tooltip 必须显示：

- `Token Length`
- 当前曲线值
- `Prefill Bottleneck`
- `Decode Bottleneck`
- 至少一个中间量摘要

数据生成规则：

- 使用 `[tokenRangeStart, tokenRangeEnd]` 按 `tokenRangeStep` 生成离散点
- 每个点都调用同一套计算逻辑重新求值
- 禁止仅通过 UI 插值生成伪数据点

边界规则：

- 若点数超过 `500`，前端应提示范围过密，并阻止直接计算
- 若点数低于 `2`，不生成趋势图，显示校验提示

### Section D: 瓶颈拆解区

组件：

- `Breakdown Mode Toggle`
  - `Prefill`
  - `Decode`
- 堆叠条 / 条形图
- 明细表

模块固定为：

- `Attention Core`
- `Compressor`
- `Indexer`
- `MoE`
- `Output Projection`

### Section E: 中间量结果表

默认展示，受 `Show Intermediate Metrics` 控制。

列固定为：

- `Metric`
- `Symbol`
- `Value`
- `Unit`
- `Source`

排序规则：

- 先展示 summary 直接相关项
- 再展示 prefill
- 再展示 decode
- 再展示 memory

## 5.4 右列布局

### Section A: 模型结构摘要卡

内容：

- `Decoder Layers`
- `Attention Heads`
- `Head Dim`
- `KV Heads`
- `MoE Experts`
- `Hash-MoE Layers`
- `Compression Schedule`

底部按钮：

- `查看完整结构页`

### Section B: 显存需求分析卡

固定分段：

- `Weights`
- `Persistent Decode Cache`
- `Peak Temp Working Set`
- `Runtime Overhead`
- `Estimated Total`

每段显示：

- 绝对值
- 占比
- 注释

若填写了 `memoryCapacityGb`：

- 显示 `Fits Capacity` 或 `Exceeds Capacity`
- 若超出，显示超出量

### Section C: 公式追踪卡

Tab：

- `Prefill`
- `Decode`
- `Memory`

每行显示：

- `label`
- `expression`
- `evaluated`

底部按钮：

- `查看完整公式说明页`

### Section D: 假设与备注卡

内容：

- 当前平台假设
- 精度假设
- 模型来源
- 解析估算免责声明

## 6. 交互流程

## 6.1 首次进入

- 页面加载默认模型：`deepseek-v4-flash`
- 使用默认 token 与假设值填充表单
- 若关键平台参数为空，则结果区显示空态

## 6.2 输入与校验

校验规则：

- 所有数值字段必须为正数
- `tokenRangeStart <= tokenRangeEnd`
- `tokenRangeStep > 0`
- `tokenRangeStep <= tokenRangeEnd - tokenRangeStart`，除非 `Start == End`
- `batchSize >= 1`
- `computeEfficiency`、`bandwidthEfficiency` 应限制在 `(0, 1]`

校验失败时：

- 保持现有结果不清空
- 顶部状态改为 `invalid`
- 对应字段显示错误

## 6.3 计算触发

首版采用显式触发：

- 点击 `计算性能` 才执行计算

触发后必须一次性产出：

- 单点 summary 结果
- comparison
- breakdown
- memory breakdown
- formula trace
- token sweep series

## 6.4 页面跳转

- 点击 `查看完整结构页` 跳转 `模型结构`
- 点击 `查看完整公式说明页` 跳转 `公式说明`
- 跳转时保持当前模型和输入状态

## 7. 组件清单

页面至少需要这些前端组件：

- `ModelSelectorCard`
- `WorkloadInputCard`
- `PlatformInputCard`
- `CalculationAssumptionsCard`
- `CalculationToolbar`
- `SummaryMetricCards`
- `PrefillDecodeComparisonTable`
- `TokenTrendChartPanel`
- `BottleneckBreakdownPanel`
- `IntermediateMetricsTable`
- `StructureSummaryCard`
- `MemoryBreakdownCard`
- `FormulaTraceCard`
- `AssumptionsNoteCard`

## 8. 图表实现约束

- 趋势图组件必须支持多序列和 tooltip 自定义
- breakdown 图必须支持模块占比展示
- 所有图表颜色语义必须稳定：
  - `Prefill` 一套固定色
  - `Decode` 一套固定色
  - `Memory` 一套固定色
  - `MoE / Attention / Indexer / Compressor / Output` 各自固定色

## 9. 空态与异常态

### 空态

- 结果区显示引导说明
- 说明需要先填写平台参数并点击计算

### 计算失败态

- 保留用户输入
- 在结果区顶部显示错误条
- 错误信息要区分：
  - 输入非法
  - 计算逻辑错误
  - 不支持的模型策略

### 超显存态

- 不阻止展示结果
- 显存卡和 summary 卡明确标出超出

## 10. 验收标准

- 页面可在不切页的情况下完成一次完整计算
- 单点结果和 token 趋势图使用同一套输入上下文
- token 范围可配置，且趋势图不是静态占位
- 显存分析中必须包含 `weights`
- 趋势图 tooltip 能看到 token 值、指标值和瓶颈分类
- 结构摘要和公式追踪都能跳转到对应页面

## 11. 后续扩展预留

- `Platform Template` 扩展为预置 GPU 列表
- `tokenSweepMode` 扩展为 `log-scale`
- 支持多模型横向趋势对比
- 支持导出当前图表与配置
