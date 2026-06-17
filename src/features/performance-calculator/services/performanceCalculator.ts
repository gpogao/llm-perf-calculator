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
  weightGb: number;
  cacheGb: number;
  tmpPeakGb: number;
  overheadGb: number;
  totalRuntimeMemoryGb: number;
  prefillComputeTps: number;
  prefillBandwidthTps: number;
  decodeComputeTps: number;
  decodeBandwidthTps: number;
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

function toTiBPerSecond(valueTbps: number) {
  return valueTbps * 1_000_000_000_000;
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

function inferBottleneck(
  computeLimit: number,
  bandwidthLimit: number,
  fitsCapacity: boolean
): BottleneckType {
  if (!fitsCapacity) {
    return "memory-cap-limited";
  }

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
  const e = 2;
  const slidingBytes =
    batchSize * e * (model.slidingWindow - 1) * model.headDim;
  const hcaBytes =
    batchSize *
    e *
    ((model.slidingWindow - 1) * model.headDim +
      Math.floor(contextLength / model.hcaCompressRate) * model.headDim +
      2 * (contextLength % model.hcaCompressRate) * model.headDim);
  const csaBytes =
    batchSize *
    e *
    ((model.slidingWindow - 1) * model.headDim +
      Math.floor(contextLength / model.csaCompressRate) *
        (model.headDim + model.indexHeadDim) +
      4 *
        (contextLength % model.csaCompressRate) *
        (model.headDim + model.indexHeadDim) +
      2 * model.csaCompressRate * (model.headDim + model.indexHeadDim));

  return (
    model.slidingLayerCount * slidingBytes +
    model.hcaLayerCount * hcaBytes +
    model.csaLayerCount * csaBytes
  );
}

function decodeTmpPeakBytes(
  model: ModelDefinition,
  batchSize: number,
  contextLength: number
) {
  const e = 2;
  const csaLkv =
    model.slidingWindow +
    Math.min(model.indexTopk, Math.floor(contextLength / model.csaCompressRate));
  const hcaLkv =
    model.slidingWindow + Math.floor(contextLength / model.hcaCompressRate);
  const peakLkv = Math.max(csaLkv, hcaLkv, model.slidingWindow);

  return batchSize * e * 2 * model.attentionHeads * peakLkv * model.headDim;
}

function decodeBytesPerToken(model: ModelDefinition, contextLength: number) {
  const e = 2;
  const csaLkv =
    model.slidingWindow +
    Math.min(model.indexTopk, Math.floor(contextLength / model.csaCompressRate));
  const hcaLkv =
    model.slidingWindow + Math.floor(contextLength / model.hcaCompressRate);
  const slidingBytes =
    2 * model.attentionHeads * model.slidingWindow * model.headDim * e;
  const csaBytes = 2 * model.attentionHeads * csaLkv * model.headDim * e;
  const hcaBytes = 2 * model.attentionHeads * hcaLkv * model.headDim * e;

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
  const cacheGb = bytesToGb(
    decodeCacheBytes(model, platform.batchSize, workload.decodeContextLength)
  );
  const tmpPeakGb = bytesToGb(
    decodeTmpPeakBytes(model, platform.batchSize, workload.decodeContextLength)
  );
  const overheadGb = Math.max(4, weightGb * 0.03);
  const totalRuntimeMemoryGb = weightGb + cacheGb + tmpPeakGb + overheadGb;
  const memoryFitsCapacity = totalRuntimeMemoryGb <= platform.memoryCapacityGb;
  const effectiveCompute = toFlops(platform.computeThroughputTflops * platform.computeEfficiency);
  const effectiveBandwidth = toTiBPerSecond(
    platform.memoryBandwidthTbps * platform.bandwidthEfficiency
  );
  const prefillComputeTps = effectiveCompute / prefillFlops;
  const prefillTrafficBytes =
    (weightGb * 1_000_000_000 + cacheGb * 1_000_000_000 * 0.1) * platform.batchSize;
  const prefillBandwidthTps = effectiveBandwidth / prefillTrafficBytes;
  const decodeBytes =
    decodeBytesPerToken(model, workload.decodeContextLength) * platform.batchSize;
  const decodeComputeFlopsPerToken =
    (model.decoderLayers * model.hiddenSize * model.moeIntermediateSize * (model.activeExperts + 1)) /
    3;
  const decodeComputeTps = effectiveCompute / decodeComputeFlopsPerToken;
  const decodeBandwidthTps = effectiveBandwidth / decodeBytes;
  const memoryClamp =
    platform.useMemoryCeilingClamp && !memoryFitsCapacity
      ? platform.memoryCapacityGb / totalRuntimeMemoryGb
      : 1;
  const prefillTps = Math.min(prefillComputeTps, prefillBandwidthTps) * memoryClamp;
  const decodeTps = Math.min(decodeComputeTps, decodeBandwidthTps) * memoryClamp;
  const ttftMs = (sequenceLength / Math.max(prefillTps, 1e-6)) * 1000;

  return {
    prefillFlops,
    decodeBytes,
    weightGb,
    cacheGb,
    tmpPeakGb,
    overheadGb,
    totalRuntimeMemoryGb,
    prefillComputeTps,
    prefillBandwidthTps,
    decodeComputeTps,
    decodeBandwidthTps,
    prefillTps,
    decodeTps,
    ttftMs,
    prefillBottleneck: inferBottleneck(
      prefillComputeTps,
      prefillBandwidthTps,
      memoryFitsCapacity
    ),
    decodeBottleneck: inferBottleneck(
      decodeComputeTps,
      decodeBandwidthTps,
      memoryFitsCapacity
    ),
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
      label: "Decode Traffic Per Token",
      symbol: "B_decode",
      value: (result.decodeBytes / 1_000_000).toFixed(2),
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
          evaluated: formatTflops(flopsQ(model, workload.prefillTokenLength))
        },
        {
          label: "CSA indexer attn FLOPs",
          expression: "S^2 * n_h^I * c^I / m_csa",
          evaluated: formatTflops(flopsIndexerAttn(model, workload.prefillTokenLength))
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
          label: "Decode compute ceiling",
          expression: "effective_compute / FLOPs_per_token",
          evaluated: `${result.decodeComputeTps.toFixed(2)} tokens/s`
        },
        {
          label: "Decode bandwidth ceiling",
          expression: "effective_bandwidth / bytes_per_token",
          evaluated: `${result.decodeBandwidthTps.toFixed(2)} tokens/s`
        }
      ]
    },
    {
      category: "memory",
      rows: [
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
