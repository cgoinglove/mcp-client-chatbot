import { ollama } from "ollama-ai-provider";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { xai } from "@ai-sdk/xai";
import {
  extractReasoningMiddleware,
  LanguageModel,
  wrapLanguageModel,
} from "ai";

const wrappedReasoningModel = (model: LanguageModel) => {
  return wrapLanguageModel({
    model,
    middleware: extractReasoningMiddleware({
      tagName: "reasoning",
      separator: "\n",
    }),
  });
};

export const allModels = {
  openai: {
    "4o-mini": openai("gpt-4o-mini", {}),
    "4o": openai("gpt-4o"),
    "o3-mini": wrappedReasoningModel(
      openai("o3-mini", {
        reasoningEffort: "high",
      }),
    ),
  },
  google: {
    "gemini-2.0": google("gemini-2.0-flash-exp"),
    "gemini-2.0-thinking": wrappedReasoningModel(
      google("gemini-2.0-flash-thinking-exp-01-21"),
    ),
    "gemini-2.5-pro": google("gemini-2.5-pro-exp-03-25"),
  },
  anthropic: {
    "claude-3-5-sonnet": anthropic("claude-3-5-sonnet-latest"),
    "claude-3-7-sonnet": anthropic("claude-3-5-sonnet-latest"),
  },
  xai: {
    "grok-2": xai("grok-2-1212"),
    "grok-3-mini": wrappedReasoningModel(xai("grok-3-mini-beta")),
    "grok-3": wrappedReasoningModel(xai("grok-3-beta")),
  },
  ollama: {
    "gemma3:1b": ollama("gemma3:1b"),
    "gemma3:4b": ollama("gemma3:4b"),
    "gemma3:12b": ollama("gemma3:12b"),
  },
} as const;

export const isReasoningModel = (model: LanguageModel) => {
  return [
    allModels.openai["o3-mini"],
    allModels.google["gemini-2.0-thinking"],
    allModels.xai["grok-3"],
    allModels.xai["grok-3-mini"],
    allModels.google["gemini-2.0-thinking"],
  ].includes(model);
};

export const DEFAULT_MODEL = "4o-mini";

const fallbackModel = allModels.openai[DEFAULT_MODEL];

export const customModelProvider = {
  modelsInfo: Object.keys(allModels).map((provider) => {
    return {
      provider,
      models: Object.keys(allModels[provider]).map((name) => {
        return {
          name,
          isReasoningModel: isReasoningModel(allModels[provider][name]),
        };
      }),
    };
  }),
  getModel: (model?: string): LanguageModel => {
    return (Object.values(allModels).find((models) => {
      return models[model!];
    })?.[model!] ?? fallbackModel) as LanguageModel;
  },
};
