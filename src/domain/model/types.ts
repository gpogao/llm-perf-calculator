export type ModelFamily = string;

export type ModelId = string;

export type FormulaStrategyId =
  | "deepseek-v4-compressed-moe"
  | "dense-decoder-transformer"
  | "hybrid-linear-moe";

export type ModelDefinition = {
  family: ModelFamily;
  id: ModelId;
  displayName: string;
  architectureKind: "compressed-moe" | "dense-decoder" | "hybrid-linear-moe";
  formulaStrategyId: FormulaStrategyId;
  configSource?: string;
  contextLimit: number;
  decoderLayers: number;
  hiddenSize: number;
  attentionHeads: number;
  kvHeads: number;
  headDim: number;

  // —— compressed-moe / DeepSeek V4 专用 ——
  qLoraRank: number;
  oLoraRank: number;
  oGroups: number;
  indexHeads: number;
  indexHeadDim: number;
  indexTopk: number;
  csaCompressRate: number;
  hcaCompressRate: number;
  moeExperts: number;
  activeExperts: number;
  moeIntermediateSize: number;
  csaLayerCount: number;
  hcaLayerCount: number;

  // —— 通用 ——
  slidingWindow: number;

  // —— dense-decoder 专用 (optional for compressed-moe) ——
  /** FFN intermediate_size（dense 模型用，替代 moeIntermediateSize） */
  intermediateSize?: number;
  /** 全局注意力（full_attention）层数 */
  fullAttentionLayerCount?: number;
  /** 滑动窗口注意力（sliding_attention）层数 */
  slidingAttentionLayerCount?: number;
  /** full_attention 层的 head_dim */
  globalHeadDim?: number;
  /** full_attention 层的 KV 头数（MQA 通常为 1） */
  numGlobalKeyValueHeads?: number;
  /** full_attention 层 K=V 是否共享投影 */
  attentionKEqV?: boolean;
  /** FFN 激活函数 */
  hiddenActivation?: string;

  // —— hybrid-linear-moe 专用 ——
  /** Gated DeltaNet 线性注意层数 */
  linearAttentionLayerCount?: number;
  /** 线性注意 key 头数 */
  linearNumKeyHeads?: number;
  /** 线性注意 key 头维度 */
  linearKeyHeadDim?: number;
  /** 线性注意 value 头数 */
  linearNumValueHeads?: number;
  /** 线性注意 value 头维度 */
  linearValueHeadDim?: number;
  /** 线性注意 conv kernel 大小 */
  linearConvKernelDim?: number;

  // —— 同时适用 ——
  /** DeepSeek V4: 纯 sliding (无压缩) 层数; Dense: 等价 slidingAttentionLayerCount */
  slidingLayerCount: number;

  /** 总参数量（B = 10^9），用于 weight memory 计算 */
  totalParamsB: number;
  /** 专家参数量（B = 10^9），MoE 模型用；dense 模型填 0 */
  totalExpertParamsB: number;

  /** @deprecated 由 bytesPerWeight / bytesPerExpert 动态计算替代 */
  estimatedWeightsGb: number;
};
