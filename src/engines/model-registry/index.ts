import type { ModelDefinition, ModelId } from "../../domain/model/types";
import { deepseekV4Models } from "./deepseekV4Models";

export const modelRegistry = deepseekV4Models;

const familyDisplayNames: Record<string, string> = {
  "deepseek-v4": "DeepSeek V4"
};

export type ModelFamilyOption = {
  id: string;
  displayName: string;
};

export function getModelFamilies(): ModelFamilyOption[] {
  return Array.from(new Set(modelRegistry.map((entry) => entry.family))).map((family) => ({
    id: family,
    displayName: familyDisplayNames[family] ?? family
  }));
}

export function getModelsByFamily(family: string): ModelDefinition[] {
  return modelRegistry.filter((entry) => entry.family === family);
}

export function getModelDefinition(modelId: ModelId): ModelDefinition {
  const model = modelRegistry.find((entry) => entry.id === modelId);

  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  return model;
}
