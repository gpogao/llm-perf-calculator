import type { ModelDefinition } from "../../../domain/model/types";
import type {
  BottleneckType,
  ComparisonRow,
  FormulaTraceSection,
  IntermediateMetric,
  PerformanceResult,
  TokenSweepPoint
} from "../../../domain/performance/types";
import type { PlatformInput } from "../../../domain/platform/types";
import type { WorkloadInput } from "../../../domain/workload/types";

type LayerBreakdown = {
  q: number;
  kvProj: number;
  core: number;
  compressor: number;
  indexerLin: number;
  indexerAttn: number;
  output: number;
  moe: number;
  total: number;
};

type FullComputation = {
  prefillFlops: number;
  decodeBytes: number;
  decodeCacheBytes: number;
  decodeWeightBytes: number;
  weightGb: number;
  cacheGb: number;
  persistentSlidingCacheBytes: number;
  persistentHcaCacheBytes: number;
  persistentCsaCacheBytes: number;
  persistentSlidingCacheTotalBytes: number;
  persistentHcaCacheTotalBytes: number;
  persistentCsaCacheTotalBytes: number;
  tmpPeakGb: number;
  tmpPeakBytes: number;
  tmpPeakLkv: number;
  overheadGb: number;
  totalRuntimeMemoryGb: number;
  prefillComputeTps: number;
  prefillBandwidthTps: number;
  decodeComputeTps: number;
  decodeBandwidthTps: number;
  decodeComputeFlopsPerToken: number;
  decodeSlidingLkv: number;
  decodeCsaLkv: number;
  decodeHcaLkv: number;
  decodeSlidingBytesPerToken: number;
  decodeCsaBytesPerToken: number;
  decodeHcaBytesPerToken: number;
  prefillTps: number;
  decodeTps: number;
  ttftMs: number;
  prefillBottleneck: BottleneckType;
  decodeBottleneck: BottleneckType;
  memoryFitsCapacity: boolean;
  slidingLayer: LayerBreakdown;
  csaLayer: LayerBreakdown;
  hcaLayer: LayerBreakdown;
};

function gbpsToBytesPerSecond(valueGbps: number) {
  return valueGbps * 1_000_000_000;
}

function toFlops(valueTflops: number) {
  return valueTflops * 1_000_000_000_000;
}

function bytesToGb(bytes: number) {
  return bytes / 1_000_000_000;
}

function formatTflops(value: number) {
  return `${(value / 1e12).toFixed(2)} T`;
}

function formatGflops(value: number) {
  return `${(value / 1e9).toFixed(2)} G`;
}

function formatMb(value: number) {
  return `${(value / 1_000_000).toFixed(2)} MB`;
}

function formatLayerContribution(
  layer: LayerBreakdown,
  layerCount: number,
  key: keyof LayerBreakdown
) {
  if (layerCount === 0) {
    return "0.00 T";
  }

  return `${formatTflops(layer[key])} x ${layerCount} = ${formatTflops(layer[key] * layerCount)}`;
}

function inferBottleneck(
  computeLimit: number,
  bandwidthLimit: number
): BottleneckType {
  return computeLimit <= bandwidthLimit ? "compute-bound" : "bandwidth-bound";
}

function flopsQ(model: ModelDefinition, sequenceLength: number) {
  return (
    2 *
    sequenceLength *
    (model.hiddenSize * model.qLoraRank +
      model.qLoraRank * model.attentionHeads * model.headDim)
  );
}

function flopsKvProj(model: ModelDefinition, sequenceLength: number) {
  return 2 * sequenceLength * model.hiddenSize * model.headDim;
}

function flopsCore(
  model: ModelDefinition,
  sequenceLength: number,
  layerType: "sliding" | "csa" | "hca"
) {
  const lkv =
    layerType === "sliding"
      ? model.slidingWindow
      : layerType === "csa"
        ? model.slidingWindow + model.indexTopk
        : model.slidingWindow +
          Math.ceil(sequenceLength / (2 * model.hcaCompressRate));

  return 4 * sequenceLength * lkv * model.attentionHeads * model.headDim;
}

