const API = window.location.origin + '/v1';
let currentRoute = 'home';
let currentCategory = null;
let servicesCache = null;

// ── Router ──────────────────────────────────────────────────────
function navigate(route, params = {}) {
  currentRoute = route;
  window.history.pushState(params, '', route === 'home' ? '/' : `/${route}`);
  render();
}

window.addEventListener('popstate', (e) => {
  currentRoute = window.location.pathname === '/' ? 'home' : window.location.pathname.slice(1);
  render();
});

// ── API ─────────────────────────────────────────────────────────
async function api(path) {
  try {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API error:', err);
    return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────────
function gradeColor(grade) {
  const colors = { platinum: 'text-platinum', gold: 'text-gold', silver: 'text-silver', bronze: 'text-bronze', unscored: 'text-muted' };
  return colors[grade] || 'text-muted';
}

function gradeBg(grade) {
  const colors = { platinum: 'bg-platinum/10 border-platinum/30', gold: 'bg-gold/10 border-gold/30', silver: 'bg-silver/10 border-silver/30', bronze: 'bg-bronze/10 border-bronze/30', unscored: 'bg-muted/10 border-muted/30' };
  return colors[grade] || 'bg-muted/10';
}

function gradeLabel(grade) {
  return grade ? grade.charAt(0).toUpperCase() + grade.slice(1) : 'Unscored';
}

function categoryIcon(cat) {
  const icons = {
    exchange: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5"><path d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5"><path d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"/></svg>',
    defi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5"><path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/></svg>',
    bridge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5"><path d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>',
    custodian: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>',
    hardware_wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5"><path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>',
  };
  return icons[cat] || icons.exchange;
}

function factorName(id) {
  const names = {
    trackRecord: 'Track Record',
    security: 'Security',
    transparency: 'Transparency',
    protection: 'Protection',
  };
  return names[id] || id;
}

function factorWeight(id) {
  const weights = { trackRecord: 30, security: 30, transparency: 20, protection: 20 };
  return weights[id] || 0;
}

function factorDescription(id) {
  const desc = {
    trackRecord: 'Years operating, incident history, trading volume, uptime',
    security: 'Audits, bug bounty, open source, code quality',
    transparency: 'Proof of reserves, team identity, regulatory licenses',
    protection: 'Insurance coverage, incident response, fund safety',
  };
  return desc[id] || '';
}

let searchTimeout = null;
let searchResults = null;

// ── Score Ring SVG ──────────────────────────────────────────────
function scoreRing(score, grade, size = 120) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = { platinum: '#A78BFA', gold: '#F59E0B', silver: '#94A3B8', bronze: '#D97706', unscored: '#71717A' }[grade] || '#71717A';
  return `
    <svg width="${size}" height="${size}" class="transform -rotate-90">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#2A2A2D" stroke-width="6"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" class="score-ring"/>
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-3xl font-bold ${gradeColor(grade)}">${score}</span>
      <span class="text-xs text-muted mt-1">${gradeLabel(grade)}</span>
    </div>`;
}

// ── Loading Skeleton ────────────────────────────────────────────
function skeleton(count = 6) {
  return Array(count).fill('').map(() => `
    <div class="bg-surface rounded-xl p-4 border border-border">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-lg skeleton"></div>
        <div class="flex-1"><div class="h-4 skeleton rounded w-2/3 mb-2"></div><div class="h-3 skeleton rounded w-1/3"></div></div>
      </div>
      <div class="h-8 skeleton rounded w-16 mb-2"></div>
      <div class="h-3 skeleton rounded w-full"></div>
    </div>`).join('');
}

// ── Search ─────────────────────────────────────────────────────
async function handleSearch(query) {
  const grid = document.getElementById('services-grid');
  const count = document.getElementById('service-count');
  const title = document.getElementById('leaderboard-title');

  if (!query || query.length < 2) {
    searchResults = null;
    title.textContent = currentCategory ? `${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1).replace('_', ' ')}s` : 'All Services';
    loadServices();
    return;
  }

  title.textContent = `Search: "${query}"`;
  grid.innerHTML = skeleton(3);

  const data = await api(`/services/search?q=${encodeURIComponent(query)}`);
  if (!data?.data?.length) {
    grid.innerHTML = '<div class="col-span-full text-center text-muted py-12">No services found.</div>';
    count.textContent = '0 results';
    return;
  }

  searchResults = data.data;
  count.textContent = `${data.data.length} results`;
  renderServiceCards(data.data, grid);
}

function renderServiceCards(services, container) {
  container.innerHTML = services.map((s, i) => `
    <div onclick="navigate('service', {id: '${s.id}'})" class="bg-surface rounded-xl border border-border p-5 cursor-pointer hover:border-white/20 transition-all group fade-in" style="animation-delay: ${i * 50}ms">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-surface2 border border-border flex items-center justify-center text-muted group-hover:text-white transition-colors">
            ${categoryIcon(s.category)}
          </div>
          <div>
            <h3 class="font-semibold group-hover:text-white transition-colors">${s.name}</h3>
            <span class="text-xs text-muted capitalize">${s.category.replace('_', ' ')}</span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold ${gradeColor(s.grade)}">${s.overallScore ?? '—'}</div>
          <span class="text-xs px-2 py-0.5 rounded-full border ${gradeBg(s.grade)} ${gradeColor(s.grade)}">${gradeLabel(s.grade)}</span>
        </div>
      </div>
      <div class="w-full bg-border rounded-full h-1.5">
        <div class="h-1.5 rounded-full factor-bar ${gradeColor(s.grade).replace('text-', 'bg-')}" style="width: ${s.overallScore || 0}%"></div>
      </div>
      <div class="flex justify-between mt-3 text-xs text-muted">
        <span>Confidence: ${s.confidence ? Math.round(s.confidence * 100) + '%' : '—'}</span>
        <span class="group-hover:text-accent transition-colors">View Details →</span>
      </div>
    </div>`).join('');
}

// ── Home Page ───────────────────────────────────────────────────
async function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen">
      ${renderNav()}
      <main class="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <section class="text-center mb-8 fade-in">
          <h1 class="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
            Trust <span class="text-accent">Registry</span>
          </h1>
          <p class="text-muted text-lg max-w-2xl mx-auto mb-6">
            Open-source crypto trust scoring. No black boxes. No accounts to read. A public good.
          </p>

          <div class="max-w-xl mx-auto mb-6">
            <div class="relative">
              <input
                type="text"
                id="search-input"
                placeholder="Search services... (e.g. Binance, Uniswap, MetaMask)"
                class="w-full bg-surface border border-border rounded-xl px-5 py-3 pl-12 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
                oninput="handleSearch(this.value)"
              />
              <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </div>
          </div>

          <div class="flex justify-center gap-4 text-sm text-muted">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-green-500"></span> Live Scoring</span>
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-500"></span> 4 Trust Factors</span>
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-purple-500"></span> Open Source</span>
          </div>
        </section>

        <section class="mb-8 fade-in">
          <div class="flex flex-wrap gap-2 justify-center" id="categories"></div>
        </section>

        <section id="leaderboard" class="fade-in">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold" id="leaderboard-title">All Services</h2>
            <span class="text-sm text-muted" id="service-count"></span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="services-grid">
            ${skeleton()}
          </div>
        </section>

        <section class="mt-16 text-center fade-in">
          <div class="bg-surface rounded-xl border border-border p-8 max-w-2xl mx-auto">
            <h3 class="text-lg font-semibold mb-2">How It Works</h3>
            <p class="text-muted text-sm mb-6">Each service is scored on 4 trust dimensions. Scores are additive (0-100 each), weighted, and averaged. Curated data provides baselines; live APIs enhance over time.</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div class="text-center"><div class="text-2xl font-bold text-accent">4</div><div class="text-muted">Trust Factors</div></div>
              <div class="text-center"><div class="text-2xl font-bold text-gold">0-100</div><div class="text-muted">Score Range</div></div>
              <div class="text-center"><div class="text-2xl font-bold text-platinum">4</div><div class="text-muted">Trust Tiers</div></div>
              <div class="text-center"><div class="text-2xl font-bold text-green-500">Free</div><div class="text-muted">No Accounts</div></div>
            </div>
          </div>
        </section>
      </main>
      ${renderFooter()}
    </div>`;

  // Load categories
  const catData = await api('/categories');
  if (catData?.data) {
    const catContainer = document.getElementById('categories');
    catContainer.innerHTML = `
      <button onclick="filterCategory(null)" class="px-3 py-1.5 rounded-full text-sm border transition-all ${!currentCategory ? 'bg-white text-black border-white' : 'bg-surface border-border text-muted hover:border-white/30'}">All</button>
      ${catData.data.map(c => `
        <button onclick="filterCategory('${c.id}')" class="px-3 py-1.5 rounded-full text-sm border transition-all ${currentCategory === c.id ? 'bg-white text-black border-white' : 'bg-surface border-border text-muted hover:border-white/30'}">${c.name}</button>
      `).join('')}`;
  }

  // Load services
  loadServices();
}

async function loadServices() {
  if (searchResults) return; // don't override search results

  const params = currentCategory ? `?category=${currentCategory}&limit=50` : '?limit=50';
  const data = await api('/services' + params);
  const grid = document.getElementById('services-grid');
  const count = document.getElementById('service-count');
  const title = document.getElementById('leaderboard-title');

  if (!data?.data?.length) {
    grid.innerHTML = '<div class="col-span-full text-center text-muted py-12">No services found.</div>';
    return;
  }

  title.textContent = currentCategory ? `${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1).replace('_', ' ')}s` : 'All Services';
  count.textContent = `${data.data.length} services`;
  servicesCache = data.data;

  renderServiceCards(data.data, grid);
}

window.filterCategory = function(cat) {
  currentCategory = cat;
  searchResults = null;
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  renderHome();
};

// ── Service Detail Page ─────────────────────────────────────────
async function renderService(id) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen">
      ${renderNav()}
      <main class="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div class="mb-6">
          <button onclick="navigate('home')" class="text-sm text-muted hover:text-white transition-colors flex items-center gap-1">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7"/></svg>
            Back to Leaderboard
          </button>
        </div>
        <div id="service-detail">${skeleton(1)}</div>
      </main>
      ${renderFooter()}
    </div>`;

  const data = await api(`/services/${id}`);
  if (!data?.data) {
    document.getElementById('service-detail').innerHTML = '<div class="text-center text-muted py-12">Service not found.</div>';
    return;
  }

  const s = data.data;
  const score = s.score;
  const container = document.getElementById('service-detail');

  container.innerHTML = `
    <div class="fade-in">
      <div class="flex flex-col sm:flex-row items-start gap-6 mb-8">
        <div class="w-16 h-16 rounded-xl bg-surface2 border border-border flex items-center justify-center text-muted flex-shrink-0">
          ${categoryIcon(s.category)}
        </div>
        <div class="flex-1">
          <div class="flex items-start justify-between">
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold">${s.name}</h1>
              <div class="flex items-center gap-3 mt-2 text-sm text-muted">
                <span class="capitalize">${s.category.replace('_', ' ')}</span>
                ${s.website ? `<a href="${s.website}" target="_blank" class="text-accent hover:underline">${s.website.replace('https://', '')}</a>` : ''}
                ${s.foundedYear ? `<span>Est. ${s.foundedYear}</span>` : ''}
              </div>
            </div>
            <div class="relative flex-shrink-0">
              ${scoreRing(score?.overallScore || 0, score?.grade || 'unscored', 120)}
            </div>
          </div>
          ${s.description ? `<p class="text-muted mt-4">${s.description}</p>` : ''}
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div class="bg-surface rounded-xl border border-border p-4 text-center">
          <div class="text-2xl font-bold ${gradeColor(score?.grade)}">${score?.overallScore ?? '—'}</div>
          <div class="text-xs text-muted mt-1">Trust Score</div>
        </div>
        <div class="bg-surface rounded-xl border border-border p-4 text-center">
          <div class="text-2xl font-bold">${score?.confidence ? Math.round(score.confidence * 100) + '%' : '—'}</div>
          <div class="text-xs text-muted mt-1">Confidence</div>
        </div>
        <div class="bg-surface rounded-xl border border-border p-4 text-center">
          <div class="text-2xl font-bold ${gradeColor(score?.grade)}">${gradeLabel(score?.grade)}</div>
          <div class="text-xs text-muted mt-1">Trust Tier</div>
        </div>
        <div class="bg-surface rounded-xl border border-border p-4 text-center">
          <div class="text-2xl font-bold">${score?.dataCoverage ? Math.round(score.dataCoverage * 100) + '%' : '—'}</div>
          <div class="text-xs text-muted mt-1">Data Coverage</div>
        </div>
      </div>

      <div class="bg-surface rounded-xl border border-border p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Score Breakdown</h2>
        <div class="space-y-4" id="factors"></div>
      </div>

      ${score?.factors ? `
      <div class="bg-surface rounded-xl border border-border p-6">
        <h2 class="text-lg font-semibold mb-4">Factor Details</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" id="factor-details"></div>
      </div>` : ''}
    </div>`;

  // Render factor bars
  if (score?.factors) {
    const factorsEl = document.getElementById('factors');
    const sortedFactors = Object.entries(score.factors).sort((a, b) => (b[1].weight || 0) - (a[1].weight || 0));

    factorsEl.innerHTML = sortedFactors.map(([id, f]) => `
      <div>
        <div class="flex justify-between items-center mb-1.5">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">${factorName(id)}</span>
            <span class="text-xs text-muted">${factorWeight(id)}% weight</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold ${f.hasData ? gradeColor(score.grade) : 'text-muted'}">${f.hasData ? f.score : '—'}</span>
            <span class="text-xs text-muted">${f.hasData ? Math.round(f.confidence * 100) + '%' : 'no data'}</span>
          </div>
        </div>
        <div class="w-full bg-border rounded-full h-2">
          <div class="h-2 rounded-full factor-bar ${f.hasData ? gradeColor(score.grade).replace('text-', 'bg-') : 'bg-muted/30'}" style="width: ${f.hasData ? f.score : 0}%"></div>
        </div>
        <div class="text-xs text-muted mt-1">${factorDescription(id)}</div>
      </div>`).join('');

    // Factor details cards
    const detailsEl = document.getElementById('factor-details');
    if (detailsEl) {
      detailsEl.innerHTML = sortedFactors.map(([id, f]) => `
        <div class="bg-surface2 rounded-lg p-4 border border-border">
          <div class="flex justify-between items-center mb-2">
            <span class="font-medium text-sm">${factorName(id)}</span>
            <span class="text-xs px-2 py-0.5 rounded-full ${f.hasData ? 'bg-green-500/10 text-green-400' : 'bg-muted/10 text-muted'}">${f.hasData ? 'Scored' : 'No Data'}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-muted">Score:</span> <span class="font-semibold">${f.hasData ? f.score : '—'}</span></div>
            <div><span class="text-muted">Confidence:</span> <span class="font-semibold">${f.hasData ? Math.round(f.confidence * 100) + '%' : '—'}</span></div>
            <div><span class="text-muted">Weight:</span> <span class="font-semibold">${Math.round(f.weight * 100)}%</span></div>
            <div><span class="text-muted">Status:</span> <span class="font-semibold">${f.hasData ? 'Active' : 'Missing'}</span></div>
          </div>
          ${f.missingFields?.length ? `<div class="text-xs text-muted mt-2">Missing: ${f.missingFields.join(', ')}</div>` : ''}
        </div>`).join('');
    }
  }
}

