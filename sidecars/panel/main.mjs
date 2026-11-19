// Backend for Antigravity Token & Cache Monitor UI Extension (v2.0)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import {
  DEFAULT_USD_TO_CNY,
  MODEL_CATALOG,
  MODEL_GROUPS,
  MODEL_MAP,
  UNKNOWN_MODEL_META,
  calculateStepCost,
  normalizeModel
} from './pricing.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAIN_DIR = join(homedir(), '.gemini', 'antigravity', 'brain');

const app = new SidecarApp();

const readLocal = (name) => readFileSync(join(HERE, name), 'utf8');
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// Incremental per-conversation parse cache keyed by conversationId -> { mtimeMs, size, parsed }
const transcriptCache = new Map();

// Pages & Static Assets (disable HTTP caching so UI updates apply immediately)
app.page('/', () => {
  const html = readLocal('index.html');
  const css = readLocal('styles.css');
  const rendered = html.replace('<!-- __INLINE_STYLES__ -->', `<style>\n${css}\n</style>`);
  return new Response(rendered, {
    contentType: 'text/html; charset=utf-8',
    headers: NO_CACHE_HEADERS
  });
});

app.page('/app.js', () => new Response(readLocal('app.js'), {
  contentType: 'application/javascript; charset=utf-8',
  headers: NO_CACHE_HEADERS
}));

app.page('/pricing.mjs', () => new Response(readLocal('pricing.mjs'), {
  contentType: 'application/javascript; charset=utf-8',
  headers: NO_CACHE_HEADERS
}));

app.page('/styles.css', () => new Response(readLocal('styles.css'), {
  contentType: 'text/css; charset=utf-8',
  headers: NO_CACHE_HEADERS
}));

app.api('/styles.css', () => new Response(readLocal('styles.css'), {
  contentType: 'text/css; charset=utf-8',
  headers: NO_CACHE_HEADERS
}), 'GET');

// API: 模型目录与计费规则
app.api('/api/pricing', () => {
  return {
    defaultUsdToCny: DEFAULT_USD_TO_CNY,
    groups: MODEL_GROUPS,
    models: MODEL_CATALOG,
    unknownMeta: UNKNOWN_MODEL_META
  };
}, 'GET');

// API: 获取所有对话汇总、模型分布与时间段统计
app.api('/api/global-stats', (query) => {
  return getAllConversationsStats(query);
}, 'GET');

// API: 获取指定会话详细步骤
app.api('/api/stats', (query) => {
  let targetId = query?.conversationId;
  if (!targetId || targetId === 'null' || targetId === 'undefined') {
    targetId = getLatestConversationId();
  }
  if (!targetId) {
    return {
      error: '未找到活跃或历史会话日志。',
      conversationId: null,
      title: '未找到会话',
      isSubagent: false,
      totalInput: 0,
      totalCacheRead: 0,
      totalOutput: 0,
      totalTokens: 0,
      cacheHitRate: 0,
      stepCount: 0,
      autoCost: emptyAutoCost(),
      modelBreakdown: [],
      steps: []
    };
  }
  return parseSingleTranscript(targetId);
}, 'GET');

// ---------------------------------------------------------------------------
// 时区与日期转换辅助函数
// ---------------------------------------------------------------------------

function toLocalDateStr(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalYMD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTimeRangeFilter(query) {
  const range = query?.range || 'all';
  const now = new Date();
  const todayStr = formatLocalYMD(now);

  if (range === 'today') {
    return { start: todayStr, end: todayStr };
  } else if (range === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = formatLocalYMD(yesterday);
    return { start: yStr, end: yStr };
  } else if (range === '7d') {
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 6);
    return { start: formatLocalYMD(d7), end: todayStr };
  } else if (range === 'custom') {
    return {
      start: query?.startDate || '1970-01-01',
      end: query?.endDate || '2099-12-31'
    };
  }
  return { start: '1970-01-01', end: '2099-12-31' };
}

// ---------------------------------------------------------------------------
// 标题与模型提取辅助函数
// ---------------------------------------------------------------------------

