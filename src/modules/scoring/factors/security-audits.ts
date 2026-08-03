import type { FactorCalculator, FactorScore, FactorData } from '../scoring.types.js';

export const securityAuditsCalculator: FactorCalculator = {
  factorId: 'securityAudits',

  async calculate(_serviceId: string, data): Promise<FactorScore> {
    const auditData = data.securityAudits;

    if (!auditData || !auditData.hasAudit) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: auditData ? 0.3 : 0,
        hasData: false,
        weight: 0.20,
        missingFields: ['hasAudit'],
      };
    }

    let score = 0;
    const missingFields: string[] = [];

    // Has any audit: +30 points
    score += 30;

    // Audit recency (0-25): 25 minus (months since last audit * 2), min 0
    if (auditData.lastAuditDate) {
      const monthsSince = getMonthsSince(auditData.lastAuditDate);
      score += Math.max(0, 25 - monthsSince * 2);
    } else {
      missingFields.push('lastAuditDate');
      score += 10; // neutral middle ground
    }

    // Auditor reputation (0-25)
    if (auditData.auditorReputation !== undefined) {
      score += Math.round(auditData.auditorReputation * 0.25);
    } else {
      missingFields.push('auditorReputation');
      score += 10;
    }

    // Audit scope (0-10)
    if (auditData.scopeCoverage === 'full') {
      score += 10;
    } else if (auditData.scopeCoverage === 'partial') {
      score += 5;
    } else {
      missingFields.push('scopeCoverage');
      score += 3;
    }

    // Multiple audits bonus
    if (auditData.auditCount >= 3) {
      score += 10;
    } else if (auditData.auditCount >= 2) {
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    const confidence = calculateConfidence(data, 'securityAudits', missingFields);

    return {
      factorId: this.factorId,
      score,
      confidence,
      hasData: true,
      weight: 0.20,
      missingFields,
    };
  },
};

function getMonthsSince(date: Date): number {
  const now = new Date();
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

function calculateConfidence(data: FactorData, _factorId: string, missingFields: string[]): number {
  const totalPossibleFields = 5;
  const providedFields = totalPossibleFields - missingFields.length;
  const baseConfidence = providedFields / totalPossibleFields;

  // Boost if we have data from multiple sources
  const hasSourceData = Object.values(data).filter((v) => v !== undefined && v !== null).length;
  const sourceBoost = Math.min(0.1, hasSourceData * 0.02);

  return Math.min(1, baseConfidence + sourceBoost);
}