// ── Shared Components ───────────────────────────────────────────
function renderNav() {
  return `
    <nav class="fixed top-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-border">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <a href="/" onclick="navigate('home'); return false;" class="flex items-center gap-2 font-semibold">
          <span class="text-accent">●</span> Trust Registry
        </a>
        <div class="flex items-center gap-4 text-sm text-muted">
          <a href="/v1/methodology" target="_blank" class="hover:text-white transition-colors">Methodology</a>
          <a href="https://github.com/BluCrest/woebegone-trust-registry" target="_blank" class="hover:text-white transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </a>
        </div>
      </div>
    </nav>`;
}

function renderFooter() {
  return `
    <footer class="border-t border-border mt-auto">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted">
        <div class="flex items-center gap-2">
          <span class="text-accent">●</span>
          <span>Point Woebegone Trust Registry</span>
        </div>
        <div>Open source. No accounts. A public good.</div>
      </div>
    </footer>`;
}

// ── Render Dispatcher ───────────────────────────────────────────
function render() {
  const path = window.location.pathname;
  if (path.startsWith('/service/')) {
    const id = path.split('/service/')[1];
    renderService(id);
  } else {
    currentCategory = null;
    renderHome();
  }
}

// ── Init ────────────────────────────────────────────────────────
window.navigate = navigate;
window.handleSearch = handleSearch;
render();
