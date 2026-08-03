import { getDb } from '../src/config/database.js';
import { services } from '../src/db/schema/services.js';
import { serviceScores } from '../src/db/schema/scores.js';

const SEED_SERVICES = [
  {
    id: 'binance',
    name: 'Binance',
    slug: 'binance',
    category: 'exchange',
    website: 'https://binance.com',
    description: 'World\'s largest cryptocurrency exchange by trading volume',
    foundedYear: 2017,
    headquarters: 'Cayman Islands',
    legalEntity: 'Binance Holdings Ltd',
    tags: ['cex', 'global', 'derivatives'],
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    slug: 'coinbase',
    category: 'exchange',
    website: 'https://coinbase.com',
    description: 'US-based regulated cryptocurrency exchange',
    foundedYear: 2012,
    headquarters: 'San Francisco, USA',
    legalEntity: 'Coinbase Global Inc',
    tags: ['cex', 'regulated', 'public-company'],
  },
  {
    id: 'kraken',
    name: 'Kraken',
    slug: 'kraken',
    category: 'exchange',
    website: 'https://kraken.com',
    description: 'Cryptocurrency exchange with advanced trading features',
    foundedYear: 2011,
    headquarters: 'San Francisco, USA',
    legalEntity: 'Payward Inc',
    tags: ['cex', 'regulated', 'derivatives'],
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    slug: 'metamask',
    category: 'wallet',
    website: 'https://metamask.io',
    description: 'Leading self-custody crypto wallet',
    foundedYear: 2016,
    legalEntity: 'Consensys AG',
    tags: ['wallet', 'web3', 'defi'],
  },
  {
    id: 'ledger',
    name: 'Ledger',
    slug: 'ledger',
    category: 'hardware_wallet',
    website: 'https://ledger.com',
    description: 'Hardware wallet manufacturer for secure crypto storage',
    foundedYear: 2014,
    headquarters: 'Paris, France',
    legalEntity: 'Ledger SAS',
    tags: ['hardware', 'security', 'self-custody'],
  },
  {
    id: 'lido',
    name: 'Lido',
    slug: 'lido',
    category: 'defi',
    website: 'https://lido.fi',
    description: 'Liquid staking protocol for Ethereum',
    foundedYear: 2020,
    tags: ['defi', 'staking', 'ethereum'],
  },
  {
    id: 'aave',
    name: 'Aave',
    slug: 'aave',
    category: 'defi',
    website: 'https://aave.com',
    description: 'Open source decentralized lending protocol',
    foundedYear: 2020,
    tags: ['defi', 'lending', 'governance'],
  },
  {
    id: 'uniswap',
    name: 'Uniswap',
    slug: 'uniswap',
    category: 'defi',
    website: 'https://uniswap.org',
    description: 'Decentralized exchange protocol on Ethereum',
    foundedYear: 2018,
    tags: ['defi', 'dex', 'ethereum'],
  },
  {
    id: 'bridge-stargate',
    name: 'Stargate',
    slug: 'stargate',
    category: 'bridge',
    website: 'https://stargate.finance',
    description: 'Cross-chain bridge protocol',
    foundedYear: 2022,
    tags: ['bridge', 'cross-chain', 'defi'],
  },
  {
    id: 'bitgo',
    name: 'BitGo',
    slug: 'bitgo',
    category: 'custodian',
    website: 'https://bitgo.com',
    description: 'Institutional digital asset custody',
    foundedYear: 2013,
    headquarters: 'Palo Alto, USA',
    legalEntity: 'BitGo Inc',
    tags: ['custody', 'institutional', 'qualified-custodian'],
  },
];

const SEED_SCORES: Record<string, { score: number; grade: string; confidence: number }> = {
  binance: { score: 72, grade: 'silver', confidence: 0.85 },
  coinbase: { score: 81, grade: 'gold', confidence: 0.92 },
  kraken: { score: 79, grade: 'gold', confidence: 0.88 },
  metamask: { score: 68, grade: 'silver', confidence: 0.75 },
  ledger: { score: 74, grade: 'silver', confidence: 0.82 },
  lido: { score: 65, grade: 'silver', confidence: 0.70 },
  aave: { score: 71, grade: 'silver', confidence: 0.72 },
  uniswap: { score: 70, grade: 'silver', confidence: 0.71 },
  'bridge-stargate': { score: 45, grade: 'bronze', confidence: 0.45 },
  bitgo: { score: 76, grade: 'gold', confidence: 0.80 },
};

async function seed() {
  console.log('Seeding database...');

  const db = getDb();

  // Insert services
  for (const service of SEED_SERVICES) {
    await db
      .insert(services)
      .values({
        ...service,
        isActive: true,
        isUnderReview: false,
      })
      .onConflictDoNothing();
  }

  console.log(`Inserted ${SEED_SERVICES.length} services`);

  // Insert scores
  for (const [serviceId, score] of Object.entries(SEED_SCORES)) {
    await db
      .insert(serviceScores)
      .values({
        serviceId,
        overallScore: score.score,
        grade: score.grade,
        confidence: score.confidence,
        methodologyVersion: '1.0.0',
      })
      .onConflictDoNothing();
  }

  console.log(`Inserted ${Object.keys(SEED_SCORES).length} scores`);
  console.log('Seed complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
