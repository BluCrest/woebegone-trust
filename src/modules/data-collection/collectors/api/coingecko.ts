import { getLogger } from '../../../../utils/logger.js';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

interface CoinGeckoExchange {
  id: string;
  name: string;
  trust_score: string;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  country: string;
  year_established: number;
  url: string;
}

interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number;
  total_volume: number;
  market_cap: number;
}

export async function fetchExchangeData(exchangeId: string): Promise<CoinGeckoExchange | null> {
  const logger = getLogger();

  try {
    const url = `${COINGECKO_BASE}/exchanges/${exchangeId}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      logger.warn({ exchangeId, status: res.status }, 'CoinGecko exchange fetch failed');
      return null;
    }

    return (await res.json()) as CoinGeckoExchange;
  } catch (err) {
    logger.error({ exchangeId, err }, 'CoinGecko exchange fetch error');
    return null;
  }
}

export async function fetchExchangeList(): Promise<CoinGeckoExchange[]> {
  const logger = getLogger();

  try {
    const url = `${COINGECKO_BASE}/exchanges?per_page=100&page=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return [];

    return (await res.json()) as CoinGeckoExchange[];
  } catch (err) {
    logger.error({ err }, 'CoinGecko exchange list fetch error');
    return [];
  }
}

export async function fetchTokenData(tokenId: string): Promise<CoinGeckoMarketData | null> {
  const logger = getLogger();

  try {
    const url = `${COINGECKO_BASE}/coins/${tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return null;

    const data = await res.json() as { id: string; symbol: string; name: string; market_cap_rank: number; market_data: { total_volume: { usd: number }; market_cap: { usd: number } } };

    return {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      market_cap_rank: data.market_cap_rank,
      total_volume: data.market_data?.total_volume?.usd || 0,
      market_cap: data.market_data?.market_cap?.usd || 0,
    };
  } catch (err) {
    logger.error({ tokenId, err }, 'CoinGecko token fetch error');
    return null;
  }
}
