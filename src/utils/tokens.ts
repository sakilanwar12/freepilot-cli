const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-2024-08-06': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'deepseek-chat': { input: 0.07, output: 0.28 },
  'deepseek-coder': { input: 0.07, output: 0.28 },
};

const DEFAULT_PRICING = { input: 2.5, output: 10 };
const FREE_MODELS = new Set(['codellama', 'llama3', 'llama3.1', 'mistral', 'qwen2.5-coder', 'deepseek-coder:local']);

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function getPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] || DEFAULT_PRICING;
}

export function formatCost(inputTokens: number, outputTokens: number, model: string): string {
  const modelClean = model.replace(/^ollama\//, '');
  if (FREE_MODELS.has(modelClean)) {
    return 'Free (local)';
  }
  const pricing = getPricing(model);
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

  if (cost < 0.01) {
    return '<$0.01';
  }
  return `$${cost.toFixed(2)}`;
}
