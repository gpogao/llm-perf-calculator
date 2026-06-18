import type { ModelDefinition } from "../../domain/model/types";

export const gemma4Models: ModelDefinition[] = [
  {
    family: "gemma-4",
    id: "gemma-4-12b-it",
    displayName: "Gemma-4-12B-it",
    architectureKind: "dense-decoder",
    formulaStrategyId: "dense-decoder-transformer",
    configSource: "docs/gemma_4/config/gemma-4-12B-it-config.json",
    contextLimit: 131072,
    decoderLayers: 48,
    hiddenSize: 3840,
    attentionHeads: 16,
    kvHeads: 8,
    headDim: 256,

    // —— compressed-moe 字段（不适用，填 0） ——
    qLoraRank: 0,
    oLoraRank: 0,
    oGroups: 0,
    indexHeads: 0,
    indexHeadDim: 0,
    indexTopk: 0,
    csaCompressRate: 0,
    hcaCompressRate: 0,
    moeExperts: 0,
    activeExperts: 0,
    moeIntermediateSize: 0,
    csaLayerCount: 0,
    hcaLayerCount: 0,

    // —— 通用 ——
    slidingWindow: 1024,
    slidingLayerCount: 40,

    // —— dense-decoder 专用 ——
    intermediateSize: 15360,
    fullAttentionLayerCount: 8,
    slidingAttentionLayerCount: 40,
    globalHeadDim: 512,
    numGlobalKeyValueHeads: 1,
    attentionKEqV: true,
    hiddenActivation: "gelu_pytorch_tanh",

    totalParamsB: 11.91,
    totalExpertParamsB: 0,
    estimatedWeightsGb: 23.82
  }
];
