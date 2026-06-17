import { ComparisonTable } from "../../features/performance-calculator/components/ComparisonTable";
import { CalculatorControls } from "../../features/performance-calculator/components/CalculatorControls";
import { FormulaTraceCard } from "../../features/performance-calculator/components/FormulaTraceCard";
import { IntermediateMetricsTable } from "../../features/performance-calculator/components/IntermediateMetricsTable";
import { MemoryBreakdownCard } from "../../features/performance-calculator/components/MemoryBreakdownCard";
import { MetricCards } from "../../features/performance-calculator/components/MetricCards";
import { TrendChart } from "../../features/performance-calculator/components/TrendChart";
import { useCalculatorState } from "../../features/performance-calculator/state/useCalculatorState";

export function PerformanceCalculatorPage() {
  const {
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
  } = useCalculatorState();

  if (!result) {
    return null;
  }

  const statusText =
    status === "invalid"
      ? "参数存在校验错误"
      : status === "calculating"
        ? "计算中"
        : status === "calculated"
          ? "结果已更新"
          : "待计算";

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Primary Workspace</p>
          <h2>性能计算</h2>
        </div>
        <p className="page-description">
          输入模型、平台参数和 token 范围，计算 prefill / decode 性能并查看趋势。
        </p>
      </div>

      <CalculatorControls
        modelId={state.modelId}
        selectedModel={selectedModel}
        platform={state.platform}
        workload={state.workload}
        view={state.view}
        validationErrors={validationErrors}
        onModelIdChange={updateModelId}
        onPlatformChange={updatePlatform}
        onWorkloadChange={updateWorkload}
        onViewChange={updateView}
        onQuickRange={applyQuickRange}
        onCalculate={calculate}
        onReset={reset}
        statusText={statusText}
      />

      <div className="analysis-grid">
        <div className="analysis-grid__main">
          <MetricCards summary={result.summary} />

          <div className="panel-grid">
            <ComparisonTable rows={result.comparisonRows} />
            <article className="panel panel--large">
              <h3>当前上下文摘要</h3>
              <div className="stack-list">
                <div className="stack-list__row">
                  <strong>Model</strong>
                  <span>{selectedModel.displayName}</span>
                </div>
                <div className="stack-list__row">
                  <strong>Prefill Length</strong>
                  <span>{state.workload.prefillTokenLength.toLocaleString()} tokens</span>
                </div>
                <div className="stack-list__row">
                  <strong>Decode Context</strong>
                  <span>{state.workload.decodeContextLength.toLocaleString()} tokens</span>
                </div>
                <div className="stack-list__row">
                  <strong>Precision</strong>
                  <span>{state.platform.precisionAssumptions}</span>
                </div>
              </div>
            </article>
          </div>

          <TrendChart
            points={result.tokenSweepSeries}
            selectedMetric={state.view.selectedTrendMetric}
            onMetricChange={(value) => updateView("selectedTrendMetric", value)}
            showDataPoints={state.view.showTrendDataPoints}
            onShowDataPointsChange={(value) => updateView("showTrendDataPoints", value)}
            showBottleneckBackground={state.view.showBottleneckBackground}
            onShowBottleneckBackgroundChange={(value) =>
              updateView("showBottleneckBackground", value)
            }
          />

          {state.view.showIntermediateMetrics ? (
            <IntermediateMetricsTable rows={result.intermediateMetrics} />
          ) : null}
        </div>

        <aside className="analysis-grid__side">
          <article className="panel">
            <h3>结构摘要</h3>
              <p>显示模型层数、hidden size、MoE 配置和上下文长度。</p>
              <dl className="summary-list summary-list--compact">
                <div>
                  <dt>Decoder Layers</dt>
                  <dd>{selectedModel.decoderLayers}</dd>
                </div>
                <div>
                  <dt>Attention Heads</dt>
                  <dd>{selectedModel.attentionHeads}</dd>
                </div>
                <div>
                  <dt>KV Heads</dt>
                  <dd>{selectedModel.kvHeads}</dd>
                </div>
                <div>
                  <dt>Experts</dt>
                  <dd>{selectedModel.moeExperts}</dd>
                </div>
              </dl>
            </article>
          <MemoryBreakdownCard rows={result.memoryBreakdown} />
          {state.view.showFormulaTrace ? (
            <FormulaTraceCard sections={result.formulaTrace} />
          ) : null}
        </aside>
      </div>
    </section>
  );
}
