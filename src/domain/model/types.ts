export type ModelFamily = "deepseek-v4";

export type ModelId = "deepseek-v4-flash" | "deepseek-v4-pro";

export type ModelDefinition = {
  family: ModelFamily;
  id: ModelId;
  displayName: string;
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
