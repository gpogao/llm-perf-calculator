export function ModelStructurePage() {
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Architecture View</p>
          <h2>模型结构</h2>
        </div>
        <p className="page-description">
          该页面将展示选中模型的层级结构、关键超参与模块组织。
        </p>
      </div>

      <div className="panel-grid">
        <article className="panel panel--large">
          <h3>结构总览</h3>
          <p>后续接入模型定义与结构化展示组件。</p>
        </article>
        <article className="panel panel--large">
          <h3>关键参数</h3>
          <p>后续展示 attention heads、layers、experts、KV heads 等信息。</p>
        </article>
      </div>
    </section>
  );
}

