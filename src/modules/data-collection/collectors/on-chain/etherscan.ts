import { getApiKeys } from '../../../../config/api-keys.js';
import { getLogger } from '../../../../utils/logger.js';

const ETHERSCAN_BASE = 'https://api.etherscan.io/api';

interface EtherscanBalance {
  address: string;
  balance: string; // wei
  tokenCount?: number;
}

interface EtherscanTokenBalance {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: number;
  balance: string;
}

export async function fetchAddressBalance(address: string): Promise<EtherscanBalance> {
  const logger = getLogger();
  const keys = getApiKeys();

  if (!keys.etherscan) {
    logger.warn('Etherscan API key not configured, skipping');
    return { address, balance: '0' };
  }

  const url = `${ETHERSCAN_BASE}?module=account&action=balance&address=${address}&tag=latest&apikey=${keys.etherscan}`;
  const res = await fetch(url);
  const data = await res.json() as { status: string; result: string };

  return {
    address,
    balance: data.status === '1' ? data.result : '0',
  };
}

export async function fetchTokenBalances(address: string): Promise<EtherscanTokenBalance[]> {
  const logger = getLogger();
  const keys = getApiKeys();

  if (!keys.etherscan) {
    logger.warn('Etherscan API key not configured, skipping token balances');
    return [];
  }

  const url = `${ETHERSCAN_BASE}?module=account&action=tokentx&address=${address}&page=1&offset=100&sort=desc&apikey=${keys.etherscan}`;
  const res = await fetch(url);
  const data = await res.json() as { status: string; result: Array<{
    contractAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimal: string;
    value: string;
  }> };

  if (data.status !== '1') return [];

  // Deduplicate by contract address, sum balances
  const tokenMap = new Map<string, EtherscanTokenBalance>();
  for (const tx of data.result) {
    const existing = tokenMap.get(tx.contractAddress);
    if (!existing) {
      tokenMap.set(tx.contractAddress, {
        contractAddress: tx.contractAddress,
        tokenName: tx.tokenName,
        tokenSymbol: tx.tokenSymbol,
        tokenDecimal: parseInt(tx.tokenDecimal),
        balance: tx.value,
      });
    }
  }

  return Array.from(tokenMap.values());
}

export async function fetchContractVerification(address: string): Promise<boolean> {
  const keys = getApiKeys();

  if (!keys.etherscan) return false;

  const url = `${ETHERSCAN_BASE}?module=contract&action=getabi&address=${address}&apikey=${keys.etherscan}`;
  const res = await fetch(url);
  const data = await res.json() as { status: string; message: string };

  return data.status === '1';
}
