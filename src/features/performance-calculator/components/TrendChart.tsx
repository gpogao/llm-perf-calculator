import type {
  TokenSweepPoint,
  TrendMetricKey
} from "../../../domain/performance/types";

type Props = {
  points: TokenSweepPoint[];
  selectedMetric: TrendMetricKey;
  onMetricChange: (metric: TrendMetricKey) => void;
  showDataPoints: boolean;
  onShowDataPointsChange: (value: boolean) => void;
  showBottleneckBackground: boolean;
  onShowBottleneckBackgroundChange: (value: boolean) => void;
};

const metricOptions: { key: TrendMetricKey; label: string }[] = [
  { key: "prefillTps", label: "Prefill TPS" },
  { key: "decodeTps", label: "Decode TPS" },
  { key: "ttftMs", label: "TTFT" },
  { key: "totalRuntimeMemoryGb", label: "Total Runtime Memory" }
];

function formatTokenLength(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(value % (1024 * 1024) === 0 ? 0 : 1)}M`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)}K`;
  }

  return String(value);
}

function formatMetricValue(metric: TrendMetricKey, value: number) {
  if (metric === "ttftMs") {
    return `${(value / 1000).toFixed(2)} s`;
  }

  if (metric === "totalRuntimeMemoryGb") {
    return `${value.toFixed(2)} GB`;
  }

  return `${value.toFixed(2)} tokens/s`;
}

function formatAxisTick(metric: TrendMetricKey, value: number) {
  if (metric === "ttftMs") {
    return (value / 1000).toFixed(1);
  }

  if (metric === "totalRuntimeMemoryGb") {
    return value.toFixed(1);
  }

  return value.toFixed(0);
}

function getMetricUnit(metric: TrendMetricKey) {
  if (metric === "ttftMs") {
    return "s";
  }

  if (metric === "totalRuntimeMemoryGb") {
    return "GB";
  }

  return "tokens/s";
}

function getMetricLabel(metric: TrendMetricKey) {
  return metricOptions.find((option) => option.key === metric)?.label ?? metric;
}

function getYDomain(values: number[]) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  if (minValue === maxValue) {
    const pad = Math.max(Math.abs(minValue) * 0.1, 1);
    return [minValue - pad, maxValue + pad] as const;
  }

  const pad = (maxValue - minValue) * 0.08;
  return [Math.max(0, minValue - pad), maxValue + pad] as const;
}

