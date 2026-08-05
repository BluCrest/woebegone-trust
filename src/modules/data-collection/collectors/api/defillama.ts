import { getLogger } from '../../../../utils/logger.js';

const DEFILLAMA_BASE = 'https://api.llama.fi';

interface DeFiLlamaProtocol {
  name: string;
  slug: string;
  category: string;
  tvl: number;
  chain: string;
  chains: string[];
  description: string;
  url: string;
  audits: string;
  audit_links: string[];
  governance: string;
  listedAt: number;
}

interface DeFiLlamaPool {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
}

export async function fetchProtocolTVL(protocolSlug: string): Promise<{ tvl: number; chains: string[] } | null> {
  const logger = getLogger();

  try {
    const res = await fetch(`${DEFILLAMA_BASE}/protocol/${protocolSlug}`);
    if (!res.ok) return null;

    const data = await res.json() as DeFiLlamaProtocol;
    return {
      tvl: data.tvl || 0,
      chains: data.chains || [],
    };
  } catch (err) {
    logger.error({ protocolSlug, err }, 'DeFiLlama protocol fetch error');
    return null;
  }
}

export async function fetchTopProtocols(limit = 50): Promise<DeFiLlamaProtocol[]> {
  const logger = getLogger();

  try {
    const res = await fetch(`${DEFILLAMA_BASE}/protocols`);
    if (!res.ok) return [];

    const data = await res.json() as DeFiLlamaProtocol[];
    return data
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, limit);
  } catch (err) {
    logger.error({ err }, 'DeFiLlama protocols list fetch error');
    return [];
  }
}

export async function fetchProtocolYields(protocolSlug: string): Promise<DeFiLlamaPool[]> {
  const logger = getLogger();

  try {
    const res = await fetch(`${DEFILLAMA_BASE}/yield/pools`);
    if (!res.ok) return [];

    const data = await res.json() as { pools: DeFiLlamaPool[] };
    return (data.pools || [])
      .filter(p => p.project === protocolSlug)
      .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
      .slice(0, 10);
  } catch (err) {
    logger.error({ protocolSlug, err }, 'DeFiLlama yields fetch error');
    return [];
  }
}

export async function fetchTVLHistory(protocolSlug: string, days = 30): Promise<Array<{ date: number; tvl: number }>> {
  const logger = getLogger();

  try {
    const res = await fetch(`${DEFILLAMA_BASE}/protocol/${protocolSlug}`);
    if (!res.ok) return [];

    const data = await res.json() as { tvl: Array<{ date: number; totalLiquidityUSD: number }> };
    return (data.tvl || [])
      .slice(-days)
      .map(entry => ({
        date: entry.date,
        tvl: entry.totalLiquidityUSD || 0,
      }));
  } catch (err) {
    logger.error({ protocolSlug, err }, 'DeFiLlama TVL history fetch error');
    return [];
  }
}
