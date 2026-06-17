import type { ComparisonRow } from "../../../domain/performance/types";

export function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  return (
    <article className="panel panel--large">
      <h3>Prefill / Decode 对比</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Unit</th>
            <th>Prefill</th>
            <th>Decode</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.unit}</td>
              <td>{row.prefill}</td>
              <td>{row.decode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