function buildPath(points: { x: number; y: number }[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function makeTicks(min: number, max: number, count: number) {
  if (count <= 1) {
    return [min];
  }

  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

export function TrendChart({
  points,
  selectedMetric,
  onMetricChange,
  showDataPoints,
  onShowDataPointsChange,
  showBottleneckBackground,
  onShowBottleneckBackgroundChange
}: Props) {
  const width = 760;
  const height = 260;
  const plot = {
    left: 72,
    right: 24,
    top: 20,
    bottom: 48
  };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const primaryValues = points.map((point) => point[selectedMetric]);
  const secondaryKey = selectedMetric === "prefillTps" ? "decodeTps" : "prefillTps";
  const secondaryValues =
    selectedMetric === "ttftMs" || selectedMetric === "totalRuntimeMemoryGb"
      ? []
      : points.map((point) => point[secondaryKey]);
  const allYValues = [...primaryValues, ...secondaryValues];
  const [yMin, yMax] = getYDomain(allYValues.length > 0 ? allYValues : [0]);
  const xMin = points[0]?.tokenLength ?? 0;
  const xMax = points[points.length - 1]?.tokenLength ?? xMin + 1;
  const xRange = Math.max(xMax - xMin, 1);
  const yRange = Math.max(yMax - yMin, 1);
  const xScale = (tokenLength: number) =>
    plot.left + ((tokenLength - xMin) / xRange) * plotWidth;
  const yScale = (value: number) =>
    plot.top + plotHeight - ((value - yMin) / yRange) * plotHeight;
  const primaryPlotPoints = points.map((point) => ({
    x: xScale(point.tokenLength),
    y: yScale(point[selectedMetric])
  }));
  const secondaryPlotPoints =
    secondaryValues.length > 0
      ? points.map((point) => ({
          x: xScale(point.tokenLength),
          y: yScale(point[secondaryKey])
        }))
      : [];
  const primaryPath = buildPath(primaryPlotPoints);
  const secondaryPath =
    secondaryPlotPoints.length > 0 ? buildPath(secondaryPlotPoints) : null;
  const lastPoint = points.length > 0 ? points[points.length - 1] : undefined;
  const xTicks = makeTicks(xMin, xMax, 5);
  const yTicks = makeTicks(yMin, yMax, 5);

  return (
    <article className="panel panel--large">
      <div className="chart-header">
        <div>
          <h3>Token 趋势图</h3>
          <p>按 token sweep 范围重新计算每个离散点。</p>
        </div>
        <div className="chart-controls">
          <select
            value={selectedMetric}
            onChange={(event) => onMetricChange(event.target.value as TrendMetricKey)}
          >
            {metricOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={showBottleneckBackground}
              onChange={(event) =>
                onShowBottleneckBackgroundChange(event.target.checked)
              }
            />
            <span>Bottleneck</span>
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={showDataPoints}
              onChange={(event) => onShowDataPointsChange(event.target.checked)}
            />
            <span>Points</span>
          </label>
        </div>
      </div>
      <div className="trend-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Token sweep chart">
          {showBottleneckBackground && (
            <>
              <rect
                x={plot.left}
                y={plot.top}
                width={plotWidth / 2}
                height={plotHeight}
                fill="rgba(37, 99, 235, 0.05)"
              />
              <rect
                x={plot.left + plotWidth / 2}
                y={plot.top}
                width={plotWidth / 2}
                height={plotHeight}
                fill="rgba(14, 116, 144, 0.05)"
              />
            </>
          )}
          {yTicks.map((tick) => {
            const y = yScale(tick);

            return (
              <g key={`y-${tick}`}>
                <line
                  x1={plot.left}
                  x2={plot.left + plotWidth}
                  y1={y}
                  y2={y}
                  stroke="rgba(15, 23, 42, 0.08)"
                />
                <text x={plot.left - 10} y={y + 4} textAnchor="end" className="chart-axis-text">
                  {formatAxisTick(selectedMetric, tick)}
                </text>
              </g>
            );
          })}
          {xTicks.map((tick) => {
            const x = xScale(tick);

            return (
              <g key={`x-${tick}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={plot.top}
                  y2={plot.top + plotHeight}
                  stroke="rgba(15, 23, 42, 0.05)"
                />
                <text
                  x={x}
                  y={plot.top + plotHeight + 24}
                  textAnchor="middle"
                  className="chart-axis-text"
                >
                  {formatTokenLength(tick)}
                </text>
              </g>
            );
          })}
          <line
            x1={plot.left}
            x2={plot.left}
            y1={plot.top}
            y2={plot.top + plotHeight}
            stroke="rgba(15, 23, 42, 0.36)"
          />
          <line
            x1={plot.left}
            x2={plot.left + plotWidth}
            y1={plot.top + plotHeight}
            y2={plot.top + plotHeight}
            stroke="rgba(15, 23, 42, 0.36)"
          />
          <text
            x={plot.left + plotWidth / 2}
            y={height - 6}
            textAnchor="middle"
            className="chart-axis-label"
          >
            Token Length (tokens)
          </text>
          <text
            x={14}
            y={plot.top + plotHeight / 2}
            textAnchor="middle"
            className="chart-axis-label"
            transform={`rotate(-90 14 ${plot.top + plotHeight / 2})`}
          >
            {getMetricLabel(selectedMetric)} ({getMetricUnit(selectedMetric)})
          </text>
          <path d={primaryPath} fill="none" stroke="#2563eb" strokeWidth="3" />
          {secondaryPath ? (
            <path d={secondaryPath} fill="none" stroke="#0f766e" strokeWidth="2" />
          ) : null}
          {showDataPoints &&
            points.map((point) => {
              const x = xScale(point.tokenLength);
              const y = yScale(point[selectedMetric]);

              return (
                <g key={point.tokenLength} className="chart-point">
                  <circle cx={x} cy={y} r="4" fill="#1d4ed8" />
                  <circle cx={x} cy={y} r="10" fill="transparent" />
                  <title>
                    {`Token Length: ${point.tokenLength.toLocaleString()}
${getMetricLabel(selectedMetric)}: ${formatMetricValue(selectedMetric, point[selectedMetric])}
Prefill TPS: ${formatMetricValue("prefillTps", point.prefillTps)}
Decode TPS: ${formatMetricValue("decodeTps", point.decodeTps)}
TTFT: ${formatMetricValue("ttftMs", point.ttftMs)}
Memory: ${formatMetricValue("totalRuntimeMemoryGb", point.totalRuntimeMemoryGb)}
Prefill Bottleneck: ${point.prefillBottleneck}
Decode Bottleneck: ${point.decodeBottleneck}`}
                  </title>
                </g>
              );
            })}
        </svg>
      </div>
      <div className="trend-footer">
        <span>Range: {formatTokenLength(points[0]?.tokenLength ?? 0)} - {formatTokenLength(lastPoint?.tokenLength ?? 0)}</span>
        <span>Points: {points.length}</span>
        <span className="chart-legend">
          <i className="chart-legend__primary" /> {getMetricLabel(selectedMetric)}
          {secondaryPath ? (
            <>
              <i className="chart-legend__secondary" /> {getMetricLabel(secondaryKey)}
            </>
          ) : null}
        </span>
      </div>
    </article>
  );
}
