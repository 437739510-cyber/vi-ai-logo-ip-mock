export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash" as const;

export const SUPPORTED_DEEPSEEK_MODELS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
] as const;

export type SupportedDeepSeekModel = (typeof SUPPORTED_DEEPSEEK_MODELS)[number];

export interface DeepSeekTokenUsage {
  promptTokens: number;
  cachedPromptTokens: number;
  completionTokens: number;
}

export interface DeepSeekPricesCnyPerMillion {
  cacheHitInput: number;
  cacheMissInput: number;
  output: number;
}

export interface DeepSeekCostBreakdown {
  model: SupportedDeepSeekModel;
  isPeak: boolean;
  cacheMissPromptTokens: number;
  cachedPromptTokens: number;
  completionTokens: number;
  prices: DeepSeekPricesCnyPerMillion;
  totalCostCny: number;
}

export interface NormalizedDeepSeekResponseModel {
  model: SupportedDeepSeekModel;
  observedModel?: string;
  source: "exact" | "version-alias" | "request-fallback";
  warning?: string;
}

const PEAK_PRICES_CNY_PER_MILLION: Record<
  SupportedDeepSeekModel,
  DeepSeekPricesCnyPerMillion
> = {
  "deepseek-v4-flash": {
    cacheHitInput: 0.1,
    cacheMissInput: 3,
    output: 9,
  },
  "deepseek-v4-pro": {
    cacheHitInput: 0.3,
    cacheMissInput: 9,
    output: 27,
  },
};

function isSupportedDeepSeekModel(value: string): value is SupportedDeepSeekModel {
  return (SUPPORTED_DEEPSEEK_MODELS as readonly string[]).includes(value);
}

export function resolveDeepSeekModel(
  configuredModel: string | undefined = process.env.DEEPSEEK_MODEL
): SupportedDeepSeekModel {
  const model = configuredModel?.trim() || DEFAULT_DEEPSEEK_MODEL;
  if (!isSupportedDeepSeekModel(model)) {
    throw new Error(
      `Unsupported DeepSeek model "${model}". Supported models: ${SUPPORTED_DEEPSEEK_MODELS.join(
        ", "
      )}`
    );
  }
  return model;
}

export function normalizeDeepSeekResponseModel(
  responseModel: unknown,
  requestedModel: SupportedDeepSeekModel
): NormalizedDeepSeekResponseModel {
  if (typeof responseModel !== "string" || responseModel.trim() === "") {
    return {
      model: requestedModel,
      source: "request-fallback",
    };
  }

  const observedModel = responseModel.trim().toLowerCase();
  if (observedModel === "deepseek-v4-flash" || observedModel === "deepseek-v4-pro") {
    return {
      model: observedModel,
      observedModel,
      source: "exact",
    };
  }

  if (/^deepseek-v4-flash-\d{4,8}$/.test(observedModel)) {
    return {
      model: "deepseek-v4-flash",
      observedModel,
      source: "version-alias",
    };
  }
  if (/^deepseek-v4-pro-\d{4,8}$/.test(observedModel)) {
    return {
      model: "deepseek-v4-pro",
      observedModel,
      source: "version-alias",
    };
  }

  return {
    model: requestedModel,
    observedModel,
    source: "request-fallback",
    warning: `Unrecognized DeepSeek response model "${responseModel}"; pricing with requested model "${requestedModel}"`,
  };
}

export function isDeepSeekPeakTime(date: Date = new Date()): boolean {
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const minutes = beijingTime.getUTCHours() * 60 + beijingTime.getUTCMinutes();
  return (minutes >= 9 * 60 && minutes < 12 * 60) ||
    (minutes >= 14 * 60 && minutes < 18 * 60);
}

export function getDeepSeekPrices(
  model: SupportedDeepSeekModel,
  date: Date = new Date()
): DeepSeekPricesCnyPerMillion {
  const peakPrices = PEAK_PRICES_CNY_PER_MILLION[model];
  if (isDeepSeekPeakTime(date)) return { ...peakPrices };
  return {
    cacheHitInput: peakPrices.cacheHitInput / 2,
    cacheMissInput: peakPrices.cacheMissInput / 2,
    output: peakPrices.output / 2,
  };
}

export function calculateDeepSeekCost(
  model: SupportedDeepSeekModel,
  usage: DeepSeekTokenUsage,
  date: Date = new Date()
): DeepSeekCostBreakdown {
  const promptTokens = Math.max(usage.promptTokens, 0);
  const cachedPromptTokens = Math.max(usage.cachedPromptTokens, 0);
  const completionTokens = Math.max(usage.completionTokens, 0);
  const cacheMissPromptTokens = Math.max(promptTokens - cachedPromptTokens, 0);
  const prices = getDeepSeekPrices(model, date);
  const totalCostCny =
    (cacheMissPromptTokens / 1_000_000) * prices.cacheMissInput +
    (cachedPromptTokens / 1_000_000) * prices.cacheHitInput +
    (completionTokens / 1_000_000) * prices.output;

  return {
    model,
    isPeak: isDeepSeekPeakTime(date),
    cacheMissPromptTokens,
    cachedPromptTokens,
    completionTokens,
    prices,
    totalCostCny,
  };
}