function flopsCompressor(
  model: ModelDefinition,
  sequenceLength: number,
  layerType: "sliding" | "csa" | "hca"
) {
  if (layerType === "sliding") {
    return 0;
  }

  const coeff = layerType === "csa" ? 8 : 4;
  return coeff * sequenceLength * model.hiddenSize * model.headDim;
}

function flopsIndexerLin(model: ModelDefinition, sequenceLength: number) {
  return (
    sequenceLength *
    (8 * model.hiddenSize * model.indexHeadDim +
      2 * model.qLoraRank * model.indexHeads * model.indexHeadDim +
      2 * model.hiddenSize * model.indexHeads)
  );
}

function flopsIndexerAttn(model: ModelDefinition, sequenceLength: number) {
  return (
    sequenceLength *
    sequenceLength *
    model.indexHeads *
    model.indexHeadDim /
    model.csaCompressRate
  );
}

function flopsOutput(model: ModelDefinition, sequenceLength: number) {
  return (
    2 *
    sequenceLength *
    (model.attentionHeads * model.headDim * model.oLoraRank +
      model.oGroups * model.oLoraRank * model.hiddenSize)
  );
}

function flopsMoe(model: ModelDefinition, sequenceLength: number) {
  return (
    6 *
    sequenceLength *
    model.hiddenSize *
    model.moeIntermediateSize *
    (model.activeExperts + 1)
  );
}

function layerBreakdown(
  model: ModelDefinition,
  sequenceLength: number,
  layerType: "sliding" | "csa" | "hca"
): LayerBreakdown {
  const q = flopsQ(model, sequenceLength);
  const kvProj = flopsKvProj(model, sequenceLength);
  const core = flopsCore(model, sequenceLength, layerType);
  const compressor = flopsCompressor(model, sequenceLength, layerType);
  const indexerLin = layerType === "csa" ? flopsIndexerLin(model, sequenceLength) : 0;
  const indexerAttn = layerType === "csa" ? flopsIndexerAttn(model, sequenceLength) : 0;
  const output = flopsOutput(model, sequenceLength);
  const moe = flopsMoe(model, sequenceLength);
  const total = q + kvProj + core + compressor + indexerLin + indexerAttn + output + moe;

  return { q, kvProj, core, compressor, indexerLin, indexerAttn, output, moe, total };
}

function decodeCacheBytes(
  model: ModelDefinition,
  batchSize: number,
  contextLength: number
) {
  return (
    model.slidingLayerCount *
      persistentSlidingCacheBytes(model, batchSize) +
    model.hcaLayerCount *
      persistentHcaCacheBytes(model, batchSize, contextLength) +
    model.csaLayerCount *
      persistentCsaCacheBytes(model, batchSize, contextLength)
  );
}

function persistentSlidingCacheBytes(
  model: ModelDefinition,
  batchSize: number
) {
  const e = 2;
  return batchSize * e * (model.slidingWindow - 1) * model.headDim;
}

function persistentHcaCacheBytes(
  model: ModelDefinition,
  batchSize: number,
  contextLength: number
) {
  const e = 2;
  return (
    batchSize *
    e *
    ((model.slidingWindow - 1) * model.headDim +
      Math.floor(contextLength / model.hcaCompressRate) * model.headDim +
      2 * (contextLength % model.hcaCompressRate) * model.headDim)
  );
}

function persistentCsaCacheBytes(
  model: ModelDefinition,
  batchSize: number,
  contextLength: number
) {
  const e = 2;
  return (
    batchSize *
    e *
    ((model.slidingWindow - 1) * model.headDim +
      Math.floor(contextLength / model.csaCompressRate) *
        (model.headDim + model.indexHeadDim) +
      4 *
        (contextLength % model.csaCompressRate) *
        (model.headDim + model.indexHeadDim) +
      2 * model.csaCompressRate * (model.headDim + model.indexHeadDim))
  );
}

