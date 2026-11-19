// Shared model catalog, normalization, and tiered/dated pricing rules.
// Pure ESM with no Node-only dependencies so backend and tests share one source of truth.

export const DEFAULT_USD_TO_CNY = 7.20;

export const MODEL_GROUPS = [
  'Gemini 4',
  'Gemini 3.x / 2.5',
  'Claude',
  '其他'
];

export const MODEL_CATALOG = [
  // Gemini 4
  {
    key: 'gemini-4-neon',
    name: 'Gemini 4 Neon',
    shortName: '4 Neon',
    group: 'Gemini 4',
    color: '#06b6d4',
    note: '含 Orchestrator (Neon)',
    rates: [
      { input: 3.00, cache: 0.15, output: 15.00 }
    ]
  },
  {
    key: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    shortName: '4 Argon',
    group: 'Gemini 4',
    color: '#6366f1',
    note: '2026-12-01 起调价为 $4.00 / $0.20 / $20.00',
    rates: [
      { effectiveTo: '2026-11-30', input: 2.00, cache: 0.10, output: 10.00 },
      { effectiveFrom: '2026-12-01', input: 4.00, cache: 0.20, output: 20.00 }
    ]
  },
  {
    key: 'gemini-4-carbon',
    name: 'Gemini 4 Carbon',
    shortName: '4 Carbon',
    group: 'Gemini 4',
    color: '#8b5cf6',
    note: '2026-12-01 起调价为 $4.00 / $0.20 / $20.00',
    rates: [
      { effectiveTo: '2026-11-30', input: 2.00, cache: 0.10, output: 10.00 },
      { effectiveFrom: '2026-12-01', input: 4.00, cache: 0.20, output: 20.00 }
    ]
  },
  {
    key: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    shortName: '4 Hydrogen',
    group: 'Gemini 4',
    color: '#10b981',
    note: '含 Orchestrator Worker 执行阶段',
    rates: [
      { input: 1.50, cache: 0.075, output: 7.50 }
    ]
  },

  // Gemini 3.x / 2.5
  {
    key: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    shortName: '3.8 Flash',
    group: 'Gemini 3.x / 2.5',
    color: '#3b82f6',
    note: '2027-01-01 起调价为 $1.50 / $0.15 / $7.50',
    rates: [
      { effectiveTo: '2026-12-31', input: 0.75, cache: 0.075, output: 3.75 },
      { effectiveFrom: '2027-01-01', input: 1.50, cache: 0.15, output: 7.50 }
    ]
  },
  {
    key: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    shortName: '3.5 Flash-Lite',
    group: 'Gemini 3.x / 2.5',
    color: '#38bdf8',
    note: '轻量高速参考费率',
    rates: [
      { input: 0.30, cache: 0.03, output: 2.50 }
    ]
  },
  {
    key: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    shortName: '3.1 Pro',
    group: 'Gemini 3.x / 2.5',
    color: '#0ea5e9',
    note: '>200K 上下文适用高阶费率',
    rates: [
      { maxPromptTokens: 200000, input: 2.00, cache: 0.20, output: 12.00 },
      { minPromptTokens: 200001, input: 4.00, cache: 0.40, output: 18.00 }
    ]
  },
  {
    key: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    shortName: '2.5 Pro',
    group: 'Gemini 3.x / 2.5',
    color: '#64748b',
    note: '>200K 上下文适用高阶费率',
    rates: [
      { maxPromptTokens: 200000, input: 1.25, cache: 0.125, output: 10.00 },
      { minPromptTokens: 200001, input: 2.50, cache: 0.25, output: 15.00 }
    ]
  },

  // Claude
  {
    key: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    shortName: 'Opus 5.5',
    group: 'Claude',
    color: '#ec4899',
    note: '缓存读取 0.05×',
    rates: [
      { input: 4.00, cache: 0.20, output: 20.00 }
    ]
  },
  {
    key: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    shortName: 'Sonnet 5.5',
    group: 'Claude',
    color: '#f97316',
    note: '缓存读取 0.05×',
    rates: [
      { input: 2.00, cache: 0.10, output: 10.00 }
    ]
  },
  {
    key: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    shortName: 'Opus 4.6',
    group: 'Claude',
    color: '#e11d48',
    note: '历史 Opus 4.x 费率 (缓存 0.1×)',
    rates: [
      { input: 5.00, cache: 0.50, output: 25.00 }
    ]
  },
  {
    key: 'claude-sonnet-4',
    name: 'Claude Sonnet 4.x (旧版)',
    shortName: 'Sonnet 4.x',
    group: 'Claude',
    color: '#fb923c',
    note: '旧版 Sonnet 参考费率',
    rates: [
      { input: 3.00, cache: 0.30, output: 15.00 }
    ]
  },

  // 其他
  {
    key: 'gpt-oss-120b',
    name: 'GPT-OSS 120B',
    shortName: 'GPT-OSS 120B',
    group: '其他',
    color: '#14b8a6',
    note: '开源权重托管参考价',
    rates: [
      { input: 0.15, cache: 0.075, output: 0.60 }
    ]
  }
];