function cleanTitleText(raw) {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function extractUserTitle(content) {
  if (!content || typeof content !== 'string') return '';

  const reqMatch = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  if (reqMatch) {
    return cleanTitleText(reqMatch[1]);
  }

  const stripped = content
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
    .replace(/<acp[^>]*>[\s\S]*?<\/acp>/gi, '');

  return cleanTitleText(stripped);
}

function extractSubagentTitle(systemMessages, cid) {
  const shortCid = cid.slice(0, 8);
  let roleTag = '';
  let goalSnippet = '';

  for (const msg of systemMessages) {
    if (!msg || typeof msg !== 'string') continue;

    // Strip the boilerplate preamble before unwrapping <SYSTEM_MESSAGE>...</SYSTEM_MESSAGE>,
    // because the preamble itself contains a literal "<SYSTEM_MESSAGE>" mention.
    let body = msg
      .replace(/^The following is a <SYSTEM_MESSAGE> not actually sent by the user\.[^\n]*\r?\n?/i, '')
      .trim();
    const innerMatch = body.match(/<SYSTEM_MESSAGE>([\s\S]*?)<\/SYSTEM_MESSAGE>/i);
    if (innerMatch) {
      body = innerMatch[1].trim();
    } else {
      body = body.replace(/<\/?SYSTEM_MESSAGE>/gi, '').trim();
    }

    if (!roleTag) {
      const roleMatch = body.match(/for\s+(@[a-zA-Z0-9_-]+)/);
      if (roleMatch) roleTag = roleMatch[1];
    }

    const goalMatch = body.match(/(?:^|\n)\s*Goal:\s*([^\n]+)/i);
    if (goalMatch && goalMatch[1].trim()) {
      goalSnippet = cleanTitleText(goalMatch[1]);
      break;
    }

    const contentMatch = body.match(/content=([^\n]+)/);
    if (contentMatch) {
      const cText = contentMatch[1].trim();
      if (!/^\[swarm\] new board message #\d+$/i.test(cText) && !/^You have just started\./i.test(cText)) {
        goalSnippet = cleanTitleText(cText);
        break;
      }
    }

    // Fallback to meaningful non-boilerplate line
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (
        /^\[Message\]\s+timestamp=/i.test(line) ||
        /^\[swarm\]\s+new board message/i.test(line) ||
        /^You are a (?:READ-ONLY|worker)/i.test(line) ||
        /^You are this swarm's/i.test(line) ||
        /^You have just started\./i.test(line)
      ) {
        continue;
      }
      goalSnippet = cleanTitleText(line);
      break;
    }
    if (goalSnippet) break;
  }

  const prefix = roleTag ? `[子代理 ${roleTag}]` : '[子代理]';
  if (goalSnippet) {
    return `${prefix} ${goalSnippet}`.slice(0, 64);
  }
  return `${prefix} ${shortCid}`;
}

