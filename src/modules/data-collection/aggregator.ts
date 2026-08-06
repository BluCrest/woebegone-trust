import type { FactorData } from '../scoring/scoring.types.js';
import { fetchExchangeData } from './collectors/api/coingecko.js';
import { fetchAddressBalance, fetchContractVerification } from './collectors/on-chain/etherscan.js';
import { fetchGitHubRepo } from './collectors/api/github.js';
import { fetchProtocolTVL } from './collectors/api/defillama.js';
import { getAuditRegistry } from './collectors/curated/audit-registry.js';
import { getLogger } from '../../utils/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CollectorResult {
  source: string;
  dataType: string;
  data: Record<string, unknown>;
  confidence: number;
  collectedAt: Date;
}

const GITHUB_REPOS: Record<string, string> = {
  uniswap: 'Uniswap/v3-core',
  aave: 'aave/aave-v3-core',
  lido: 'lidofinance/lido-dao',
  metamask: 'MetaMask/metamask-extension',
  stargate: 'stargate-protocol/stargate',
  compound: 'compound-finance/compound-protocol',
  makerdao: 'makerdao/dss',
  curve: 'curvefi/curve-js',
  sushiswap: 'sushiswap/sushiswap-core',
  'trust-wallet': 'trustwallet/trust-wallet-core',
  phantom: 'phantom-app/phantom-js',
  trezor: 'trezor/trezor-firmware',
  bitgo: 'BitGo/bitgo-sdk',
};

const DEFILLAMA_SLUGS: Record<string, string> = {
  aave: 'aave',
  uniswap: 'uniswap',
  lido: 'lido',
  makerdao: 'maker',
  compound: 'compound-finance',
  stargate: 'stargate-finance',
  curve: 'curve-dex',
  sushiswap: 'sushiswap',
};

// ── Curated Data Cache ────────────────────────────────────────
let curatedCache: Record<string, Record<string, unknown>> | null = null;

function loadCuratedData(): Record<string, Record<string, unknown>> {
  if (curatedCache) return curatedCache;

  try {
    const curatedPath = join(process.cwd(), 'data', 'curated.json');
    const raw = readFileSync(curatedPath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Strip _meta key
    const { _meta, ...services } = parsed;
    curatedCache = services;
    getLogger().info({ count: Object.keys(services).length }, 'Loaded curated trust data');
    return curatedCache!;
  } catch (err) {
    getLogger().warn({ err }, 'Failed to load curated data, using live data only');
    curatedCache = {};
    return curatedCache;
  }
}

/**
 * Orchestrates data collection for a service.
 * Priority: curated.json baseline → live API enhancement.
 * Returns FactorData ready for the scoring engine.
 */
export async function collectServiceData(service: {
  id: string;
  name: string;
  website?: string;
  addresses?: Record<string, string[]>;
}): Promise<{ factorData: FactorData; rawData: CollectorResult[] }> {
  const logger = getLogger();
  const rawData: CollectorResult[] = [];
  const factorData: FactorData = {};

  // ── Step 1: Load curated baseline ────────────────────────────
  const curated = loadCuratedData();
  const curatedData = curated[service.id];

  if (curatedData) {
    logger.info({ serviceId: service.id }, 'Using curated baseline data');
    applyCuratedData(curatedData, factorData);
    rawData.push({
      source: 'curated',
      dataType: 'baseline',
      data: curatedData,
      confidence: 0.95,
      collectedAt: new Date(),
    });
  }

  // ── Step 2: Enhance with live APIs ───────────────────────────
  const promises: Promise<CollectorResult | null>[] = [];

  // CoinGecko (for exchanges — enhances trackRecord)
  if (!factorData.trackRecord?.volumeHandled) {
    promises.push(
      collectCoinGeckoData(service.name).catch(() => null)
    );
  }

  // On-chain data for Ethereum addresses
  if (service.addresses?.ethereum) {
    for (const address of service.addresses.ethereum.slice(0, 2)) {
      promises.push(collectOnChainData(address).catch(() => null));
    }
  }

  // GitHub (enhances openSource)
  const githubRepo = GITHUB_REPOS[service.id];
  if (githubRepo && !factorData.openSource?.hasRepository) {
    promises.push(collectGitHubData(githubRepo).catch(() => null));
  }

  // DeFiLlama TVL (enhances trackRecord for DeFi)
  const defillamaSlug = DEFILLAMA_SLUGS[service.id];
  if (defillamaSlug) {
    promises.push(collectDeFiLlamaData(defillamaSlug).catch(() => null));
  }

  // Audit registry (enhances securityAudits)
  const auditData = getAuditRegistry(service.id);
  if (auditData && !factorData.securityAudits?.hasAudit) {
    rawData.push(auditData);
  }

  // Run all live collectors in parallel
  const results = await Promise.allSettled(promises);
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      rawData.push(result.value);
    }
  }

  // ── Step 3: Merge live data into factorData ──────────────────
  for (const result of rawData) {
    if (result.source === 'curated') continue; // already applied
    mergeLiveData(result, factorData);
  }

  return { factorData, rawData };
}

