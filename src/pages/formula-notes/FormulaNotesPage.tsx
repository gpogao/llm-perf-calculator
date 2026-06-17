export function FormulaNotesPage() {
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Traceable Formulae</p>
          <h2>公式说明</h2>
        </div>
        <p className="page-description">
          该页面将整理 prefill、decode 与内存估算公式及其变量定义。
        </p>
      </div>

      <div className="panel-grid">
        <article className="panel panel--large">
          <h3>Prefill 公式</h3>
          <p>后续展示算力与带宽上限模型。</p>
        </article>
        <article className="panel panel--large">
          <h3>Decode 公式</h3>
          <p>后续展示 KV Cache、weights 和 token 相关项。</p>
        </article>
      </div>
    </section>
  );
}