function decodeTmpPeakBytes(
  model: ModelDefinition,
  batchSize: number,
  contextLength: number
) {
  const e = 2;
  const csaLkv = decodeCsaLkv(model, contextLength);
  const hcaLkv = decodeHcaLkv(model, contextLength);
  const peakLkv = Math.max(csaLkv, hcaLkv, model.slidingWindow);

  return batchSize * e * 2 * model.attentionHeads * peakLkv * model.headDim;
}

function decodeCsaLkv(model: ModelDefinition, contextLength: number) {
  return (
    model.slidingWindow +
    Math.min(model.indexTopk, Math.floor(contextLength / model.csaCompressRate))
  );
}

function decodeHcaLkv(model: ModelDefinition, contextLength: number) {
  return model.slidingWindow + Math.floor(contextLength / model.hcaCompressRate);
}

function decodeLayerBytesPerToken(
  model: ModelDefinition,
  lkv: number,
  batchSize = 1
) {
  const e = 2;
  return batchSize * 2 * model.attentionHeads * lkv * model.headDim * e;
}

function decodeBytesPerToken(
  model: ModelDefinition,
  contextLength: number,
  batchSize = 1
) {
  const slidingBytes = decodeLayerBytesPerToken(model, model.slidingWindow, batchSize);
  const csaBytes = decodeLayerBytesPerToken(
    model,
    decodeCsaLkv(model, contextLength),
    batchSize
  );
  const hcaBytes = decodeLayerBytesPerToken(
    model,
    decodeHcaLkv(model, contextLength),
    batchSize
  );

  return (
    model.slidingLayerCount * slidingBytes +
    model.csaLayerCount * csaBytes +
    model.hcaLayerCount * hcaBytes
  );
}

