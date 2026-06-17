import type { PerformanceSummary } from "../../../domain/performance/types";

type Props = {
  summary: PerformanceSummary;
};

const cards = [
  {
    key: "ttftMs",
    label: "TTFT",
    unit: "ms",
    subtext: "Prefill completion latency"
  },
  {
    key: "prefillTps",
    label: "Prefill TPS",
    unit: "tokens/s",
    subtext: "Current platform estimate"
  },
  {
    key: "decodeTps",
    label: "Decode TPS",
    unit: "tokens/s",
    subtext: "Steady-state decode rate"
  },
  {
    key: "totalRuntimeMemoryGb",
    label: "Runtime Memory",
    unit: "GB",
    subtext: "Weights + cache + temp"
  }
] as const;

export function MetricCards({ summary }: Props) {
  return (
    <div className="metric-grid">
      {cards.map((card) => {
        const value = summary[card.key];
        const tag =
          card.key === "prefillTps"
            ? summary.prefillBottleneck
            : card.key === "decodeTps"
              ? summary.decodeBottleneck
              : summary.memoryFitsCapacity
                ? "fits"
                : "overflow";

        return (
          <article key={card.key} className="metric-card">
            <p className="metric-card__label">{card.label}</p>
            <strong className="metric-card__value">
              {value.toFixed(card.key === "ttftMs" ? 0 : 1)}
            </strong>
            <span className="metric-card__unit">{card.unit}</span>
            <p className="metric-card__subtext">{card.subtext}</p>
            <span className="metric-card__tag">{tag}</span>
          </article>
        );
      })}
    </div>
  );
}

