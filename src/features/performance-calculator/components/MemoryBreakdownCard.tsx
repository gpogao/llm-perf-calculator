import type { MemoryBreakdownRow } from "../../../domain/performance/types";

export function MemoryBreakdownCard({ rows }: { rows: MemoryBreakdownRow[] }) {
  return (
    <article className="panel">
      <h3>内存拆解</h3>
      <div className="stack-list">
        {rows.map((row) => (
          <div key={row.key} className="stack-list__row">
            <div>
              <strong>{row.label}</strong>
            </div>
            <span>{row.valueGb.toFixed(2)} GB</span>
          </div>
        ))}
      </div>
    </article>
  );
}