function computeFullResult(
  model: ModelDefinition,
  platform: PlatformInput,
  workload: WorkloadInput,
  sequenceLength: number
): FullComputation {
  const slidingLayer = layerBreakdown(model, sequenceLength, "sliding");
  const csaLayer = layerBreakdown(model, sequenceLength, "csa");
  const hcaLayer = layerBreakdown(model, sequenceLength, "hca");
  const prefillFlops =
    model.slidingLayerCount * slidingLayer.total +
    model.csaLayerCount * csaLayer.total +
    model.hcaLayerCount * hcaLayer.total;
  const weightGb = model.estimatedWeightsGb;
  const persistentSlidingCache = persistentSlidingCacheBytes(
    model,
    platform.batchSize
  );
  const persistentHcaCache = persistentHcaCacheBytes(
    model,
    platform.batchSize,
    workload.decodeContextLength
  );
  const persistentCsaCache = persistentCsaCacheBytes(
    model,
    platform.batchSize,
    workload.decodeContextLength
  );
  const persistentSlidingCacheTotal =
    model.slidingLayerCount * persistentSlidingCache;
  const persistentHcaCacheTotal = model.hcaLayerCount * persistentHcaCache;
  const persistentCsaCacheTotal = model.csaLayerCount * persistentCsaCache;
  const cacheBytes =
    persistentSlidingCacheTotal + persistentHcaCacheTotal + persistentCsaCacheTotal;
  const cacheGb = bytesToGb(cacheBytes);
  const tmpPeakBytes = decodeTmpPeakBytes(
    model,
    platform.batchSize,
    workload.decodeContextLength
  );
  const tmpPeakGb = bytesToGb(tmpPeakBytes);
  const tmpPeakLkv = Math.max(
    decodeCsaLkv(model, workload.decodeContextLength),
    decodeHcaLkv(model, workload.decodeContextLength),
    model.slidingWindow
  );
  const overheadGb = Math.max(4, weightGb * 0.03);
  const totalRuntimeMemoryGb = weightGb + cacheGb + tmpPeakGb + overheadGb;
  const memoryFitsCapacity = totalRuntimeMemoryGb <= platform.memoryCapacityGb;
  const effectiveCompute = toFlops(platform.computeThroughputTflops * platform.computeEfficiency);
  const effectiveBandwidth = gbpsToBytesPerSecond(
    platform.memoryBandwidthGbps * platform.bandwidthEfficiency
  );
  const prefillComputeTps = (effectiveCompute * sequenceLength) / prefillFlops;
  const prefillTrafficBytes =
    (weightGb * 1_000_000_000 + cacheGb * 1_000_000_000 * 0.1) * platform.batchSize;
  const prefillBandwidthTps = (effectiveBandwidth * sequenceLength) / prefillTrafficBytes;
  const decodeSlidingLkv = model.slidingWindow;
  const decodeCsaVisibleLength = decodeCsaLkv(model, workload.decodeContextLength);
  const decodeHcaVisibleLength = decodeHcaLkv(model, workload.decodeContextLength);
  const decodeSlidingBytesPerToken = decodeLayerBytesPerToken(
    model,
    decodeSlidingLkv,
    platform.batchSize
  );
  const decodeCsaBytesPerToken = decodeLayerBytesPerToken(
    model,
    decodeCsaVisibleLength,
    platform.batchSize
  );
  const decodeHcaBytesPerToken = decodeLayerBytesPerToken(
    model,
    decodeHcaVisibleLength,
    platform.batchSize
  );
  const decodeCacheTrafficBytes = decodeBytesPerToken(
    model,
    workload.decodeContextLength,
    platform.batchSize
  );
  const decodeWeightBytes = weightGb * 1_000_000_000;
  const decodeBytes = decodeWeightBytes + decodeCacheTrafficBytes;
  const decodeComputeFlopsPerToken =
    (model.decoderLayers * model.hiddenSize * model.moeIntermediateSize * (model.activeExperts + 1)) /
    3;
  const decodeComputeTps = effectiveCompute / decodeComputeFlopsPerToken;
  const decodeBandwidthTps = effectiveBandwidth / decodeBytes;
  const prefillTps = Math.min(prefillComputeTps, prefillBandwidthTps);
  const decodeTps = Math.min(decodeComputeTps, decodeBandwidthTps);
  const ttftMs = (sequenceLength / Math.max(prefillTps, 1e-6)) * 1000;

  return {
    prefillFlops,
    decodeBytes,
    decodeCacheBytes: decodeCacheTrafficBytes,
    decodeWeightBytes,
    weightGb,
    cacheGb,
    persistentSlidingCacheBytes: persistentSlidingCache,
    persistentHcaCacheBytes: persistentHcaCache,
    persistentCsaCacheBytes: persistentCsaCache,
    persistentSlidingCacheTotalBytes: persistentSlidingCacheTotal,
    persistentHcaCacheTotalBytes: persistentHcaCacheTotal,
    persistentCsaCacheTotalBytes: persistentCsaCacheTotal,
    tmpPeakGb,
    tmpPeakBytes,
    tmpPeakLkv,
    overheadGb,
    totalRuntimeMemoryGb,
    prefillComputeTps,
    prefillBandwidthTps,
    decodeComputeTps,
    decodeBandwidthTps,
    decodeComputeFlopsPerToken,
    decodeSlidingLkv,
    decodeCsaLkv: decodeCsaVisibleLength,
    decodeHcaLkv: decodeHcaVisibleLength,
    decodeSlidingBytesPerToken,
    decodeCsaBytesPerToken,
    decodeHcaBytesPerToken,
    prefillTps,
    decodeTps,
    ttftMs,
    prefillBottleneck: inferBottleneck(prefillComputeTps, prefillBandwidthTps),
    decodeBottleneck: inferBottleneck(decodeComputeTps, decodeBandwidthTps),
    memoryFitsCapacity,
    slidingLayer,
    csaLayer,
    hcaLayer
  };
}

