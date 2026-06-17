import type { ModelDefinition, ModelId } from "../../domain/model/types";
import { useCalculatorContext } from "../../features/performance-calculator/state/CalculatorProvider";

function formatK(value: number) {
  return value >= 1024 ? `${value / 1024}K` : String(value);
}

function MetricStrip({ model }: { model: ModelDefinition }) {
  const metrics = [
    ["Layers", model.decoderLayers],
    ["Hidden", model.hiddenSize],
    ["Heads", model.attentionHeads],
    ["KV Heads", model.kvHeads],
    ["Context", formatK(model.contextLimit)],
    ["Weights", `${model.estimatedWeightsGb.toFixed(2)} GB`]
  ];

  return (
    <div className="metric-strip">
      {metrics.map(([label, value]) => (
        <div key={label} className="metric-strip__item">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function StructureFlowDiagram({ model }: { model: ModelDefinition }) {
  const nodes = [
    {
      label: "input_ids",
      shape: "[B, S]",
      dtype: "int32",
      tone: "neutral"
    },
    {
      label: "embed_tokens",
      shape: `[B, S, ${model.hiddenSize}]`,
      dtype: "hidden",
      tone: "blue"
    },
    {
      label: `decoder layers (${model.decoderLayers})`,
      shape: `[B, S, ${model.hiddenSize}]`,
      dtype: "Attention + Compressed Cache + MoE",
      tone: "green",
      repeat: `x${model.decoderLayers}`
    },
    {
      label: "hc_head",
      shape: `[B, S, ${model.hiddenSize}]`,
      dtype: "4 streams -> 1 stream",
      tone: "amber"
    },
    {
      label: "norm",
      shape: `[B, S, ${model.hiddenSize}]`,
      dtype: "RMSNorm",
      tone: "violet"
    },
    {
      label: "lm_head",
      shape: "[B, S, vocab]",
      dtype: `${model.hiddenSize} -> 129280`,
      tone: "blue"
    },
    {
      label: "logits",
      shape: "[B, S, vocab]",
      dtype: "float",
      tone: "neutral"
    }
  ];

  return (
    <div className="structure-flow">
      <div className="structure-flow__pipeline">
        {nodes.map((node, index) => (
          <div key={node.label} className="structure-flow__row">
            <div className="structure-flow__repeat">{node.repeat ?? ""}</div>
            <div className={`structure-flow__node structure-flow__node--${node.tone}`}>
              <strong>{node.label}</strong>
              <span>{node.dtype}</span>
            </div>
            <div className="structure-flow__shape">{node.shape}</div>
            <span className="structure-flow__badge">Used by calculator</span>
            {index < nodes.length - 1 ? (
              <span className="structure-flow__connector" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
      <aside className="structure-flow__bracket">
        <span>calculator path</span>
      </aside>
    </div>
  );
}

function ScheduleBar({
  title,
  items
}: {
  title: string;
  items: { label: string; count: number; tone: string }[];
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <article className="panel">
      <h3>{title}</h3>
      <div className="schedule-bar" aria-label={title}>
        {items.map((item) => (
          <div
            key={item.label}
            className={`schedule-bar__segment schedule-bar__segment--${item.tone}`}
            style={{ flexGrow: item.count }}
            title={`${item.label}: ${item.count}`}
          >
            {item.count}
          </div>
        ))}
      </div>
      <div className="schedule-legend">
        {items.map((item) => (
          <span key={item.label}>
            {item.label}: {item.count} / {total}
          </span>
        ))}
      </div>
    </article>
  );
}

function ParameterTable({ model }: { model: ModelDefinition }) {
  const rows = [
    ["hidden_size", model.hiddenSize, "Hidden dimension", "Prefill FLOPs"],
    ["num_hidden_layers", model.decoderLayers, "Decoder layer count", "Prefill FLOPs"],
    ["num_attention_heads", model.attentionHeads, "Attention head count", "Prefill / Decode"],
    ["num_key_value_heads", model.kvHeads, "Shared-KV MQA heads", "Decode Cache"],
    ["head_dim", model.headDim, "Per-head dimension", "Prefill / Decode"],
    ["q_lora_rank", model.qLoraRank, "Q low-rank projection", "Prefill FLOPs"],
    ["o_lora_rank", model.oLoraRank, "Output projection rank", "Prefill FLOPs"],
    ["sliding_layer_count", model.slidingLayerCount, "Number of sliding attention layers", "Prefill FLOPs / Decode Cache"],
    ["csa_layer_count", model.csaLayerCount, "Number of compressed sparse attention layers", "Prefill FLOPs / Decode Cache"],
    ["hca_layer_count", model.hcaLayerCount, "Number of heavily compressed attention layers", "Prefill FLOPs / Decode Cache"],
    ["sliding_window", model.slidingWindow, "Local visible window size", "Prefill Core / Decode L_kv"],
    ["index_topk", model.indexTopk, "CSA selected compressed blocks", "Prefill / Decode"],
    ["compress_rate_csa", model.csaCompressRate, "CSA compression rate", "CSA Cache / Decode L_kv"],
    ["compress_rate_hca", model.hcaCompressRate, "HCA compression rate", "HCA Cache / Decode L_kv"],
    ["moe_intermediate_size", model.moeIntermediateSize, "Expert FFN width", "Prefill FLOPs"],
    ["estimatedWeightsGb", `${model.estimatedWeightsGb.toFixed(2)} GB`, "Static weight estimate", "Decode Memory"]
  ];

  return (
    <article className="panel panel--large">
      <h3>配置参数与性能关联</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Value</th>
            <th>Meaning</th>
            <th>Used In</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, value, meaning, usedIn]) => (
            <tr key={field}>
              <td>{field}</td>
              <td>{value}</td>
              <td>{meaning}</td>
              <td>{usedIn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export function ModelStructurePage() {
  const {
    state,
    selectedFamily,
    availableFamilies,
    availableModels,
    selectedModel: model,
    updateModelFamily,
    updateModelId
  } = useCalculatorContext();

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

      <article className="panel model-hero">
        <div className="model-hero__selector">
          <label className="field">
            <span>模型家族</span>
            <select
              value={selectedFamily}
              onChange={(event) => updateModelFamily(event.target.value)}
            >
              {availableFamilies.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>当前模型</span>
            <select
              value={state.modelId}
              onChange={(event) => updateModelId(event.target.value as ModelId)}
            >
              {availableModels.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          </label>
          <div>
            <h3>{model.displayName}</h3>
            <p>
              DeepSeek V4 decoder-only architecture with compressed attention,
              mHC residual streams, and routed MoE.
            </p>
          </div>
        </div>
        <MetricStrip model={model} />
      </article>

      <div className="structure-grid">
        <article className="panel panel--large">
          <h3>结构流图</h3>
          <StructureFlowDiagram model={model} />
          <div className="structure-note">
            <span>Used by calculator</span>
            <p>
              `decoder layers`, `attention heads`, `head dim`, `MoE width`, and
              compression schedule directly feed the performance formulas.
            </p>
          </div>
        </article>

        <aside className="module-stack">
          <article className="panel">
            <h3>Attention</h3>
            <dl className="summary-list summary-list--compact">
              <div>
                <dt>Heads</dt>
                <dd>{model.attentionHeads}</dd>
              </div>
              <div>
                <dt>KV Heads</dt>
                <dd>{model.kvHeads}</dd>
              </div>
              <div>
                <dt>Head Dim</dt>
                <dd>{model.headDim}</dd>
              </div>
              <div>
                <dt>Q Rank</dt>
                <dd>{model.qLoraRank}</dd>
              </div>
              <div>
                <dt>O Groups</dt>
                <dd>{model.oGroups}</dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <h3>Compressed Cache</h3>
            <dl className="summary-list summary-list--compact">
              <div>
                <dt>Sliding Window</dt>
                <dd>{model.slidingWindow}</dd>
              </div>
              <div>
                <dt>CSA TopK</dt>
                <dd>{model.indexTopk}</dd>
              </div>
              <div>
                <dt>CSA Rate</dt>
                <dd>{model.csaCompressRate}</dd>
              </div>
              <div>
                <dt>HCA Rate</dt>
                <dd>{model.hcaCompressRate}</dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <h3>MoE</h3>
            <dl className="summary-list summary-list--compact">
              <div>
                <dt>Routed Experts</dt>
                <dd>{model.moeExperts}</dd>
              </div>
              <div>
                <dt>Active / Token</dt>
                <dd>{model.activeExperts}</dd>
              </div>
              <div>
                <dt>Intermediate</dt>
                <dd>{model.moeIntermediateSize}</dd>
              </div>
            </dl>
          </article>
        </aside>
      </div>

      <div className="panel-grid">
        <ScheduleBar
          title="Attention Schedule"
          items={[
            { label: "Sliding", count: model.slidingLayerCount, tone: "neutral" },
            { label: "CSA", count: model.csaLayerCount, tone: "blue" },
            { label: "HCA", count: model.hcaLayerCount, tone: "teal" }
          ]}
        />
        <ScheduleBar
          title="MLP Schedule"
          items={[
            { label: "Hash MoE", count: Math.min(3, model.decoderLayers), tone: "amber" },
            { label: "MoE", count: Math.max(model.decoderLayers - 3, 0), tone: "green" }
          ]}
        />
      </div>

      <ParameterTable model={model} />
    </section>
  );
}
