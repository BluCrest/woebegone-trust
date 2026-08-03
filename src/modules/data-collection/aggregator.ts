import type { FactorData } from '../scoring/scoring.types.js';
import { fetchExchangeData } from './collectors/api/coingecko.js';
import { fetchAddressBalance, fetchContractVerification } from './collectors/on-chain/etherscan.js';
import { getLogger } from '../../utils/logger.js';

export interface CollectorResult {
  source: string;
  dataType: string;
  data: Record<string, unknown>;
  confidence: number;
  collectedAt: Date;
}

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

  // Parallel collection from all sources
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
  // Try to find the exchange on CoinGecko
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

function normalizeFactorData(rawData: CollectorResult[], factorData: FactorData): void {
  for (const result of rawData) {
    if (result.source === 'coingecko' && result.dataType === 'exchange_data') {
      const data = result.data as {
        yearEstablished: number;
        trustScoreRank: number;
        volume24hBtc: number;
      };

      // Track Record
      if (!factorData.trackRecord) {
        factorData.trackRecord = {
          yearsOperating: data.yearEstablished
            ? new Date().getFullYear() - data.yearEstablished
            : 0,
          majorIncidents: 0,
          volumeHandled: (data.volume24hBtc || 0) * 60000, // rough BTC→USD
          uptimePercent: 99.9,
        };
      }
    }

    if (result.source === 'etherscan' && result.dataType === 'on_chain') {
      // On-chain data can inform multiple factors
      // For now, just store raw data — factor calculators will use it later
    }
  }
}