function buildComparisonRows(result: FullComputation): ComparisonRow[] {
  return [
    {
      label: "Dominant Cost",
      unit: "-",
      prefill: result.prefillBottleneck,
      decode: result.decodeBottleneck
    },
    {
      label: "Compute Ceiling",
      unit: "tokens/s",
      prefill: result.prefillComputeTps.toFixed(2),
      decode: result.decodeComputeTps.toFixed(2)
    },
    {
      label: "Bandwidth Ceiling",
      unit: "tokens/s",
      prefill: result.prefillBandwidthTps.toFixed(2),
      decode: result.decodeBandwidthTps.toFixed(2)
    },
    {
      label: "Effective Throughput",
      unit: "tokens/s",
      prefill: result.prefillTps.toFixed(2),
      decode: result.decodeTps.toFixed(2)
    },
    {
      label: "Latency",
      unit: "ms",
      prefill: result.ttftMs.toFixed(0),
      decode: (1000 / Math.max(result.decodeTps, 1e-6)).toFixed(2)
    }
  ];
}

function buildIntermediateMetrics(
  model: ModelDefinition,
  platform: PlatformInput,
  workload: WorkloadInput,
  result: FullComputation
): IntermediateMetric[] {
  return [
    {
      key: "hidden_size",
      label: "Hidden Size",
      symbol: "D",
      value: String(model.hiddenSize),
      unit: "-",
      source: "config"
    },
    {
      key: "sequence_length",
      label: "Prefill Sequence Length",
      symbol: "S",
      value: workload.prefillTokenLength.toLocaleString(),
      unit: "tokens",
      source: "config"
    },
    {
      key: "prefill_flops",
      label: "Prefill FLOPs",
      symbol: "F_prefill",
      value: formatTflops(result.prefillFlops),
      unit: "FLOPs",
      source: "formula"
    },
    {
      key: "prefill_compute_ceiling",
      label: "Prefill Compute Ceiling",
      symbol: "TPS_compute",
      value: result.prefillComputeTps.toFixed(2),
      unit: "tokens/s",
      source: "derived"
    },
    {
      key: "decode_bandwidth_bytes",
      label: "Decode Total Traffic Per Token",
      symbol: "B_decode",
      value: (result.decodeBytes / 1_000_000).toFixed(2),
      unit: "MB/token",
      source: "formula"
    },
    {
      key: "decode_weight_bytes",
      label: "Decode Weight Read Per Token",
      symbol: "B_weights",
      value: (result.decodeWeightBytes / 1_000_000).toFixed(2),
      unit: "MB/token",
      source: "formula"
    },
    {
      key: "decode_cache_bytes",
      label: "Decode Cache Traffic Per Token",
      symbol: "B_cache",
      value: (result.decodeCacheBytes / 1_000_000).toFixed(2),
      unit: "MB/token",
      source: "formula"
    },
    {
      key: "weights_memory",
      label: "Weight Memory",
      symbol: "M_weights",
      value: result.weightGb.toFixed(2),
      unit: "GB",
      source: "config"
    },
    {
      key: "decode_cache",
      label: "Persistent Decode Cache",
      symbol: "M_cache",
      value: result.cacheGb.toFixed(3),
      unit: "GB",
      source: "formula"
    },
    {
      key: "tmp_peak",
      label: "Single-step Temp Peak",
      symbol: "M_tmp",
      value: result.tmpPeakGb.toFixed(3),
      unit: "GB",
      source: "formula"
    },
    {
      key: "memory_capacity",
      label: "Capacity",
      symbol: "M_cap",
      value: platform.memoryCapacityGb.toFixed(0),
      unit: "GB",
      source: "config"
    }
  ];
}

