export type ModelFamily = string;

export type ModelId = string;

export type FormulaStrategyId =
  | "deepseek-v4-compressed-moe"
  | "dense-decoder-transformer";

export type ModelDefinition = {
  family: ModelFamily;
  id: ModelId;
  displayName: string;
  architectureKind: "compressed-moe" | "dense-decoder";
  formulaStrategyId: FormulaStrategyId;
  configSource?: string;
  contextLimit: number;
  decoderLayers: number;
  hiddenSize: number;
  attentionHeads: number;
  kvHeads: number;
  headDim: number;
  qLoraRank: number;
  oLoraRank: number;
  oGroups: number;
  indexHeads: number;
  indexHeadDim: number;
  indexTopk: number;
  slidingWindow: number;
  csaCompressRate: number;
  hcaCompressRate: number;
  moeExperts: number;
  activeExperts: number;
  moeIntermediateSize: number;
  csaLayerCount: number;
  hcaLayerCount: number;
  slidingLayerCount: number;
  estimatedWeightsGb: number;
};
