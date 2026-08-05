import type { CollectorResult } from '../../aggregator.js';

interface AuditEntry {
  serviceId: string;
  hasAudit: boolean;
  auditCount: number;
  auditorName: string;
  auditorReputation: number;
  lastAuditDate: string;
  scopeCoverage: 'full' | 'partial' | 'unknown';
  [key: string]: unknown;
}

/**
 * Curated registry of known security audits.
 * This is manually maintained — honest and labeled as such.
 * No automated scraping of audit firm websites (no clean API exists).
 */
const AUDIT_REGISTRY: Record<string, AuditEntry> = {
  aave: {
    serviceId: 'aave',
    hasAudit: true,
    auditCount: 5,
    auditorName: 'OpenZeppelin, Trail of Bits, Certora',
    auditorReputation: 95,
    lastAuditDate: '2025-11-15',
    scopeCoverage: 'full',
  },
  uniswap: {
    serviceId: 'uniswap',
    hasAudit: true,
    auditCount: 4,
    auditorName: 'Trail of Bits, OpenZeppelin',
    auditorReputation: 95,
    lastAuditDate: '2025-09-20',
    scopeCoverage: 'full',
  },
  lido: {
    serviceId: 'lido',
    hasAudit: true,
    auditCount: 6,
    auditorName: 'MixBytes, Statemind, ChainSecurity',
    auditorReputation: 88,
    lastAuditDate: '2025-12-01',
    scopeCoverage: 'full',
  },
  stargate: {
    serviceId: 'stargate',
    hasAudit: true,
    auditCount: 2,
    auditorName: 'Certik',
    auditorReputation: 75,
    lastAuditDate: '2024-06-10',
    scopeCoverage: 'partial',
  },
  ledger: {
    serviceId: 'ledger',
    hasAudit: true,
    auditCount: 3,
    auditorName: 'Ledger Donjon (internal), Kudelski Security',
    auditorReputation: 85,
    lastAuditDate: '2025-08-12',
    scopeCoverage: 'full',
  },
  trezor: {
    serviceId: 'trezor',
    hasAudit: true,
    auditCount: 2,
    auditorName: 'Keyfactor, Trezor Security Lab',
    auditorReputation: 82,
    lastAuditDate: '2025-05-20',
    scopeCoverage: 'full',
  },
  bitgo: {
    serviceId: 'bitgo',
    hasAudit: true,
    auditCount: 2,
    auditorName: 'Kudelski Security',
    auditorReputation: 80,
    lastAuditDate: '2025-03-15',
    scopeCoverage: 'partial',
  },
  binance: {
    serviceId: 'binance',
    hasAudit: true,
    auditCount: 1,
    auditorName: 'Self-audit (SAFU fund)',
    auditorReputation: 40,
    lastAuditDate: '2024-01-01',
    scopeCoverage: 'unknown',
  },
  coinbase: {
    serviceId: 'coinbase',
    hasAudit: true,
    auditCount: 1,
    auditorName: 'Deloitte (SOC 2)',
    auditorReputation: 85,
    lastAuditDate: '2025-06-30',
    scopeCoverage: 'partial',
  },
  compound: {
    serviceId: 'compound',
    hasAudit: true,
    auditCount: 4,
    auditorName: 'OpenZeppelin, Trail of Bits, Certora',
    auditorReputation: 92,
    lastAuditDate: '2025-10-01',
    scopeCoverage: 'full',
  },
  makerdao: {
    serviceId: 'makerdao',
    hasAudit: true,
    auditCount: 6,
    auditorName: 'Runtime Verification, ChainSecurity, Peckshield',
    auditorReputation: 90,
    lastAuditDate: '2025-11-01',
    scopeCoverage: 'full',
  },
  fireblocks: {
    serviceId: 'fireblocks',
    hasAudit: true,
    auditCount: 2,
    auditorName: 'Kudelski Security, Fireblocks Security Lab',
    auditorReputation: 85,
    lastAuditDate: '2025-07-15',
    scopeCoverage: 'full',
  },
  metamask: {
    serviceId: 'metamask',
    hasAudit: true,
    auditCount: 3,
    auditorName: 'Consensys Diligence, Trail of Bits',
    auditorReputation: 88,
    lastAuditDate: '2025-09-01',
    scopeCoverage: 'full',
  },
  phantom: {
    serviceId: 'phantom',
    hasAudit: true,
    auditCount: 2,
    auditorName: 'Neodyme, OtterSec',
    auditorReputation: 78,
    lastAuditDate: '2025-04-10',
    scopeCoverage: 'partial',
  },
};

export function getAuditRegistry(serviceId: string): CollectorResult | null {
  const entry = AUDIT_REGISTRY[serviceId];
  if (!entry) return null;

  return {
    source: 'audit_registry',
    dataType: 'security_audit',
    data: entry,
    confidence: 0.75,
    collectedAt: new Date(),
  };
}

export function getAllAuditEntries(): Record<string, AuditEntry> {
  return { ...AUDIT_REGISTRY };
}