function buildFormulaTrace(
  model: ModelDefinition,
  workload: WorkloadInput,
  result: FullComputation
): FormulaTraceSection[] {
  return [
    {
      category: "prefill",
      rows: [
        {
          label: "Q path FLOPs",
          expression: "2 * S * (D * r_q + r_q * n_h * c)",
          evaluated: `${formatTflops(result.csaLayer.q)} per layer; all layers = ${formatTflops(
            result.csaLayer.q * model.decoderLayers
          )}`
        },
        {
          label: "KV projection FLOPs",
          expression: "2 * S * D * c",
          evaluated: `${formatTflops(result.csaLayer.kvProj)} per layer; all layers = ${formatTflops(
            result.csaLayer.kvProj * model.decoderLayers
          )}`
        },
        {
          label: "Sliding core attention FLOPs",
          expression: "4 * S * sliding_window * n_h * c",
          evaluated: formatLayerContribution(
            result.slidingLayer,
            model.slidingLayerCount,
            "core"
          )
        },
        {
          label: "CSA core attention FLOPs",
          expression: "4 * S * (sliding_window + index_topk) * n_h * c",
          evaluated: formatLayerContribution(result.csaLayer, model.csaLayerCount, "core")
        },
        {
          label: "HCA core attention FLOPs",
          expression: "4 * S * (sliding_window + ceil(S / (2 * m_hca))) * n_h * c",
          evaluated: formatLayerContribution(result.hcaLayer, model.hcaLayerCount, "core")
        },
        {
          label: "CSA compressor FLOPs",
          expression: "8 * S * D * c",
          evaluated: formatLayerContribution(
            result.csaLayer,
            model.csaLayerCount,
            "compressor"
          )
        },
        {
          label: "HCA compressor FLOPs",
          expression: "4 * S * D * c",
          evaluated: formatLayerContribution(
            result.hcaLayer,
            model.hcaLayerCount,
            "compressor"
          )
        },
        {
          label: "CSA indexer linear FLOPs",
          expression: "S * (8*D*c_I + 2*r_q*n_h_I*c_I + 2*D*n_h_I)",
          evaluated: formatLayerContribution(
            result.csaLayer,
            model.csaLayerCount,
            "indexerLin"
          )
        },
        {
          label: "CSA indexer attn FLOPs",
          expression: "S^2 * n_h^I * c^I / m_csa",
          evaluated: formatLayerContribution(
            result.csaLayer,
            model.csaLayerCount,
            "indexerAttn"
          )
        },
        {
          label: "Output path FLOPs",
          expression: "2 * S * (n_h*c*r_o + o_groups*r_o*D)",
          evaluated: `${formatTflops(result.csaLayer.output)} per layer; all layers = ${formatTflops(
            result.csaLayer.output * model.decoderLayers
          )}`
        },
        {
          label: "MoE FLOPs",
          expression: "6 * S * D * I * (k + 1)",
          evaluated: `${formatTflops(result.csaLayer.moe)} per layer; all layers = ${formatTflops(
            result.csaLayer.moe * model.decoderLayers
          )}`
        },
        {
          label: "Sliding layer total",
          expression: "F_Q + F_KV + F_core + F_O + F_MoE",
          evaluated: formatLayerContribution(
            result.slidingLayer,
            model.slidingLayerCount,
            "total"
          )
        },
        {
          label: "CSA layer total",
          expression: "F_Q + F_KV + F_core + F_compressor + F_indexer + F_O + F_MoE",
          evaluated: formatLayerContribution(result.csaLayer, model.csaLayerCount, "total")
        },
        {
          label: "HCA layer total",
          expression: "F_Q + F_KV + F_core + F_compressor + F_O + F_MoE",
          evaluated: formatLayerContribution(result.hcaLayer, model.hcaLayerCount, "total")
        },
        {
          label: "Total Prefill FLOPs",
          expression: "N_sliding*F_sliding + N_csa*F_csa + N_hca*F_hca",
          evaluated: formatTflops(result.prefillFlops)
        }
      ]
    },
    {
      category: "decode",
      rows: [
        {
          label: "Decode sliding visible length",
          expression: "L_kv_decode(sliding) = sliding_window",
          evaluated: `${result.decodeSlidingLkv} tokens`
        },
        {
          label: "Decode CSA visible length",
          expression: "L_kv_decode(CSA) = sliding_window + min(index_topk, floor(S_ctx / m_csa))",
          evaluated: `${model.slidingWindow} + min(${model.indexTopk}, floor(${workload.decodeContextLength} / ${model.csaCompressRate})) = ${result.decodeCsaLkv} tokens`
        },
        {
          label: "Decode HCA visible length",
          expression: "L_kv_decode(HCA) = sliding_window + floor(S_ctx / m_hca)",
          evaluated: `${model.slidingWindow} + floor(${workload.decodeContextLength} / ${model.hcaCompressRate}) = ${result.decodeHcaLkv} tokens`
        },
        {
          label: "Sliding bytes per token",
          expression: "B * 2 * n_h * L_kv * c * bytes_per_elem",
          evaluated: `${formatMb(result.decodeSlidingBytesPerToken)} x ${model.slidingLayerCount} layers = ${formatMb(
            result.decodeSlidingBytesPerToken * model.slidingLayerCount
          )}`
        },
        {
          label: "CSA bytes per token",
          expression: "B * 2 * n_h * L_kv(CSA) * c * bytes_per_elem",
          evaluated: `${formatMb(result.decodeCsaBytesPerToken)} x ${model.csaLayerCount} layers = ${formatMb(
            result.decodeCsaBytesPerToken * model.csaLayerCount
          )}`
        },
        {
          label: "HCA bytes per token",
          expression: "B * 2 * n_h * L_kv(HCA) * c * bytes_per_elem",
          evaluated: `${formatMb(result.decodeHcaBytesPerToken)} x ${model.hcaLayerCount} layers = ${formatMb(
            result.decodeHcaBytesPerToken * model.hcaLayerCount
          )}`
        },
        {
          label: "Decode cache bytes per token",
          expression: "N_sliding*B_sliding + N_csa*B_csa + N_hca*B_hca",
          evaluated: formatMb(result.decodeCacheBytes)
        },
        {
          label: "Decode weight bytes per token",
          expression: "B_weights ~= M_weights",
          evaluated: formatMb(result.decodeWeightBytes)
        },
        {
          label: "Total decode bytes per token",
          expression: "B_decode = B_weights + B_cache",
          evaluated: `${formatMb(result.decodeWeightBytes)} + ${formatMb(
            result.decodeCacheBytes
          )} = ${formatMb(result.decodeBytes)}`
        },
        {
          label: "Decode compute FLOPs per token",
          expression: "L * D * I * (k + 1) / 3",
          evaluated: formatGflops(result.decodeComputeFlopsPerToken)
        },
        {
          label: "Decode compute ceiling",
          expression: "effective_compute / FLOPs_per_token",
          evaluated: `${result.decodeComputeTps.toFixed(2)} tokens/s`
        },
        {
          label: "Decode bandwidth ceiling",
          expression: "effective_bandwidth / bytes_per_token",
          evaluated: `${result.decodeBandwidthTps.toFixed(2)} tokens/s`
        },
        {
          label: "Raw Decode TPS",
          expression: "min(decode_compute_ceiling, decode_bandwidth_ceiling)",
          evaluated: `${Math.min(result.decodeComputeTps, result.decodeBandwidthTps).toFixed(
            2
          )} tokens/s`
        },
        {
          label: "Effective Decode TPS",
          expression: "min(decode_compute_ceiling, decode_bandwidth_ceiling)",
          evaluated: `${result.decodeTps.toFixed(2)} tokens/s`
        }
      ]
    },
    {
      category: "memory",
      rows: [
        {
          label: "Weight memory",
          expression: "M_weights ~= quantized resident model weights",
          evaluated: `${result.weightGb.toFixed(2)} GB`
        },
        {
          label: "Persistent sliding cache",
          expression: "B * e * (sliding_window - 1) * c",
          evaluated: `${formatMb(result.persistentSlidingCacheBytes)} x ${model.slidingLayerCount} layers = ${formatMb(
            result.persistentSlidingCacheTotalBytes
          )}`
        },
        {
          label: "Persistent HCA cache",
          expression: "B * e * [(n_win-1)*c + floor(S_ctx/m_hca)*c + 2*(S_ctx mod m_hca)*c]",
          evaluated: `${formatMb(result.persistentHcaCacheBytes)} x ${model.hcaLayerCount} layers = ${formatMb(
            result.persistentHcaCacheTotalBytes
          )}`
        },
        {
          label: "Persistent CSA cache",
          expression: "B * e * [(n_win-1)*c + floor(S_ctx/m_csa)*(c+c_I) + 4*(S_ctx mod m_csa)*(c+c_I) + 2*m_csa*(c+c_I)]",
          evaluated: `${formatMb(result.persistentCsaCacheBytes)} x ${model.csaLayerCount} layers = ${formatMb(
            result.persistentCsaCacheTotalBytes
          )}`
        },
        {
          label: "Persistent Decode Cache",
          expression: "M_decode_cache = M_sliding + M_hca + M_csa",
          evaluated: `${result.cacheGb.toFixed(3)} GB`
        },
        {
          label: "Single-step Temp Peak",
          expression: "M_tmp_peak = B * e * 2 * n_h * max(L_kv_decode) * c",
          evaluated: `${formatMb(result.tmpPeakBytes)}; max L_kv = ${result.tmpPeakLkv}`
        },
        {
          label: "Runtime overhead",
          expression: "M_runtime_overhead = max(4 GB, M_weights * 0.03)",
          evaluated: `${result.overheadGb.toFixed(2)} GB`
        },
        {
          label: "Decode base memory",
          expression: "M_weights + M_decode_cache",
          evaluated: `${(result.weightGb + result.cacheGb).toFixed(2)} GB`
        },
        {
          label: "Decode peak memory",
          expression: "M_weights + M_decode_cache + M_tmp_peak + M_runtime_overhead",
          evaluated: `${result.totalRuntimeMemoryGb.toFixed(2)} GB`
        }
      ]
    }
  ];
}