export const MODEL_MAP = Object.fromEntries(MODEL_CATALOG.map((m) => [m.key, m]));

export const UNKNOWN_MODEL_META = {
  key: 'unknown',
  name: '未记录模型 (历史)',
  shortName: '未记录',
  group: '历史',
  color: '#64748b',
  note: '早期日志未写入模型字段',
  rates: []
};

export function normalizeModel(rawModel) {
  const raw = rawModel === undefined || rawModel === null ? '' : String(rawModel).trim();
  if (!raw) {
    return {
      modelKey: 'unknown',
      displayName: UNKNOWN_MODEL_META.shortName,
      rawModel: '',
      isWorker: false,
      isOrchestrator: false
    };
  }

  const str = raw.toLowerCase();
  const isOrch = str.includes('orchestrator');

  // 1. Orchestrator worker must match before generic flash rules
  if (str.includes('flash-worker') || str.includes('worker-agy')) {
    return {
      modelKey: 'gemini-4-hydrogen',
      displayName: 'Hydrogen (Worker)',
      rawModel: raw,
      isWorker: true,
      isOrchestrator: false
    };
  }

  // 2. Gemini 4 Neon (including Orchestrator Neon)
  if (str.includes('neon')) {
    return {
      modelKey: 'gemini-4-neon',
      displayName: isOrch ? 'Neon (Plan)' : 'Gemini 4 Neon',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: isOrch
    };
  }

  // 3. Gemini 4 Carbon
  if (str.includes('carbon') || str.includes('m670')) {
    return {
      modelKey: 'gemini-4-carbon',
      displayName: isOrch ? 'Carbon (Plan)' : 'Gemini 4 Carbon',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: isOrch
    };
  }

  // 4. Gemini 4 Argon (including bare orchestrator & g1-pro variants)
  if (
    str.includes('argon') ||
    str.includes('m668') ||
    /\bgemini-pro-orchestrator(?:-(?:argon|g1(?:-pro)?))?$/.test(str)
  ) {
    return {
      modelKey: 'gemini-4-argon',
      displayName: isOrch ? 'Argon (Plan)' : 'Gemini 4 Argon',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: isOrch
    };
  }

  // 5. Gemini 4 Hydrogen
  if (str.includes('hydrogen')) {
    return {
      modelKey: 'gemini-4-hydrogen',
      displayName: 'Gemini 4 Hydrogen',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: isOrch
    };
  }

  // 6. Gemini 3.8 Flash
  if (
    str.includes('3.8-flash') ||
    str.includes('3.8 flash') ||
    str.includes('flash-n') ||
    str.includes('m318') ||
    str.includes('m322')
  ) {
    return {
      modelKey: 'gemini-3.8-flash',
      displayName: 'Gemini 3.8 Flash',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 7. Gemini 3.5 Flash-Lite
  if (str.includes('flash-lite') || str.includes('3.5-flash-lite') || str.includes('3.5 flash-lite')) {
    return {
      modelKey: 'gemini-3.5-flash-lite',
      displayName: 'Gemini 3.5 Flash-Lite',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 8. Gemini 3.1 Pro
  if (str.includes('3.1-pro') || str.includes('3.1 pro')) {
    return {
      modelKey: 'gemini-3.1-pro',
      displayName: 'Gemini 3.1 Pro',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 9. Gemini 2.5 Pro
  if (str.includes('2.5-pro') || str.includes('2.5 pro')) {
    return {
      modelKey: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 10. Claude Opus 5.5
  if (/opus[-_ ]?5[._-]5/.test(str) || /5[._-]5[-_ ]?opus/.test(str)) {
    return {
      modelKey: 'claude-opus-5-5',
      displayName: 'Claude Opus 5.5',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 11. Claude Sonnet 5.5
  if (/sonnet[-_ ]?5[._-]5/.test(str) || /5[._-]5[-_ ]?sonnet/.test(str)) {
    return {
      modelKey: 'claude-sonnet-5-5',
      displayName: 'Claude Sonnet 5.5',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 12. Claude Opus 4.6 (and 4.5)
  if (/opus[-_ ]?4[._-]?[56]/.test(str) || str.includes('claude opus 4')) {
    return {
      modelKey: 'claude-opus-4-6',
      displayName: 'Claude Opus 4.6',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 13. Claude Sonnet (fallback to 4.x)
  if (str.includes('sonnet')) {
    return {
      modelKey: 'claude-sonnet-4',
      displayName: 'Claude Sonnet 4.x',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 14. Claude Opus (generic fallback to 5.5)
  if (str.includes('opus')) {
    return {
      modelKey: 'claude-opus-5-5',
      displayName: 'Claude Opus 5.5',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  // 15. GPT-OSS 120B
  if (str.includes('gpt-oss') || str.includes('gpt_oss')) {
    return {
      modelKey: 'gpt-oss-120b',
      displayName: 'GPT-OSS 120B',
      rawModel: raw,
      isWorker: false,
      isOrchestrator: false
    };
  }

  return {
    modelKey: 'unknown',
    displayName: UNKNOWN_MODEL_META.shortName,
    rawModel: raw,
    isWorker: false,
    isOrchestrator: false
  };
}

export function getEffectiveRate(modelKey, dateStr = '', promptTokens = 0) {
  const model = MODEL_MAP[modelKey];
  if (!model || !Array.isArray(model.rates) || model.rates.length === 0) {
    return null;
  }

  const normalizedDate = dateStr && /^\d{4}-\d{2}-\d{2}/.test(String(dateStr))
    ? String(dateStr).slice(0, 10)
    : '';
  const totalPrompt = Number(promptTokens) || 0;

  for (const rule of model.rates) {
    if (rule.effectiveTo && normalizedDate && normalizedDate > rule.effectiveTo) continue;
    if (rule.effectiveFrom && normalizedDate && normalizedDate < rule.effectiveFrom) continue;
    if (rule.maxPromptTokens !== undefined && totalPrompt > rule.maxPromptTokens) continue;
    if (rule.minPromptTokens !== undefined && totalPrompt < rule.minPromptTokens) continue;
    return rule;
  }

  return model.rates[0];
}

export function calculateStepCost(modelKey, input = 0, cache = 0, output = 0, dateStr = '') {
  if (!modelKey || modelKey === 'unknown') {
    return {
      priced: false,
      inputUsd: 0,
      cacheUsd: 0,
      outputUsd: 0,
      totalUsd: 0,
      rate: null
    };
  }

  const inp = Math.max(0, Number(input) || 0);
  const cap = Math.max(0, Number(cache) || 0);
  const out = Math.max(0, Number(output) || 0);
  const rate = getEffectiveRate(modelKey, dateStr, inp + cap);

  if (!rate) {
    return {
      priced: false,
      inputUsd: 0,
      cacheUsd: 0,
      outputUsd: 0,
      totalUsd: 0,
      rate: null
    };
  }

  const inputUsd = (inp / 1e6) * rate.input;
  const cacheUsd = (cap / 1e6) * rate.cache;
  const outputUsd = (out / 1e6) * rate.output;
  const totalUsd = inputUsd + cacheUsd + outputUsd;

  return {
    priced: true,
    inputUsd,
    cacheUsd,
    outputUsd,
    totalUsd,
    rate
  };
}
