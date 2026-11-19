// Frontend logic for Token & Cache Monitor UI Extension (v2.0)
const $ = (id) => document.getElementById(id);

const STORAGE_KEYS = {
  pricing: 'tm_pricing_mode',
  fxRate: 'tm_usd_to_cny',
  sort: 'tm_conv_sort'
};

// Built-in fallback in case /api/pricing is temporarily unreachable
const FALLBACK_PRICING = {
  defaultUsdToCny: 7.20,
  groups: ['Gemini 4', 'Gemini 3.x / 2.5', 'Claude', '其他'],
  models: [
    { key: 'gemini-4-neon', name: 'Gemini 4 Neon', shortName: '4 Neon', group: 'Gemini 4', color: '#06b6d4', rates: [{ input: 3.00, cache: 0.15, output: 15.00 }] },
    { key: 'gemini-4-argon', name: 'Gemini 4 Argon', shortName: '4 Argon', group: 'Gemini 4', color: '#6366f1', rates: [{ effectiveTo: '2026-11-30', input: 2.00, cache: 0.10, output: 10.00 }, { effectiveFrom: '2026-12-01', input: 4.00, cache: 0.20, output: 20.00 }] },
    { key: 'gemini-4-carbon', name: 'Gemini 4 Carbon', shortName: '4 Carbon', group: 'Gemini 4', color: '#8b5cf6', rates: [{ effectiveTo: '2026-11-30', input: 2.00, cache: 0.10, output: 10.00 }, { effectiveFrom: '2026-12-01', input: 4.00, cache: 0.20, output: 20.00 }] },
    { key: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', shortName: '4 Hydrogen', group: 'Gemini 4', color: '#10b981', rates: [{ input: 1.50, cache: 0.075, output: 7.50 }] },
    { key: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', shortName: '3.8 Flash', group: 'Gemini 3.x / 2.5', color: '#3b82f6', rates: [{ effectiveTo: '2026-12-31', input: 0.75, cache: 0.075, output: 3.75 }, { effectiveFrom: '2027-01-01', input: 1.50, cache: 0.15, output: 7.50 }] },
    { key: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', shortName: '3.5 Flash-Lite', group: 'Gemini 3.x / 2.5', color: '#38bdf8', rates: [{ input: 0.30, cache: 0.03, output: 2.50 }] },
    { key: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', shortName: '3.1 Pro', group: 'Gemini 3.x / 2.5', color: '#0ea5e9', rates: [{ maxPromptTokens: 200000, input: 2.00, cache: 0.20, output: 12.00 }, { minPromptTokens: 200001, input: 4.00, cache: 0.40, output: 18.00 }] },
    { key: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', shortName: '2.5 Pro', group: 'Gemini 3.x / 2.5', color: '#64748b', rates: [{ maxPromptTokens: 200000, input: 1.25, cache: 0.125, output: 10.00 }, { minPromptTokens: 200001, input: 2.50, cache: 0.25, output: 15.00 }] },
    { key: 'claude-opus-5-5', name: 'Claude Opus 5.5', shortName: 'Opus 5.5', group: 'Claude', color: '#ec4899', rates: [{ input: 4.00, cache: 0.20, output: 20.00 }] },
    { key: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', shortName: 'Sonnet 5.5', group: 'Claude', color: '#f97316', rates: [{ input: 2.00, cache: 0.10, output: 10.00 }] },
    { key: 'claude-opus-4-6', name: 'Claude Opus 4.6', shortName: 'Opus 4.6', group: 'Claude', color: '#e11d48', rates: [{ input: 5.00, cache: 0.50, output: 25.00 }] },
    { key: 'claude-sonnet-4', name: 'Claude Sonnet 4.x (旧版)', shortName: 'Sonnet 4.x', group: 'Claude', color: '#fb923c', rates: [{ input: 3.00, cache: 0.30, output: 15.00 }] },
    { key: 'gpt-oss-120b', name: 'GPT-OSS 120B', shortName: 'GPT-OSS 120B', group: '其他', color: '#14b8a6', rates: [{ input: 0.15, cache: 0.075, output: 0.60 }] }
  ],
  unknownMeta: { key: 'unknown', name: '未记录模型 (历史)', shortName: '未记录', color: '#64748b' }
};

function safeStorageGet(key, fallback) {
  try {
    const val = window.localStorage?.getItem(key);
    return val !== null && val !== undefined && val !== '' ? val : fallback;
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, val) {
  try {
    window.localStorage?.setItem(key, String(val));
  } catch {
    // Ignore storage errors inside restricted iframes
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '#64748b').replace('#', '');
  if (clean.length !== 6) return `rgba(100, 116, 139, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return `rgba(100, 116, 139, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Runtime state
let pricingCatalog = FALLBACK_PRICING.models;
let pricingGroups = FALLBACK_PRICING.groups;
let pricingMap = Object.fromEntries(pricingCatalog.map((m) => [m.key, m]));
let unknownMeta = FALLBACK_PRICING.unknownMeta;

let usdToCny = parseFloat(safeStorageGet(STORAGE_KEYS.fxRate, String(FALLBACK_PRICING.defaultUsdToCny)));
if (!Number.isFinite(usdToCny) || usdToCny <= 0) usdToCny = FALLBACK_PRICING.defaultUsdToCny;

let currentPricingKey = safeStorageGet(STORAGE_KEYS.pricing, 'auto');
let currentSort = safeStorageGet(STORAGE_KEYS.sort, 'total');
let currentMode = 'global'; // 'global' | 'single'
let currentRange = 'all';   // 'all' | 'today' | 'yesterday' | '7d' | 'custom'
let customStartDate = '';
let customEndDate = '';
let activeModelFilter = '';
let searchQuery = '';

function getSidecarContext() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || window.sidecar?.token || null;
  const conversationId = urlParams.get('conversationId') || window.sidecar?.conversationId || null;
  return { token, conversationId };
}

let activeConversationId = getSidecarContext().conversationId;
let cachedGlobalData = null;
let cachedSingleData = null;

async function callApi(path) {
  const { token } = getSidecarContext();
  if (window.sidecar && typeof window.sidecar.fetch === 'function') {
    try {
      const res = await window.sidecar.fetch(path, { method: 'GET' });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('sidecar.fetch failed, falling back to direct fetch', e);
    }
  }

  let url = path;
  if (token && !url.includes('token=')) {
    url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
  }
  const headers = {};
  if (token) {
    headers['X-Sidecar-Token'] = token;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.json();
}

function formatNum(n) {
  if (n === undefined || n === null) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Number(n).toLocaleString();
}

function formatFullNum(n) {
  if (n === undefined || n === null) return '0';
  return Number(n).toLocaleString();
}

function getLocalTodayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// 模型目录与费用折算
// ---------------------------------------------------------------------------

function applyPricingPayload(payload) {
  if (!payload || !Array.isArray(payload.models) || payload.models.length === 0) return;
  pricingCatalog = payload.models;
  pricingGroups = Array.isArray(payload.groups) && payload.groups.length ? payload.groups : FALLBACK_PRICING.groups;
  pricingMap = Object.fromEntries(pricingCatalog.map((m) => [m.key, m]));
  if (payload.unknownMeta) {
    unknownMeta = payload.unknownMeta;
  }
}

function renderPricingDropdown() {
  const select = $('select-pricing');
  if (!select) return;

  let html = '<option value="auto">🤖 自动 (实际模型)</option>';
  const renderedKeys = new Set();

  for (const group of pricingGroups) {
    const items = pricingCatalog.filter((m) => m.group === group);
    if (!items.length) continue;
    html += `<optgroup label="${escapeHtml(group)}">`;
    for (const m of items) {
      renderedKeys.add(m.key);
      html += `<option value="${escapeHtml(m.key)}">${escapeHtml(m.name)}</option>`;
    }
    html += '</optgroup>';
  }

  const remaining = pricingCatalog.filter((m) => !renderedKeys.has(m.key));
  if (remaining.length) {
    html += '<optgroup label="其他模型">';
    for (const m of remaining) {
      html += `<option value="${escapeHtml(m.key)}">${escapeHtml(m.name)}</option>`;
    }
    html += '</optgroup>';
  }

  select.innerHTML = html;

  if (currentPricingKey !== 'auto' && !pricingMap[currentPricingKey]) {
    currentPricingKey = 'auto';
  }
  select.value = currentPricingKey;
}

function getEffectiveRateClient(modelKey, dateStr = '', promptTokens = 0, usePromptTier = true) {
  const model = pricingMap[modelKey];
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
    if (usePromptTier) {
      if (rule.maxPromptTokens !== undefined && totalPrompt > rule.maxPromptTokens) continue;
      if (rule.minPromptTokens !== undefined && totalPrompt < rule.minPromptTokens) continue;
    }
    return rule;
  }
  return model.rates[0];
}

function calculateManualCost(modelKey, input = 0, cache = 0, output = 0, dateStr = '', usePromptTier = false) {
  const inp = Math.max(0, Number(input) || 0);
  const cap = Math.max(0, Number(cache) || 0);
  const out = Math.max(0, Number(output) || 0);
  const rate = getEffectiveRateClient(modelKey, dateStr, inp + cap, usePromptTier) || pricingCatalog[0]?.rates?.[0];
  if (!rate) {
    return { costIn: 0, costCache: 0, costOut: 0, totalUsd: 0, totalCny: 0 };
  }
  const costIn = (inp / 1e6) * rate.input;
  const costCache = (cap / 1e6) * rate.cache;
  const costOut = (out / 1e6) * rate.output;
  const totalUsd = costIn + costCache + costOut;
  return {
    costIn,
    costCache,
    costOut,
    totalUsd,
    totalCny: totalUsd * usdToCny
  };
}

function updateCostCards(totalInput, totalCacheRead, totalOutput, autoCost) {
  let costIn = 0;
  let costCache = 0;
  let costOut = 0;
  let totalUsd = 0;
  let extraCnyHint = '';
  let extraUsdHint = '';

  if (currentPricingKey === 'auto' && autoCost) {
    costIn = autoCost.inputUsd || 0;
    costCache = autoCost.cacheUsd || 0;
    costOut = autoCost.outputUsd || 0;
    totalUsd = autoCost.usd || 0;
    const totalSteps = (autoCost.pricedSteps || 0) + (autoCost.unpricedSteps || 0);
    if ((autoCost.unpricedSteps || 0) > 0) {
      extraCnyHint = ` · ${autoCost.unpricedSteps} 步未记录未计`;
      extraUsdHint = ` (${autoCost.pricedSteps}/${totalSteps} 步已计费)`;
    }
  } else {
    const manual = calculateManualCost(currentPricingKey, totalInput, totalCacheRead, totalOutput, getLocalTodayStr(), false);
    costIn = manual.costIn;
    costCache = manual.costCache;
    costOut = manual.costOut;
    totalUsd = manual.totalUsd;
  }

  const totalCny = totalUsd * usdToCny;
  $('val-cost-cny').textContent = `¥${totalCny.toFixed(2)}`;
  $('sub-cost-cny').textContent =
    `输入 ¥${(costIn * usdToCny).toFixed(1)} · 缓存 ¥${(costCache * usdToCny).toFixed(1)} · 输出 ¥${(costOut * usdToCny).toFixed(1)}${extraCnyHint}`;

  $('val-cost-usd').textContent = `$${totalUsd.toFixed(2)}`;
  $('sub-cost-usd').textContent =
    `输入 $${costIn.toFixed(2)} · 缓存 $${costCache.toFixed(2)} · 输出 $${costOut.toFixed(2)}${extraUsdHint}`;
}

function getModelMeta(modelKey) {
  if (modelKey === 'unknown') return unknownMeta;
  return pricingMap[modelKey] || unknownMeta;
}

function renderModelChipHtml(modelKey, labelOverride = '', titleAttr = '') {
  const meta = getModelMeta(modelKey);
  const label = labelOverride || meta.shortName || modelKey;
  const color = meta.color || '#64748b';
  const bg = hexToRgba(color, 0.14);
  const border = hexToRgba(color, 0.35);
  const titleHtml = titleAttr ? ` title="${escapeHtml(titleAttr)}"` : '';
  return `<span class="model-chip" style="background:${bg};border-color:${border};color:${escapeHtml(color)};"${titleHtml}><span class="model-chip-dot" style="background:${escapeHtml(color)};"></span>${escapeHtml(label)}</span>`;
}

// ---------------------------------------------------------------------------
// 全局汇总加载与渲染
// ---------------------------------------------------------------------------

async function loadGlobalStats() {
  try {
    let url = `/api/global-stats?range=${currentRange}`;
    if (currentRange === 'custom' && customStartDate && customEndDate) {
      url += `&startDate=${encodeURIComponent(customStartDate)}&endDate=${encodeURIComponent(customEndDate)}`;
    }
    const data = await callApi(url);
    cachedGlobalData = data;
    renderGlobalView(data);
  } catch (err) {
    console.error('加载全局数据失败:', err);
  }
}

function renderGlobalView(data) {
  if (!data) return;
  const s = data.summary || {};

  $('val-hit-rate').textContent = `${s.cacheHitRate || 0}%`;
  $('val-cache-read').textContent = formatNum(s.totalCacheRead);
  $('val-input').textContent = formatNum(s.totalInput);
  $('val-output').textContent = formatNum(s.totalOutput);
  $('sub-hit-rate').textContent = `总消耗: ${formatNum(s.totalTokens)} Tokens`;

  updateCostCards(s.totalInput, s.totalCacheRead, s.totalOutput, s.autoCost);

  // If activeModelFilter no longer exists in current range, reset it
  const breakdown = data.modelBreakdown || [];
  if (activeModelFilter && !breakdown.some((m) => m.modelKey === activeModelFilter)) {
    activeModelFilter = '';
  }

  renderModelBreakdown(breakdown, s.totalTokens || 0);
  renderSvgChart(data.dailyTrends || []);
  renderConversationsList(data.conversations || []);

  const modeLabel = currentPricingKey === 'auto' ? '自动按实际模型计费' : `按 ${getModelMeta(currentPricingKey).name} 折算`;
  $('footer-text').textContent =
    `已统计 ${s.conversationCount || 0} 个对话，共 ${s.totalSteps || 0} 轮 · ${modeLabel} · 1 USD = ${usdToCny.toFixed(2)} CNY`;
}

// ---------------------------------------------------------------------------
// 按模型消耗分布卡片
// ---------------------------------------------------------------------------

function renderModelBreakdown(list, totalTokens) {
  const container = $('model-breakdown-list');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="stat-label" style="text-align: center; padding: 6px;">所选时间范围内无模型调用记录</div>';
    updateActiveFilterPill();
    return;
  }

  const grandTotal = totalTokens > 0 ? totalTokens : list.reduce((acc, m) => acc + (m.total || 0), 0);

  let html = '';
  for (const m of list) {
    const sharePct = grandTotal > 0 ? ((m.total / grandTotal) * 100) : 0;
    const shareText = sharePct > 0 && sharePct < 0.1 ? '<0.1%' : `${sharePct.toFixed(1)}%`;
    const isActive = activeModelFilter === m.modelKey;

    let costText = '未计费';
    if (currentPricingKey === 'auto') {
      if (!m.isUnknown) {
        const usd = m.autoCostUsd || 0;
        const cny = usd * usdToCny;
        costText = `¥${cny.toFixed(2)} / $${usd.toFixed(2)}`;
      }
    } else {
      const c = calculateManualCost(currentPricingKey, m.input, m.cache, m.output, getLocalTodayStr(), false);
      costText = `¥${c.totalCny.toFixed(2)} / $${c.totalUsd.toFixed(2)}`;
    }

    html += `
      <div class="model-row ${isActive ? 'active' : ''}" data-model-key="${escapeHtml(m.modelKey)}" title="点击筛选包含 ${escapeHtml(m.name)} 的对话">
        <div class="model-row-top">
          <div class="model-name-wrap">
            <span class="model-dot" style="background: ${escapeHtml(m.color)};"></span>
            <span>${escapeHtml(m.name)}</span>
            <span class="text-muted" style="font-weight: normal;">${m.steps} 步 · ${shareText}</span>
          </div>
          <div class="model-meta-right">
            <span>${formatNum(m.total)}</span>
            <span>命中 ${m.hitRate}%</span>
            <span class="model-cost-text">${escapeHtml(costText)}</span>
          </div>
        </div>
        <div class="model-bar-track">
          <div class="model-bar-fill" style="width: ${Math.max(sharePct, 1).toFixed(1)}%; background: ${escapeHtml(m.color)};"></div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  updateActiveFilterPill();

  container.querySelectorAll('.model-row').forEach((row) => {
    row.addEventListener('click', () => {
      const key = row.getAttribute('data-model-key') || '';
      activeModelFilter = activeModelFilter === key ? '' : key;
      if (cachedGlobalData) {
        renderModelBreakdown(cachedGlobalData.modelBreakdown || [], cachedGlobalData.summary?.totalTokens || 0);
        renderConversationsList(cachedGlobalData.conversations || []);
      }
    });
  });
}

function updateActiveFilterPill() {
  const pill = $('active-model-filter');
  const labelEl = $('active-model-filter-label');
  if (!pill || !labelEl) return;

  if (!activeModelFilter) {
    pill.hidden = true;
    labelEl.textContent = '';
  } else {
    const meta = getModelMeta(activeModelFilter);
    labelEl.textContent = `模型: ${meta.shortName || meta.name}`;
    pill.hidden = false;
  }
}

// ---------------------------------------------------------------------------
// SVG 柱状图渲染 (修复 maxVal 漏算 output)
// ---------------------------------------------------------------------------

function renderSvgChart(trends) {
  const svg = $('svg-chart');
  if (!trends || trends.length === 0) {
    svg.setAttribute('viewBox', '0 0 500 150');
    svg.style.width = '100%';
    svg.innerHTML = '<text x="250" y="80" text-anchor="middle" fill="#94a3b8" font-size="12">所选时间范围内无数据</text>';
    return;
  }

  const count = trends.length;
  const colSpacing = count > 12 ? 56 : Math.max(60, Math.floor(500 / (count + 1)));
  const chartWidth = Math.max(500, (count + 1) * colSpacing);
  const chartHeight = 105;
  const bottomY = 125;
  const barWidth = Math.min(Math.max(colSpacing * 0.22, 10), 20);

  svg.setAttribute('viewBox', `0 0 ${chartWidth} 150`);
  svg.style.width = `${chartWidth}px`;

  // Include output in maxVal so high-output days never clip above chart top
  const maxVal = Math.max(...trends.map((t) => Math.max(t.cache || 0, t.input || 0, t.output || 0)), 1);

  let elements = `
    <line x1="10" y1="20" x2="${chartWidth - 10}" y2="20" stroke="#313244" stroke-dasharray="3,3" />
    <line x1="10" y1="${bottomY}" x2="${chartWidth - 10}" y2="${bottomY}" stroke="#313244" />
  `;

  trends.forEach((t, i) => {
    const groupX = (i + 1) * colSpacing;
    const hCache = (t.cache || 0) > 0 ? Math.max(((t.cache || 0) / maxVal) * chartHeight, 3) : 0;
    const hInput = (t.input || 0) > 0 ? Math.max(((t.input || 0) / maxVal) * chartHeight, 3) : 0;
    const hOutput = (t.output || 0) > 0 ? Math.max(((t.output || 0) / maxVal) * chartHeight, 2) : 0;

    const xCache = groupX - barWidth * 1.55;
    const xInput = groupX - barWidth * 0.5;
    const xOutput = groupX + barWidth * 0.55;

    const yCache = bottomY - hCache;
    const yInput = bottomY - hInput;
    const yOutput = bottomY - hOutput;

    let costUsd = 0;
    let allUnpriced = false;
    if (currentPricingKey === 'auto') {
      allUnpriced = (t.unpricedSteps || 0) >= (t.steps || 0) && (t.steps || 0) > 0;
      costUsd = t.autoCostUsd || 0;
    } else {
      const c = calculateManualCost(currentPricingKey, t.input, t.cache, t.output, t.date, false);
      costUsd = c.totalUsd;
    }
    const costCny = costUsd * usdToCny;
    const topCostStr = allUnpriced
      ? '—'
      : (costCny >= 100 ? `¥${Math.round(costCny)}` : `¥${costCny.toFixed(1)}`);

    const costTip = allUnpriced
      ? '当日均为早期未记录模型步骤，未自动计费'
      : `当日预估: ¥${costCny.toFixed(2)} ($${costUsd.toFixed(2)})` +
        (currentPricingKey === 'auto' && t.unpricedSteps > 0 ? ` (含 ${t.unpricedSteps} 步未记录未计)` : '');

    const labelDate = escapeHtml(t.date.slice(5));
    const minTopY = Math.min(yCache, yInput, yOutput);
    const textY = Math.max(minTopY - 6, 13);

    elements += `
      <rect x="${xCache}" y="${yCache}" width="${barWidth}" height="${hCache}" rx="3" fill="#3b82f6">
        <title>${escapeHtml(t.date)} 缓存命中: ${formatFullNum(t.cache)} Tokens\n${escapeHtml(costTip)}</title>
      </rect>
      <rect x="${xInput}" y="${yInput}" width="${barWidth}" height="${hInput}" rx="3" fill="#f59e0b">
        <title>${escapeHtml(t.date)} 未缓存输入: ${formatFullNum(t.input)} Tokens\n${escapeHtml(costTip)}</title>
      </rect>
      <rect x="${xOutput}" y="${yOutput}" width="${barWidth}" height="${hOutput}" rx="3" fill="#a855f7">
        <title>${escapeHtml(t.date)} 生成输出: ${formatFullNum(t.output)} Tokens\n${escapeHtml(costTip)}</title>
      </rect>
      <text x="${groupX}" y="${textY}" text-anchor="middle" fill="#10b981" font-size="9.5" font-weight="bold">
        ${escapeHtml(topCostStr)} (${t.hitRate}%)
      </text>
      <text x="${groupX}" y="${bottomY + 16}" text-anchor="middle" fill="#94a3b8" font-size="10.5">
        ${labelDate}
      </text>
    `;
  });

  svg.innerHTML = elements;

  requestAnimationFrame(() => {
    const wrapper = document.querySelector('.chart-wrapper');
    if (wrapper) {
      wrapper.scrollLeft = wrapper.scrollWidth;
    }
  });
}

// ---------------------------------------------------------------------------
// 会话排行榜筛选、排序与渲染
// ---------------------------------------------------------------------------

function getConversationCost(c) {
  if (currentPricingKey === 'auto') {
    const allUnpriced = (c.unpricedSteps || 0) >= (c.steps || 0) && (c.steps || 0) > 0;
    const usd = c.autoCostUsd || 0;
    return {
      usd,
      cny: usd * usdToCny,
      allUnpriced
    };
  }
  const dateStr = c.lastTime ? c.lastTime.slice(0, 10) : getLocalTodayStr();
  const manual = calculateManualCost(currentPricingKey, c.input, c.cache, c.output, dateStr, false);
  return {
    usd: manual.totalUsd,
    cny: manual.totalCny,
    allUnpriced: false
  };
}

function getFilteredSortedConversations(convs) {
  const q = searchQuery.trim().toLowerCase();
  let filtered = convs.filter((c) => {
    if (activeModelFilter) {
      const keys = c.modelKeys || [];
      if (!keys.includes(activeModelFilter)) return false;
    }
    if (q) {
      const titleHit = String(c.title || '').toLowerCase().includes(q);
      const idHit = String(c.conversationId || '').toLowerCase().includes(q);
      if (!titleHit && !idHit) return false;
    }
    return true;
  });

  filtered = filtered.slice().sort((a, b) => {
    if (currentSort === 'recent') {
      return String(b.lastTime || '').localeCompare(String(a.lastTime || ''));
    }
    if (currentSort === 'cost') {
      return getConversationCost(b).usd - getConversationCost(a).usd;
    }
    if (currentSort === 'hitRate') {
      return (b.hitRate || 0) - (a.hitRate || 0);
    }
    return (b.total || 0) - (a.total || 0);
  });

  return filtered;
}

function renderConversationsList(convs) {
  const tbody = $('conv-tbody');
  const filtered = getFilteredSortedConversations(convs || []);
  const isFiltered = Boolean(activeModelFilter || searchQuery.trim());
  $('conv-count-badge').textContent = isFiltered
    ? `${filtered.length} / ${convs.length} 个对话`
    : `${convs.length} 个对话`;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted-foreground); padding: 12px;">没有匹配的会话记录</td></tr>';
    return;
  }

  let html = '';
  for (const c of filtered) {
    const isHigh = c.hitRate >= 50;
    const tagClass = isHigh ? 'tag-high' : 'tag-low';
    const cost = getConversationCost(c);

    let timeStr = '';
    if (c.lastTime) {
      try {
        const d = new Date(c.lastTime);
        if (!Number.isNaN(d.getTime())) {
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const h = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          timeStr = `${m}-${day} ${h}:${min}`;
        }
      } catch {
        timeStr = c.lastTime.slice(5, 16);
      }
    }

    const summaryList = c.modelSummary || [];
    const shownModels = summaryList.slice(0, 2);
    const extraCount = summaryList.length - shownModels.length;
    const chipsHtml = shownModels.map((m) => renderModelChipHtml(m.modelKey, m.shortName)).join('') +
      (extraCount > 0 ? `<span class="text-muted">+${extraCount}</span>` : '');

    const costHtml = cost.allUnpriced
      ? '<span class="text-muted" style="font-weight: normal;">未记录</span>'
      : `<div>¥${cost.cny.toFixed(2)}</div><div style="font-size: 9px; color: #38bdf8; font-weight: normal;">$${cost.usd.toFixed(2)}</div>`;

    html += `
      <tr class="conv-row" data-cid="${escapeHtml(c.conversationId)}" title="点击钻取查看单步调用明细">
        <td>
          <div class="conv-title" style="color: var(--primary, #3b82f6);">${escapeHtml(c.title)}</div>
          <div class="conv-subrow">
            ${chipsHtml}
            <span>${escapeHtml(timeStr)} · ${c.steps} 步</span>
          </div>
        </td>
        <td style="color: #f59e0b;">${formatNum(c.input)}</td>
        <td style="color: #3b82f6;">${formatNum(c.cache)}</td>
        <td style="color: #a855f7;">${formatNum(c.output)}</td>
        <td><span class="badge-tag ${tagClass}">${c.hitRate}%</span></td>
        <td class="text-right cost-cell">${costHtml}</td>
      </tr>
    `;
  }

  tbody.innerHTML = html;

  tbody.querySelectorAll('.conv-row').forEach((row) => {
    row.addEventListener('click', () => {
      const cid = row.getAttribute('data-cid');
      switchToSingleMode(cid);
    });
  });
}

// ---------------------------------------------------------------------------
// 单会话明细模式
// ---------------------------------------------------------------------------

async function loadSingleStats(convId) {
  try {
    const query = convId ? `?conversationId=${encodeURIComponent(convId)}` : '';
    const data = await callApi(`/api/stats${query}`);
    cachedSingleData = data;
    renderSingleView(data);
  } catch (err) {
    console.error('加载单会话失败:', err);
  }
}

function formatModelSourceLabel(src) {
  if (src === 'step') return '日志原生字段';
  if (src === 'settings') return '设置切换记录';
  return '历史未记录';
}

function renderSingleView(data) {
  if (!data) return;
  $('single-conv-title').textContent = data.title ? `${data.title} (${data.stepCount} 步)` : '单会话步骤明细';

  const openBtn = $('btn-open-conv');
  if (openBtn) {
    const canToggle = typeof window.sidecar?.ui?.toggleConversation === 'function' && Boolean(data.conversationId);
    openBtn.hidden = !canToggle;
  }

  $('val-hit-rate').textContent = `${data.cacheHitRate || 0}%`;
  $('val-cache-read').textContent = formatNum(data.totalCacheRead);
  $('val-input').textContent = formatNum(data.totalInput);
  $('val-output').textContent = formatNum(data.totalOutput);
  $('sub-hit-rate').textContent = `本会话总用量: ${formatNum(data.totalTokens)} Tokens`;

  updateCostCards(data.totalInput, data.totalCacheRead, data.totalOutput, data.autoCost);

  // Render per-conversation model strip
  const strip = $('single-model-strip');
  if (strip) {
    const mb = data.modelBreakdown || [];
    if (mb.length > 0) {
      strip.innerHTML = mb.map((m) => {
        let costTag = '';
        if (currentPricingKey === 'auto') {
          costTag = m.isUnknown ? '未计费' : `¥${((m.autoCostUsd || 0) * usdToCny).toFixed(2)}`;
        } else {
          const c = calculateManualCost(currentPricingKey, m.input, m.cache, m.output, getLocalTodayStr(), false);
          costTag = `¥${c.totalCny.toFixed(2)}`;
        }
        return renderModelChipHtml(m.modelKey, `${m.shortName} · ${m.steps} 步 · ${costTag}`);
      }).join('');
      strip.hidden = false;
    } else {
      strip.innerHTML = '';
      strip.hidden = true;
    }
  }

  const tbody = $('steps-tbody');
  if (!data.steps || !data.steps.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--muted-foreground); padding: 12px;">暂无调用记录</td></tr>';
    return;
  }

  let rowsHtml = '';
  for (const s of data.steps) {
    const isHigh = s.hitRate >= 50;
    const tagClass = isHigh ? 'tag-high' : 'tag-low';

    let costCellHtml = '';
    if (currentPricingKey === 'auto') {
      if (!s.autoPriced) {
        costCellHtml = '<span class="text-muted" style="font-weight: normal;">—</span>';
      } else {
        const usd = s.autoCostUsd || 0;
        const cny = usd * usdToCny;
        costCellHtml = `¥${cny.toFixed(3)} <span style="font-size: 9px; color: #38bdf8; font-weight: normal;">($${usd.toFixed(3)})</span>`;
      }
    } else {
      const stepCost = calculateManualCost(currentPricingKey, s.input, s.cache, s.output, s.localDate, true);
      costCellHtml = `¥${stepCost.totalCny.toFixed(3)} <span style="font-size: 9px; color: #38bdf8; font-weight: normal;">($${stepCost.totalUsd.toFixed(3)})</span>`;
    }

    const tipText = `原始标识: ${s.rawModel || '无'} | 来源: ${formatModelSourceLabel(s.modelSource)}`;
    const modelChip = renderModelChipHtml(s.modelKey, s.modelLabel, tipText);

    rowsHtml += `
      <tr>
        <td><strong>Step ${s.step}</strong></td>
        <td>${modelChip}</td>
        <td style="color: #f59e0b;">${formatFullNum(s.input)}</td>
        <td style="color: #3b82f6;">${formatFullNum(s.cache)}</td>
        <td style="color: #a855f7;">${formatFullNum(s.output)}</td>
        <td><span class="badge-tag ${tagClass}">${s.hitRate}%</span></td>
        <td class="text-right cost-cell">${costCellHtml}</td>
      </tr>
    `;
  }
  tbody.innerHTML = rowsHtml;

  const modeLabel = currentPricingKey === 'auto' ? '自动按实际模型计费' : `按 ${getModelMeta(currentPricingKey).name} 折算`;
  $('footer-text').textContent = `当前监控会话: ${data.conversationId} · ${modeLabel} · 1 USD = ${usdToCny.toFixed(2)} CNY`;
}

function switchToGlobalMode() {
  currentMode = 'global';
  $('tab-global').classList.add('active');
  $('tab-single').classList.remove('active');
  $('view-global').hidden = false;
  $('view-single').hidden = true;
  $('filter-container').hidden = false;
  loadGlobalStats();
}

function switchToSingleMode(convId) {
  currentMode = 'single';
  activeConversationId = convId || activeConversationId;
  $('tab-single').classList.add('active');
  $('tab-global').classList.remove('active');
  $('view-global').hidden = true;
  $('view-single').hidden = false;
  $('filter-container').hidden = true;
  loadSingleStats(activeConversationId);
}

function reRenderCurrentView() {
  if (currentMode === 'global' && cachedGlobalData) {
    renderGlobalView(cachedGlobalData);
  } else if (currentMode === 'single' && cachedSingleData) {
    renderSingleView(cachedSingleData);
  }
}

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------

async function init() {
  const fxInput = $('input-fx-rate');
  if (fxInput) {
    fxInput.value = usdToCny.toFixed(2);
    fxInput.addEventListener('change', () => {
      const next = parseFloat(fxInput.value);
      if (Number.isFinite(next) && next > 0 && next <= 100) {
        usdToCny = next;
        fxInput.value = next.toFixed(2);
        safeStorageSet(STORAGE_KEYS.fxRate, next.toFixed(2));
        reRenderCurrentView();
      } else {
        fxInput.value = usdToCny.toFixed(2);
      }
    });
  }

  const sortSelect = $('select-sort');
  if (sortSelect) {
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      safeStorageSet(STORAGE_KEYS.sort, currentSort);
      if (currentMode === 'global' && cachedGlobalData) {
        renderConversationsList(cachedGlobalData.conversations || []);
      }
    });
  }

  const searchInput = $('input-search-conv');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value || '';
      if (currentMode === 'global' && cachedGlobalData) {
        renderConversationsList(cachedGlobalData.conversations || []);
      }
    });
  }

  const clearModelBtn = $('btn-clear-model-filter');
  if (clearModelBtn) {
    clearModelBtn.addEventListener('click', () => {
      activeModelFilter = '';
      if (cachedGlobalData) {
        renderModelBreakdown(cachedGlobalData.modelBreakdown || [], cachedGlobalData.summary?.totalTokens || 0);
        renderConversationsList(cachedGlobalData.conversations || []);
      }
    });
  }

  const openConvBtn = $('btn-open-conv');
  if (openConvBtn) {
    openConvBtn.addEventListener('click', () => {
      const cid = cachedSingleData?.conversationId || activeConversationId;
      if (cid && typeof window.sidecar?.ui?.toggleConversation === 'function') {
        window.sidecar.ui.toggleConversation(cid);
      }
    });
  }

  // Tab 切换
  $('tab-global').addEventListener('click', switchToGlobalMode);
  $('tab-single').addEventListener('click', () => switchToSingleMode());
  $('btn-back-global').addEventListener('click', switchToGlobalMode);

  // 计费模型标准切换
  $('select-pricing').addEventListener('change', (e) => {
    currentPricingKey = e.target.value;
    safeStorageSet(STORAGE_KEYS.pricing, currentPricingKey);
    reRenderCurrentView();
  });

  // 刷新按钮
  $('btn-refresh').addEventListener('click', () => {
    $('btn-refresh').textContent = '⏳ ...';
    const p = currentMode === 'global' ? loadGlobalStats() : loadSingleStats(activeConversationId);
    p.finally(() => { $('btn-refresh').textContent = '🔄 刷新'; });
  });

  // 时间筛选按钮
  document.querySelectorAll('.btn-filter[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-filter[data-range]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.getAttribute('data-range');

      if (currentRange === 'custom') {
        $('custom-date-box').hidden = false;
      } else {
        $('custom-date-box').hidden = true;
        loadGlobalStats();
      }
    });
  });

  // 自定义时间查询
  $('btn-apply-custom').addEventListener('click', () => {
    customStartDate = $('input-start-date').value;
    customEndDate = $('input-end-date').value;
    if (customStartDate && customEndDate) {
      loadGlobalStats();
    }
  });

  const todayStr = getLocalTodayStr();
  $('input-end-date').value = todayStr;
  $('input-start-date').value = todayStr;

  renderPricingDropdown();

  // Load latest catalog from backend & initial global stats in parallel
  const pricingPromise = callApi('/api/pricing')
    .then((payload) => {
      applyPricingPayload(payload);
      renderPricingDropdown();
    })
    .catch((err) => {
      console.warn('获取模型定价配置失败，使用内置兜底表:', err);
    });

  await Promise.all([pricingPromise, loadGlobalStats()]);
}

init();
