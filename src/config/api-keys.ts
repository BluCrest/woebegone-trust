import { getConfig } from './index.js';

export function getApiKeys() {
  const config = getConfig();
  return {
    etherscan: config.ETHERSCAN_API_KEY || '',
    coinGecko: config.COINGECKO_API_KEY || '',
    cerLive: config.CER_LIVE_API_KEY || '',
    infura: config.INFURA_URL || '',
    privateKey: config.PRIVATE_KEY || '',
    ipfs: config.IPFS_API_KEY || '',
  };
}