// ── Curated Data Application ──────────────────────────────────
function applyCuratedData(curated: Record<string, unknown>, factorData: FactorData): void {
  if (curated.trackRecord) {
    factorData.trackRecord = curated.trackRecord as FactorData['trackRecord'];
  }
  if (curated.securityAudits) {
    factorData.securityAudits = curated.securityAudits as FactorData['securityAudits'];
  }
  if (curated.proofOfReserves) {
    factorData.proofOfReserves = curated.proofOfReserves as FactorData['proofOfReserves'];
  }
  if (curated.teamTransparency) {
    factorData.teamTransparency = curated.teamTransparency as FactorData['teamTransparency'];
  }
  if (curated.insurance) {
    factorData.insurance = curated.insurance as FactorData['insurance'];
  }
  if (curated.regulatory) {
    factorData.regulatory = curated.regulatory as FactorData['regulatory'];
  }
  if (curated.openSource) {
    factorData.openSource = curated.openSource as FactorData['openSource'];
  }
  if (curated.incidentHistory) {
    factorData.incidentHistory = curated.incidentHistory as FactorData['incidentHistory'];
  }
}

// ── Live Data Collectors ──────────────────────────────────────
async function collectCoinGeckoData(serviceName: string): Promise<CollectorResult | null> {
  const slug = serviceName.toLowerCase().replace(/\s+/g, '-');
  const exchange = await fetchExchangeData(slug);
  if (!exchange) return null;

  return {
    source: 'coingecko',
    dataType: 'exchange_data',
    data: {
      trustScore: exchange.trust_score,
      trustScoreRank: exchange.trust_score_rank,
      volume24hBtc: exchange.trade_volume_24h_btc,
      country: exchange.country,
      yearEstablished: exchange.year_established,
    },
    confidence: 0.7,
    collectedAt: new Date(),
  };
}

async function collectOnChainData(address: string): Promise<CollectorResult | null> {
  const [balance, verified] = await Promise.all([
    fetchAddressBalance(address),
    fetchContractVerification(address),
  ]);

  return {
    source: 'etherscan',
    dataType: 'on_chain',
    data: {
      address,
      balance: balance.balance,
      isContractVerified: verified,
    },
    confidence: 0.9,
    collectedAt: new Date(),
  };
}

async function collectGitHubData(repo: string): Promise<CollectorResult | null> {
  const ghData = await fetchGitHubRepo(repo);
  if (!ghData) return null;

  return {
    source: 'github',
    dataType: 'open_source',
    data: {
      repo,
      stars: ghData.stars,
      forks: ghData.forks,
      openIssues: ghData.openIssues,
      language: ghData.language,
      license: ghData.license,
      lastPush: ghData.lastPush,
      contributorCount: ghData.contributorCount,
      commitActivity90d: ghData.commitActivity90d,
    },
    confidence: 0.85,
    collectedAt: new Date(),
  };
}

async function collectDeFiLlamaData(protocolSlug: string): Promise<CollectorResult | null> {
  const tvlData = await fetchProtocolTVL(protocolSlug);
  if (!tvlData) return null;

  return {
    source: 'defillama',
    dataType: 'defi_tvl',
    data: {
      protocol: protocolSlug,
      tvl: tvlData.tvl,
      chains: tvlData.chains,
    },
    confidence: 0.9,
    collectedAt: new Date(),
  };
}

// ── Live Data Merge ───────────────────────────────────────────
function mergeLiveData(result: CollectorResult, factorData: FactorData): void {
  // CoinGecko: enhance trackRecord if we don't have curated data
  if (result.source === 'coingecko' && result.dataType === 'exchange_data') {
    const data = result.data as {
      yearEstablished: number;
      volume24hBtc: number;
    };

    if (!factorData.trackRecord) {
      factorData.trackRecord = {
        yearsOperating: data.yearEstablished
          ? new Date().getFullYear() - data.yearEstablished
          : 0,
        majorIncidents: 0,
        volumeHandled: (data.volume24hBtc || 0) * 60000,
      };
    } else {
      // Enhance existing curated data with live volume
      if (data.volume24hBtc) {
        const liveVolume = data.volume24hBtc * 60000;
        if (liveVolume > (factorData.trackRecord.volumeHandled || 0)) {
          factorData.trackRecord.volumeHandled = liveVolume;
        }
      }
    }
  }

  // GitHub: enhance openSource
  if (result.source === 'github' && result.dataType === 'open_source') {
    const data = result.data as {
      commitActivity90d: number;
      contributorCount: number;
      license: string | null;
    };

    if (!factorData.openSource) {
      factorData.openSource = {
        hasRepository: true,
        commitActivity: data.commitActivity90d,
        contributorCount: data.contributorCount,
        hasBugBounty: false,
      };
    } else {
      // Enhance with live data
      factorData.openSource.commitActivity = data.commitActivity90d;
      factorData.openSource.contributorCount = data.contributorCount;
    }
  }

  // DeFiLlama: enhance trackRecord with TVL
  if (result.source === 'defillama' && result.dataType === 'defi_tvl') {
    const data = result.data as { tvl: number };

    if (!factorData.trackRecord) {
      factorData.trackRecord = {
        yearsOperating: 0,
        majorIncidents: 0,
        volumeHandled: data.tvl,
      };
    } else {
      factorData.trackRecord.volumeHandled = Math.max(
        factorData.trackRecord.volumeHandled || 0,
        data.tvl
      );
    }
  }

  // Audit registry: enhance securityAudits
  if (result.source === 'audit_registry' && result.dataType === 'security_audit') {
    const data = result.data as {
      hasAudit: boolean;
      auditCount: number;
      auditorName: string;
      auditorReputation: number;
      lastAuditDate: string;
      scopeCoverage: string;
    };

    if (!factorData.securityAudits) {
      factorData.securityAudits = {
        hasAudit: data.hasAudit,
        auditCount: data.auditCount,
        auditorName: data.auditorName,
        auditorReputation: data.auditorReputation,
        lastAuditDate: data.lastAuditDate ? new Date(data.lastAuditDate) : undefined,
        scopeCoverage: data.scopeCoverage as 'full' | 'partial' | 'unknown',
      };
    }
  }
}
