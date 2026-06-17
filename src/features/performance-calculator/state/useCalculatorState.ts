import { useMemo, useState } from "react";
import type { ModelId } from "../../../domain/model/types";
import type {
  CalculationStatus,
  PerformanceResult,
  TrendMetricKey
} from "../../../domain/performance/types";
import type { PlatformInput } from "../../../domain/platform/types";
import type { WorkloadInput } from "../../../domain/workload/types";
import { getModelDefinition } from "../../../engines/model-registry";
import { calculatePerformanceResult } from "../services/performanceCalculator";

export type CalculatorViewState = {
  selectedTrendMetric: TrendMetricKey;
  showFormulaTrace: boolean;
  showIntermediateMetrics: boolean;
  showBottleneckBackground: boolean;
  showTrendDataPoints: boolean;
};

export type CalculatorState = {
  modelId: ModelId;
  platform: PlatformInput;
  workload: WorkloadInput;
  view: CalculatorViewState;
};

export type CalculatorValidation = Record<string, string>;

const defaultState: CalculatorState = {
  modelId: "deepseek-v4-flash",
  platform: {
    computeThroughputTflops: 1000,
    memoryBandwidthTbps: 3.35,
    memoryCapacityGb: 192,
    computeEfficiency: 0.7,
    bandwidthEfficiency: 0.75,
    batchSize: 1,
    precisionAssumptions: "FP8 weights + BF16 activations + FP4 experts",
    useMemoryCeilingClamp: true
  },
  workload: {
    prefillTokenLength: 131072,
    decodeContextLength: 131072,
    decodeOutputTokens: 512,
    tokenRangeStart: 4096,
    tokenRangeEnd: 131072,
    tokenRangeStep: 4096,
    tokenSweepMode: "fixed-step"
  },
  view: {
    selectedTrendMetric: "prefillTps",
    showFormulaTrace: true,
    showIntermediateMetrics: true,
    showBottleneckBackground: true,
    showTrendDataPoints: true
  }
};

function validateState(state: CalculatorState): CalculatorValidation {
  const errors: CalculatorValidation = {};

  if (state.platform.computeThroughputTflops <= 0) {
    errors.computeThroughputTflops = "需大于 0";
  }

  if (state.platform.memoryBandwidthTbps <= 0) {
    errors.memoryBandwidthTbps = "需大于 0";
  }

  if (state.platform.memoryCapacityGb <= 0) {
    errors.memoryCapacityGb = "需大于 0";
  }

  if (state.workload.tokenRangeStart > state.workload.tokenRangeEnd) {
    errors.tokenRangeStart = "Start 不能大于 End";
  }

  if (state.workload.tokenRangeStep <= 0) {
    errors.tokenRangeStep = "Step 需大于 0";
  }

  const span = state.workload.tokenRangeEnd - state.workload.tokenRangeStart;

  if (state.workload.tokenRangeStep > span && span > 0) {
    errors.tokenRangeStep = "Step 不能大于 End - Start";
  }

  const pointCount = Math.floor(span / state.workload.tokenRangeStep) + 1;

  if (Number.isFinite(pointCount) && pointCount > 500) {
    errors.tokenRangeStep = "趋势点数超过 500，请增大 Step";
  }

  return errors;
}

export function useCalculatorState() {
  const [state, setState] = useState<CalculatorState>(defaultState);
  const [result, setResult] = useState<PerformanceResult | null>(() => {
    const model = getModelDefinition(defaultState.modelId);
    return calculatePerformanceResult(model, defaultState.platform, defaultState.workload);
  });
  const [status, setStatus] = useState<CalculationStatus>("calculated");

  const validationErrors = useMemo(() => validateState(state), [state]);

  const selectedModel = useMemo(() => getModelDefinition(state.modelId), [state.modelId]);

  function updateModelId(modelId: ModelId) {
    setState((current) => ({ ...current, modelId }));
    setStatus("ready");
  }

  function updatePlatform<K extends keyof PlatformInput>(key: K, value: PlatformInput[K]) {
    setState((current) => ({
      ...current,
      platform: {
        ...current.platform,
        [key]: value
      }
    }));
    setStatus("ready");
  }

  function updateWorkload<K extends keyof WorkloadInput>(key: K, value: WorkloadInput[K]) {
    setState((current) => ({
      ...current,
      workload: {
        ...current.workload,
        [key]: value
      }
    }));
    setStatus("ready");
  }

  function updateView<K extends keyof CalculatorViewState>(
    key: K,
    value: CalculatorViewState[K]
  ) {
    setState((current) => ({
      ...current,
      view: {
        ...current.view,
        [key]: value
      }
    }));
  }

  function applyQuickRange(tokenLength: number) {
    setState((current) => ({
      ...current,
      workload: {
        ...current.workload,
        prefillTokenLength: tokenLength,
        decodeContextLength: tokenLength,
        tokenRangeEnd: Math.max(current.workload.tokenRangeEnd, tokenLength)
      }
    }));
    setStatus("ready");
  }

  function reset() {
    setState(defaultState);
    const model = getModelDefinition(defaultState.modelId);
    setResult(calculatePerformanceResult(model, defaultState.platform, defaultState.workload));
    setStatus("calculated");
  }

  function calculate() {
    if (Object.keys(validationErrors).length > 0) {
      setStatus("invalid");
      return;
    }

    setStatus("calculating");
    const model = getModelDefinition(state.modelId);
    const nextResult = calculatePerformanceResult(model, state.platform, state.workload);
    setResult(nextResult);
    setStatus("calculated");
  }

  return {
    state,
    result,
    status,
    selectedModel,
    validationErrors,
    updateModelId,
    updatePlatform,
    updateWorkload,
    updateView,
    applyQuickRange,
    reset,
    calculate
  };
}
