import type { FormulaTraceSection } from "../../../domain/performance/types";

export function FormulaTraceCard({
  sections
}: {
  sections: FormulaTraceSection[];
}) {
  return (
    <article className="panel">
      <h3>公式追溯</h3>
      <div className="formula-trace">
        {sections.map((section) => (
          <section key={section.category} className="formula-trace__section">
            <p className="eyebrow">{section.category}</p>
            {section.rows.map((row) => (
              <div key={row.label} className="formula-trace__row">
                <strong>{row.label}</strong>
                <code>{row.expression}</code>
                <span>{row.evaluated}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
