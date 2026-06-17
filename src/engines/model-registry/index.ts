import type { ModelDefinition, ModelId } from "../../domain/model/types";
import { deepseekV4Models } from "./deepseekV4Models";

export const modelRegistry = deepseekV4Models;

export function getModelDefinition(modelId: ModelId): ModelDefinition {
  const model = modelRegistry.find((entry) => entry.id === modelId);

  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  return model;
}