function extractSettingsModelChange(content) {
  if (!content || typeof content !== 'string' || !content.includes('<USER_SETTINGS_CHANGE>')) {
    return '';
  }
  const blockRe = /<USER_SETTINGS_CHANGE>([\s\S]*?)<\/USER_SETTINGS_CHANGE>/gi;
  let lastModel = '';
  let blockMatch;
  while ((blockMatch = blockRe.exec(content)) !== null) {
    const block = blockMatch[1];
    const selRe = /Model Selection`\s+from\s+.+?\s+to\s+([^\n<]+?)\.\s*(?:No need to comment|$)/im;
    const m = block.match(selRe);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (candidate && candidate.toLowerCase() !== 'none') {
        lastModel = candidate;
      }
    }
  }
  return lastModel;
}

function emptyAutoCost() {
  return {
    usd: 0,
    inputUsd: 0,
    cacheUsd: 0,
    outputUsd: 0,
    pricedSteps: 0,
    unpricedSteps: 0,
    pricedTokens: 0,
    unpricedTokens: 0
  };
}

function buildModelBreakdown(modelStatsMap) {
  const list = [];
  for (const [modelKey, stats] of modelStatsMap.entries()) {
    const meta = MODEL_MAP[modelKey] || UNKNOWN_MODEL_META;
    const prompt = stats.input + stats.cache;
    const hitRate = prompt > 0 ? parseFloat(((stats.cache / prompt) * 100).toFixed(1)) : 0;
    list.push({
      modelKey,
      name: meta.name,
      shortName: meta.shortName,
      color: meta.color,
      isUnknown: modelKey === 'unknown',
      steps: stats.steps,
      input: stats.input,
      cache: stats.cache,
      output: stats.output,
      total: stats.input + stats.cache + stats.output,
      hitRate,
      autoCostUsd: stats.autoCostUsd
    });
  }

  list.sort((a, b) => {
    if (a.isUnknown !== b.isUnknown) return a.isUnknown ? 1 : -1;
    return b.total - a.total;
  });

  return list;
}

function addStepToModelMap(modelStatsMap, step) {
  let entry = modelStatsMap.get(step.modelKey);
  if (!entry) {
    entry = { steps: 0, input: 0, cache: 0, output: 0, autoCostUsd: 0 };
    modelStatsMap.set(step.modelKey, entry);
  }
  entry.steps += 1;
  entry.input += step.input;
  entry.cache += step.cache;
  entry.output += step.output;
  entry.autoCostUsd += step.autoCostUsd;
}

// ---------------------------------------------------------------------------
// 转录日志解析与增量缓存
// ---------------------------------------------------------------------------

function parseTranscriptFile(logFile, conversationId) {
  const content = readFileSync(logFile, 'utf8');
  const lines = content.split('\n');

  let title = '';
  let activeSettingsModel = '';
  const systemMessages = [];
  const steps = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    let item;
    try {
      item = JSON.parse(line);
    } catch {
      continue;
    }

    if (typeof item.content === 'string') {
      const changedModel = extractSettingsModelChange(item.content);
      if (changedModel) {
        activeSettingsModel = changedModel;
      }
    }

    if (item.type === 'USER_INPUT' && !title && typeof item.content === 'string') {
      const candidateTitle = extractUserTitle(item.content);
      if (candidateTitle) {
        title = candidateTitle;
      }
    }

    if (item.type === 'SYSTEM_MESSAGE' && systemMessages.length < 6 && typeof item.content === 'string') {
      systemMessages.push(item.content);
    }

    if (item.type === 'PLANNER_RESPONSE') {
      const inp = Number(item.input_tokens) || 0;
      const cache = Number(item.cache_read_tokens) || 0;
      const out = Number(item.output_tokens) || 0;
      const prompt = inp + cache;
      const rate = prompt > 0 ? ((cache / prompt) * 100).toFixed(1) : '0.0';
      const localDate = item.created_at ? toLocalDateStr(item.created_at) : '';

      let rawModel = '';
      let modelSource = 'unknown';
      if (item.model && String(item.model).trim()) {
        rawModel = String(item.model).trim();
        modelSource = 'step';
      } else if (activeSettingsModel) {
        rawModel = activeSettingsModel;
        modelSource = 'settings';
      }

      const norm = normalizeModel(rawModel);
      const autoCost = calculateStepCost(norm.modelKey, inp, cache, out, localDate);

      steps.push({
        step: item.step_index ?? steps.length,
        input: inp,
        cache,
        output: out,
        hitRate: parseFloat(rate),
        timestamp: item.created_at || '',
        localDate,
        modelKey: norm.modelKey,
        modelLabel: norm.displayName,
        rawModel,
        modelSource,
        isWorker: norm.isWorker,
        isOrchestrator: norm.isOrchestrator,
        autoCostUsd: autoCost.totalUsd,
        autoInputUsd: autoCost.inputUsd,
        autoCacheUsd: autoCost.cacheUsd,
        autoOutputUsd: autoCost.outputUsd,
        autoPriced: autoCost.priced
      });
    }
  }

  let isSubagent = false;
  if (!title) {
    if (systemMessages.length > 0) {
      isSubagent = true;
      title = extractSubagentTitle(systemMessages, conversationId);
    } else {
      title = `会话 ${conversationId.slice(0, 8)}`;
    }
  }

  return {
    conversationId,
    title,
    isSubagent,
    steps
  };
}

function getParsedTranscript(conversationId) {
  const logFile = join(BRAIN_DIR, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
  if (!existsSync(logFile)) return null;

  const st = statSync(logFile);
  const cached = transcriptCache.get(conversationId);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    return cached.parsed;
  }

  const parsed = parseTranscriptFile(logFile, conversationId);
  transcriptCache.set(conversationId, {
    mtimeMs: st.mtimeMs,
    size: st.size,
    parsed
  });
  return parsed;
}

// ---------------------------------------------------------------------------
// 聚合与查询接口逻辑
// ---------------------------------------------------------------------------

function getAllConversationsStats(query) {
  if (!existsSync(BRAIN_DIR)) {
    return {
      timeRange: { start: '', end: '', range: query?.range || 'all' },
      summary: {
        totalInput: 0,
        totalCacheRead: 0,
        totalOutput: 0,
        totalTokens: 0,
        cacheHitRate: 0,
        totalSteps: 0,
        conversationCount: 0,
        autoCost: emptyAutoCost()
      },
      modelBreakdown: [],
      dailyTrends: [],
      conversations: []
    };
  }

  const range = query?.range || 'all';
  const { start, end } = getTimeRangeFilter(query);
  const convEntries = readdirSync(BRAIN_DIR);
  const activeCids = new Set(convEntries);

  // Prune stale cache entries for deleted conversations
  for (const cachedCid of transcriptCache.keys()) {
    if (!activeCids.has(cachedCid)) {
      transcriptCache.delete(cachedCid);
    }
  }

  let totalInput = 0;
  let totalCacheRead = 0;
  let totalOutput = 0;
  let totalSteps = 0;
  const autoCost = emptyAutoCost();

  const globalModelMap = new Map();
  const dailyMap = {};
  const conversations = [];

  for (const cid of convEntries) {
    try {
      const parsed = getParsedTranscript(cid);
      if (!parsed) continue;

      let cInput = 0;
      let cCache = 0;
      let cOutput = 0;
      let cSteps = 0;
      let cAutoCostUsd = 0;
      let cUnpricedSteps = 0;
      let lastTime = '';
      const convModelMap = new Map();

      for (const s of parsed.steps) {
        if (range !== 'all') {
          if (!s.localDate || s.localDate < start || s.localDate > end) continue;
        } else if (s.localDate && (s.localDate < start || s.localDate > end)) {
          continue;
        }

        if (s.timestamp && s.timestamp > lastTime) {
          lastTime = s.timestamp;
        }

        totalInput += s.input;
        totalCacheRead += s.cache;
        totalOutput += s.output;
        totalSteps++;

        const stepTotalTokens = s.input + s.cache + s.output;
        if (s.autoPriced) {
          autoCost.usd += s.autoCostUsd;
          autoCost.inputUsd += s.autoInputUsd;
          autoCost.cacheUsd += s.autoCacheUsd;
          autoCost.outputUsd += s.autoOutputUsd;
          autoCost.pricedSteps += 1;
          autoCost.pricedTokens += stepTotalTokens;
        } else {
          autoCost.unpricedSteps += 1;
          autoCost.unpricedTokens += stepTotalTokens;
          cUnpricedSteps += 1;
        }

        cInput += s.input;
        cCache += s.cache;
        cOutput += s.output;
        cSteps++;
        cAutoCostUsd += s.autoCostUsd;

        addStepToModelMap(globalModelMap, s);
        addStepToModelMap(convModelMap, s);

        if (s.localDate) {
          if (!dailyMap[s.localDate]) {
            dailyMap[s.localDate] = {
              date: s.localDate,
              input: 0,
              cache: 0,
              output: 0,
              steps: 0,
              autoCostUsd: 0,
              unpricedSteps: 0
            };
          }
          dailyMap[s.localDate].input += s.input;
          dailyMap[s.localDate].cache += s.cache;
          dailyMap[s.localDate].output += s.output;
          dailyMap[s.localDate].steps += 1;
          dailyMap[s.localDate].autoCostUsd += s.autoCostUsd;
          if (!s.autoPriced) {
            dailyMap[s.localDate].unpricedSteps += 1;
          }
        }
      }

      if (cSteps > 0) {
        const cPrompt = cInput + cCache;
        const cHitRate = cPrompt > 0 ? ((cCache / cPrompt) * 100).toFixed(1) : '0.0';
        const convBreakdown = buildModelBreakdown(convModelMap);
        const modelKeys = convBreakdown.map((m) => m.modelKey);
        const primaryModelKey = modelKeys.find((k) => k !== 'unknown') || modelKeys[0] || 'unknown';
        const modelSummary = convBreakdown.map((m) => ({
          modelKey: m.modelKey,
          shortName: m.shortName,
          color: m.color,
          steps: m.steps
        }));

        conversations.push({
          conversationId: cid,
          title: parsed.title,
          isSubagent: parsed.isSubagent,
          input: cInput,
          cache: cCache,
          output: cOutput,
          total: cInput + cCache + cOutput,
          hitRate: parseFloat(cHitRate),
          steps: cSteps,
          lastTime,
          primaryModelKey,
          modelKeys,
          modelSummary,
          autoCostUsd: cAutoCostUsd,
          unpricedSteps: cUnpricedSteps
        });
      }
    } catch (err) {
      console.error(`Error reading transcript for ${cid}:`, err);
    }
  }

  const totalPrompt = totalInput + totalCacheRead;
  const overallHitRate = totalPrompt > 0 ? ((totalCacheRead / totalPrompt) * 100).toFixed(1) : '0.0';

  const dailyTrends = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const prompt = d.input + d.cache;
      return {
        ...d,
        total: d.input + d.cache + d.output,
        hitRate: prompt > 0 ? parseFloat(((d.cache / prompt) * 100).toFixed(1)) : 0
      };
    });

  conversations.sort((a, b) => b.total - a.total);

  return {
    timeRange: { start, end, range },
    summary: {
      totalInput,
      totalCacheRead,
      totalOutput,
      totalTokens: totalInput + totalCacheRead + totalOutput,
      cacheHitRate: parseFloat(overallHitRate),
      totalSteps,
      conversationCount: conversations.length,
      autoCost
    },
    modelBreakdown: buildModelBreakdown(globalModelMap),
    dailyTrends,
    conversations
  };
}

function getLatestConversationId() {
  if (!existsSync(BRAIN_DIR)) return null;
  try {
    const entries = readdirSync(BRAIN_DIR);
    let latestId = null;
    let latestMtime = 0;
    for (const name of entries) {
      const logFile = join(BRAIN_DIR, name, '.system_generated', 'logs', 'transcript.jsonl');
      if (existsSync(logFile)) {
        const mtime = statSync(logFile).mtimeMs;
        if (mtime > latestMtime) {
          latestMtime = mtime;
          latestId = name;
        }
      }
    }
    return latestId;
  } catch {
    return null;
  }
}

function parseSingleTranscript(conversationId) {
  try {
    const parsed = getParsedTranscript(conversationId);
    if (!parsed) {
      return {
        conversationId,
        error: '未找到日志文件',
        title: `会话 ${conversationId.slice(0, 8)}`,
        isSubagent: false,
        totalInput: 0,
        totalCacheRead: 0,
        totalOutput: 0,
        totalTokens: 0,
        cacheHitRate: 0,
        stepCount: 0,
        autoCost: emptyAutoCost(),
        modelBreakdown: [],
        steps: []
      };
    }

    let totalInput = 0;
    let totalCacheRead = 0;
    let totalOutput = 0;
    const autoCost = emptyAutoCost();
    const convModelMap = new Map();

    for (const s of parsed.steps) {
      totalInput += s.input;
      totalCacheRead += s.cache;
      totalOutput += s.output;

      const stepTotal = s.input + s.cache + s.output;
      if (s.autoPriced) {
        autoCost.usd += s.autoCostUsd;
        autoCost.inputUsd += s.autoInputUsd;
        autoCost.cacheUsd += s.autoCacheUsd;
        autoCost.outputUsd += s.autoOutputUsd;
        autoCost.pricedSteps += 1;
        autoCost.pricedTokens += stepTotal;
      } else {
        autoCost.unpricedSteps += 1;
        autoCost.unpricedTokens += stepTotal;
      }

      addStepToModelMap(convModelMap, s);
    }

    const totalPrompt = totalInput + totalCacheRead;
    const hitRate = totalPrompt > 0 ? ((totalCacheRead / totalPrompt) * 100).toFixed(1) : '0.0';

    return {
      conversationId,
      title: parsed.title,
      isSubagent: parsed.isSubagent,
      totalInput,
      totalCacheRead,
      totalOutput,
      totalTokens: totalInput + totalCacheRead + totalOutput,
      cacheHitRate: parseFloat(hitRate),
      stepCount: parsed.steps.length,
      autoCost,
      modelBreakdown: buildModelBreakdown(convModelMap),
      steps: parsed.steps.slice().reverse()
    };
  } catch (err) {
    return {
      conversationId,
      error: err.message,
      title: `会话 ${conversationId.slice(0, 8)}`,
      isSubagent: false,
      totalInput: 0,
      totalCacheRead: 0,
      totalOutput: 0,
      totalTokens: 0,
      cacheHitRate: 0,
      stepCount: 0,
      autoCost: emptyAutoCost(),
      modelBreakdown: [],
      steps: []
    };
  }
}

app.run();
