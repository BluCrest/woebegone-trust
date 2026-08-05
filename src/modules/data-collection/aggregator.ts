import type { FactorData } from '../scoring/scoring.types.js';
import { fetchExchangeData } from './collectors/api/coingecko.js';
import { fetchAddressBalance, fetchContractVerification } from './collectors/on-chain/etherscan.js';
import { fetchGitHubRepo } from './collectors/api/github.js';
import { fetchProtocolTVL } from './collectors/api/defillama.js';
import { getAuditRegistry } from './collectors/curated/audit-registry.js';
import { getLogger } from '../../utils/logger.js';

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
};

const DEFILLAMA_SLUGS: Record<string, string> = {
  aave: 'aave',
  uniswap: 'uniswap',
  lido: 'lido',
  makerdao: 'maker',
  compound: 'compound-finance',
  stargate: 'stargate-finance',
};

/**
 * Orchestrates data collection from all sources for a service.
 * Returns normalized FactorData ready for the scoring engine.
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

  const promises: Promise<CollectorResult | null>[] = [];

  // CoinGecko exchange data
  if (service.name) {
    promises.push(
      collectCoinGeckoData(service.name).catch((err) => {
        logger.error({ serviceId: service.id, source: 'coingecko', err }, 'Collection failed');
        return null;
      })
    );
  }

  // On-chain data for Ethereum addresses
  if (service.addresses?.ethereum) {
    for (const address of service.addresses.ethereum.slice(0, 3)) {
      promises.push(
        collectOnChainData(address).catch((err) => {
          logger.error({ serviceId: service.id, address, err }, 'On-chain collection failed');
          return null;
        })
      );
    }
  }

  // GitHub open source data
  const githubRepo = GITHUB_REPOS[service.id];
  if (githubRepo) {
    promises.push(
      collectGitHubData(githubRepo).catch((err) => {
        logger.error({ serviceId: service.id, source: 'github', err }, 'GitHub collection failed');
        return null;
      })
    );
  }

  // DeFiLlama TVL data for DeFi protocols
  const defillamaSlug = DEFILLAMA_SLUGS[service.id];
  if (defillamaSlug) {
    promises.push(
      collectDeFiLlamaData(defillamaSlug).catch((err) => {
        logger.error({ serviceId: service.id, source: 'defillama', err }, 'DeFiLlama collection failed');
        return null;
      })
    );
  }

  // Curated audit registry lookup
  const auditData = getAuditRegistry(service.id);
  if (auditData) {
    rawData.push(auditData);
  }

  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      rawData.push(result.value);
    }
  }

  // Normalize collected data into FactorData
  normalizeFactorData(rawData, factorData);

  return { factorData, rawData };
}

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

function normalizeFactorData(rawData: CollectorResult[], factorData: FactorData): void {
  for (const result of rawData) {
    if (result.source === 'coingecko' && result.dataType === 'exchange_data') {
      const data = result.data as {
        yearEstablished: number;
        trustScoreRank: number;
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
      }
    }

    if (result.source === 'github' && result.dataType === 'open_source') {
      const data = result.data as {
        commitActivity90d: number;
        contributorCount: number;
        license: string | null;
      };

      factorData.openSource = {
        hasRepository: true,
        commitActivity: data.commitActivity90d,
        contributorCount: data.contributorCount,
        testCoverage: undefined,
        documentationQuality: undefined,
        hasBugBounty: false,
      };
    }

    if (result.source === 'audit_registry' && result.dataType === 'security_audit') {
      const data = result.data as {
        hasAudit: boolean;
        auditCount: number;
        auditorName: string;
        auditorReputation: number;
        lastAuditDate: string;
        scopeCoverage: string;
      };

      factorData.securityAudits = {
        hasAudit: data.hasAudit,
        auditCount: data.auditCount,
        auditorName: data.auditorName,
        auditorReputation: data.auditorReputation,
        lastAuditDate: data.lastAuditDate ? new Date(data.lastAuditDate) : undefined,
        scopeCoverage: data.scopeCoverage as 'full' | 'partial' | 'unknown',
      };
    }

    if (result.source === 'defillama' && result.dataType === 'defi_tvl') {
      const data = result.data as {
        tvl: number;
        chains: string[];
      };

      // Use TVL to enhance track record data
      if (factorData.trackRecord) {
        factorData.trackRecord.volumeHandled = Math.max(
          factorData.trackRecord.volumeHandled || 0,
          data.tvl
        );
      } else {
        factorData.trackRecord = {
          yearsOperating: 0,
          majorIncidents: 0,
          volumeHandled: data.tvl,
        };
      }
    }
  }
}
