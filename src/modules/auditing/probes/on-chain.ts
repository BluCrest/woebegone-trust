import type { QuestionResult } from '../questions.js';
import { SECURITY_QUESTIONS } from '../questions.js';

export interface OnChainProbeResult {
  serviceId: string;
  hasContract: boolean;
  isVerified: boolean;
  chain: string | null;
  contractAddress: string | null;
  hasCriticalVulns: boolean;
  auditStatus: string;
  responseTime: number;
}

// On-chain data for known services
const ONCHAIN_DB: Record<string, Partial<OnChainProbeResult>> = {
  uniswap: {
    hasContract: true,
    isVerified: true,
    chain: 'ethereum',
    contractAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    hasCriticalVulns: false,
    auditStatus: 'audited',
  },
  aave: {
    hasContract: true,
    isVerified: true,
    chain: 'ethereum',
    contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    hasCriticalVulns: false,
    auditStatus: 'audited',
  },
  makerdao: {
    hasContract: true,
    isVerified: true,
    chain: 'ethereum',
    contractAddress: '0x9759A6Ac9097729102677f2c7124C2744a243f24',
    hasCriticalVulns: false,
    auditStatus: 'audited',
  },
  compound: {
    hasContract: true,
    isVerified: true,
    chain: 'ethereum',
    contractAddress: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
    hasCriticalVulns: false,
    auditStatus: 'audited',
  },
  lido: {
    hasContract: true,
    isVerified: true,
    chain: 'ethereum',
    contractAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7f8F9',
    hasCriticalVulns: false,
    auditStatus: 'audited',
  },
  curve: {
    hasContract: true,
    isVerified: true,
    chain: 'ethereum',
    contractAddress: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    hasCriticalVulns: false,
    auditStatus: 'audited',
  },
  sushiswap: {
    hasContract: true,
    isVerified: true,
    chain: 'ethereum',
    contractAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    hasCriticalVulns: false,
    auditStatus: 'audited',
  },
  stargate: {
    hasContract: true,
    isVerified: true,
    chain: 'ethereum',
    contractAddress: '0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6',
    hasCriticalVulns: false,
    auditStatus: 'audited',
  },
};

export async function probeOnChain(serviceId: string): Promise<OnChainProbeResult> {
  const startTime = Date.now();
  const data = ONCHAIN_DB[serviceId] || {};

  const result: OnChainProbeResult = {
    serviceId,
    hasContract: data.hasContract ?? false,
    isVerified: data.isVerified ?? false,
    chain: data.chain ?? null,
    contractAddress: data.contractAddress ?? null,
    hasCriticalVulns: data.hasCriticalVulns ?? false,
    auditStatus: data.auditStatus ?? 'unknown',
    responseTime: Date.now() - startTime,
  };

  // If we have a contract address, try to verify via Etherscan-like API
  if (result.contractAddress && result.chain === 'ethereum') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      // Use Etherscan API (free tier, no key needed for basic checks)
      const res = await fetch(
        `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${result.contractAddress}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json() as {
          status: string;
          result: Array<{ SourceCode: string; ABI: string; ContractName: string }>;
        };

        if (data.status === '1' && data.result?.[0]?.SourceCode) {
          result.isVerified = true;
          result.auditStatus = 'verified';
        }
      }
    } catch {
      // Etherscan API failed — use cached data
    }
  }

  return result;
}

export function evaluateOnChainQuestions(result: OnChainProbeResult): QuestionResult[] {
  const questions = SECURITY_QUESTIONS.filter(q => q.probeType === 'on_chain');

  return questions.map(q => {
    const startTime = Date.now();
    let passed = false;
    let score = 0;
    let evidence = '';

    switch (q.id) {
      case 'contract_verified':
        if (result.hasContract) {
          passed = result.isVerified;
          score = result.isVerified ? 100 : 10;
          evidence = result.isVerified
            ? `Contract verified on ${result.chain}: ${result.contractAddress}`
            : `Contract exists but NOT verified on ${result.chain}`;
        } else {
          passed = false;
          score = 50; // no contract = not applicable
          evidence = 'No smart contract (not a DeFi protocol)';
        }
        break;

      case 'contract_no_critical_vulns':
        if (result.hasContract) {
          passed = !result.hasCriticalVulns;
          score = result.hasCriticalVulns ? 0 : 100;
          evidence = result.hasCriticalVulns
            ? 'Critical vulnerabilities found in audits'
            : `Audit status: ${result.auditStatus}`;
        } else {
          passed = false;
          score = 50; // not applicable
          evidence = 'No smart contract (not a DeFi protocol)';
        }
        break;
    }

    return {
      questionId: q.id,
      passed,
      score,
      confidence: result.responseTime > 0 ? 0.75 : 0.2,
      evidence,
      probeTime: Date.now() - startTime,
    };
  });
}