export function calculatePerformanceResult(
  model: ModelDefinition,
  platform: PlatformInput,
  workload: WorkloadInput
): PerformanceResult {
  if (model.formulaStrategyId !== "deepseek-v4-compressed-moe") {
    throw new Error(`Unsupported formula strategy: ${model.formulaStrategyId}`);
  }

  const tokenSweepSeries: TokenSweepPoint[] = [];

  for (
    let tokenLength = workload.tokenRangeStart;
    tokenLength <= workload.tokenRangeEnd;
    tokenLength += workload.tokenRangeStep
  ) {
    const pointResult = computeFullResult(model, platform, workload, tokenLength);
    tokenSweepSeries.push({
      tokenLength,
      prefillTps: pointResult.prefillTps,
      decodeTps: pointResult.decodeTps,
      ttftMs: pointResult.ttftMs,
      totalRuntimeMemoryGb: pointResult.totalRuntimeMemoryGb,
      prefillBottleneck: pointResult.prefillBottleneck,
      decodeBottleneck: pointResult.decodeBottleneck
    });
  }

  const activeResult = computeFullResult(
    model,
    platform,
    workload,
    workload.prefillTokenLength
  );

  return {
    summary: {
      ttftMs: activeResult.ttftMs,
      prefillTps: activeResult.prefillTps,
      decodeTps: activeResult.decodeTps,
      totalRuntimeMemoryGb: activeResult.totalRuntimeMemoryGb,
      prefillBottleneck: activeResult.prefillBottleneck,
      decodeBottleneck: activeResult.decodeBottleneck,
      memoryFitsCapacity: activeResult.memoryFitsCapacity
    },
    comparisonRows: buildComparisonRows(activeResult),
    memoryBreakdown: [
      {
        key: "weights",
        label: "Weights",
        valueGb: activeResult.weightGb
      },
      {
        key: "persistentDecodeCache",
        label: "Persistent Decode Cache",
        valueGb: activeResult.cacheGb
      },
      {
        key: "peakTempWorkingSet",
        label: "Peak Temp Working Set",
        valueGb: activeResult.tmpPeakGb
      },
      {
        key: "runtimeOverhead",
        label: "Runtime Overhead",
        valueGb: activeResult.overheadGb
      },
      {
        key: "estimatedTotal",
        label: "Estimated Total",
        valueGb: activeResult.totalRuntimeMemoryGb
      }
    ],
    intermediateMetrics: buildIntermediateMetrics(
      model,
      platform,
      workload,
      activeResult
    ),
    formulaTrace: buildFormulaTrace(model, workload, activeResult),
    tokenSweepSeries
  };
}
