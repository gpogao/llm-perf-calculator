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

function buildPath(
  values: number[],
  width: number,
  height: number,
  padding: number
) {
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const xStep = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const normalizedRange = maxValue - minValue || 1;

  return values
    .map((value, index) => {
      const x = padding + xStep * index;
      const y =
        height - padding - ((value - minValue) / normalizedRange) * (height - padding * 2);

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
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
  const padding = 24;
  const primaryValues = points.map((point) => point[selectedMetric]);
  const secondaryKey = selectedMetric === "prefillTps" ? "decodeTps" : "prefillTps";
  const secondaryValues =
    selectedMetric === "ttftMs" || selectedMetric === "totalRuntimeMemoryGb"
      ? []
      : points.map((point) => point[secondaryKey]);
  const primaryPath = buildPath(primaryValues, width, height, padding);
  const secondaryPath =
    secondaryValues.length > 0
      ? buildPath(secondaryValues, width, height, padding)
      : null;
  const lastPoint = points.length > 0 ? points[points.length - 1] : undefined;

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
              <rect x="0" y="0" width={width / 2} height={height} fill="rgba(37, 99, 235, 0.05)" />
              <rect
                x={width / 2}
                y="0"
                width={width / 2}
                height={height}
                fill="rgba(14, 116, 144, 0.05)"
              />
            </>
          )}
          <path d={primaryPath} fill="none" stroke="#2563eb" strokeWidth="3" />
          {secondaryPath ? (
            <path d={secondaryPath} fill="none" stroke="#0f766e" strokeWidth="2" />
          ) : null}
          {showDataPoints &&
            points.map((point, index) => {
              const maxValue = Math.max(...primaryValues);
              const minValue = Math.min(...primaryValues);
              const x =
                padding +
                ((width - padding * 2) / Math.max(points.length - 1, 1)) * index;
              const y =
                height -
                padding -
                (((point[selectedMetric] as number) - minValue) /
                  Math.max(maxValue - minValue, 1)) *
                  (height - padding * 2);

              return <circle key={point.tokenLength} cx={x} cy={y} r="3.5" fill="#1d4ed8" />;
            })}
        </svg>
      </div>
      <div className="trend-footer">
        <span>Range: {points[0]?.tokenLength ?? 0} - {lastPoint?.tokenLength ?? 0}</span>
        <span>Points: {points.length}</span>
      </div>
    </article>
  );
}
