# Formula Notes Page Spec

## 1. 页面目的

`Formula Notes` 页面用于解释性能计算页中的公式口径，让用户能从结果值追溯到公式、变量定义、模型字段和平台输入。

页面重点是“可审计”，不是写成论文式长文。用户应能快速定位：

- `TTFT` 如何得到
- `Prefill TPS` 如何受算力和带宽限制
- `Decode TPS` 如何受 cache / weight / bandwidth 限制
- `Decode` 阶段内存为什么必须包含 weight

关联效果图：

- `docs/app/design/images/formula-notes-v1.png`

## 2. 页面范围

本页负责：

- 公式目录
- prefill 算力公式
- decode 性能公式
- decode 内存公式
- 符号表
- 与当前模型参数的代入示例

本页不负责：

- 完整模型结构图
- 公式编辑器
- 自动证明或 notebook 计算

## 3. 页面布局

页面复用应用左侧导航和顶部应用栏，主内容采用三列工作台：

- 左侧：公式章节目录
- 中间：公式正文和代入结果
- 右侧：符号表与当前模型摘要

桌面布局：

- `220px / minmax(0, 1fr) / 340px`

窄屏布局：

- 章节目录变为顶部 tabs
- 右侧符号表下移

## 4. 章节目录

章节：

- `Prefill FLOPs`
- `Prefill TPS`
- `Decode TPS`
- `Decode Memory`
- `Symbol Table`

交互：

- 点击章节滚动到对应公式块
- 当前章节高亮
- 首版可先用静态按钮，不做滚动监听

## 5. 公式正文

每个公式块包含：

- 标题
- 公式表达式
- 变量解释
- 当前模型代入值
- 结果单位
- 适用阶段

### 5.1 Prefill FLOPs

核心公式：

```text
F_prefill
  = N_sliding * F_sliding
  + N_csa * F_csa
  + N_hca * F_hca
```

关键子项：

```text
F_Q = 2 * S * (D * r_q + r_q * n_h * c)
F_core = 4 * S * L_kv * n_h * c
F_indexer_attn = S^2 * n_h_I * c_I / m_csa
F_moe = 6 * S * D * I * (k + 1)
```

### 5.2 Prefill TPS

```text
TPS_prefill
  = min(
      S * effective_compute / F_prefill,
      S * effective_bandwidth / B_prefill
    )
```

其中：

```text
effective_compute = platform_tflops * compute_efficiency
effective_bandwidth = memory_bandwidth * bandwidth_efficiency
```

### 5.3 Decode TPS

```text
TPS_decode
  = min(
      decode_compute_ceiling,
      decode_bandwidth_ceiling
    )
```

首版实现采用工程近似，后续需要继续细化逐算子 decode FLOPs。

### 5.4 Decode 阶段内存需求公式

必须单独成章，且必须考虑权重：

```text
M_decode_total
  ~= M_weights
   + M_decode_cache
   + M_decode_tmp_peak
   + M_runtime_overhead
```

说明：

- `M_weights` 是模型权重常驻显存，decode 阶段不能忽略
- `M_decode_cache` 是跨 token 持续存在的 cache 状态
- `M_decode_tmp_peak` 是单步 attention / matmul 的瞬时工作集峰值
- `M_runtime_overhead` 是框架、allocator、kernel workspace 的额外开销

## 6. 符号表

列：

- `Symbol`
- `Meaning`
- `Source`
- `Example`

示例：

- `S`: token length，来源 workload
- `D`: hidden size，来源 model config
- `n_h`: attention heads，来源 model config
- `c`: head dim，来源 model config
- `m_csa`: CSA compress rate，来源 model config
- `M_weights`: weight memory，来源 model definition / estimate

## 7. 当前模型代入区

右侧固定显示当前模型摘要：

- 模型名
- `F_prefill` 当前估算
- `M_weights`
- `M_decode_cache`
- `M_decode_tmp_peak`
- `M_decode_total`

首版可以使用默认模型 `DeepSeek-V4-Flash`，后续与全局模型选择状态打通。

## 8. 首版实现边界

首版采用静态公式说明 + 当前模型静态代入摘要。

后续可增加：

- 从性能计算页带入当前参数
- 点击公式变量高亮相关输入字段
- 公式块复制
- 公式版本号和来源文档链接
