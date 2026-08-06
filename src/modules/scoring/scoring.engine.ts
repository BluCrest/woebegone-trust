import type { FactorScore, FactorData, FinalScore } from './scoring.types.js';
import { getLogger } from '../../utils/logger.js';

const GRADE_THRESHOLDS = {
  platinum: 85,
  gold: 70,
  silver: 55,
  bronze: 40,
} as const;

const FACTOR_WEIGHTS = {
  trackRecord: 0.30,
  security: 0.30,
  transparency: 0.20,
  protection: 0.20,
} as const;

/**
 * Simplified trust scoring engine.
 * 4 factors, each 0-100, weighted sum → final grade.
 * Missing data is treated as 50 (neutral) — not excluded.
 */
export async function calculateTrustScore(
  serviceId: string,
  factorData: FactorData,
  methodologyVersion: string = '2.0.0'
): Promise<FinalScore> {
  const logger = getLogger();
  logger.info({ serviceId, methodologyVersion }, 'Calculating trust score');

  const factorScores: FactorScore[] = [
    scoreTrackRecord(factorData),
    scoreSecurity(factorData),
    scoreTransparency(factorData),
    scoreProtection(factorData),
  ];

  return aggregateScores(factorScores, methodologyVersion);
}

// ── Factor 1: Track Record (30%) ──────────────────────────────
function scoreTrackRecord(data: FactorData): FactorScore {
  const tr = data.trackRecord;
  if (!tr) return noData('trackRecord', 0.30);

  let score = 0;
  const missing: string[] = [];

  // Years operating: 0-20 pts (2pts/year, max 20)
  score += Math.min(20, Math.round(tr.yearsOperating * 2));

  // Major incidents: 0-25 pts (0=25, 1-2=15, 3-5=5, 5+=0)
  if (tr.majorIncidents === 0) score += 25;
  else if (tr.majorIncidents <= 2) score += 15;
  else if (tr.majorIncidents <= 5) score += 5;

  // Volume handled: 0-25 pts
  if (tr.volumeHandled !== undefined) {
    if (tr.volumeHandled > 1e12) score += 25;
    else if (tr.volumeHandled > 1e11) score += 20;
    else if (tr.volumeHandled > 1e10) score += 15;
    else if (tr.volumeHandled > 1e9) score += 10;
    else score += 5;
  } else {
    missing.push('volumeHandled');
    score += 10; // neutral
  }

  // Uptime: 0-15 pts
  if (tr.uptimePercent !== undefined) {
    score += Math.round((tr.uptimePercent / 100) * 15);
  } else {
    missing.push('uptimePercent');
    score += 8;
  }

  // Community sentiment: 0-15 pts
  if (tr.communitySentiment !== undefined) {
    score += Math.round((tr.communitySentiment / 100) * 15);
  } else {
    missing.push('communitySentiment');
    score += 7;
  }

  score = clamp(score);
  const confidence = fieldConfidence(5, missing);

  return {
    factorId: 'trackRecord',
    score,
    confidence,
    hasData: true,
    weight: FACTOR_WEIGHTS.trackRecord,
    missingFields: missing,
  };
}

// ── Factor 2: Security (30%) ──────────────────────────────────
function scoreSecurity(data: FactorData): FactorScore {
  const audit = data.securityAudits;
  const os = data.openSource;
  if (!audit && !os) return noData('security', 0.30);

  let score = 0;
  const missing: string[] = [];

  // Audit: 0-40 pts
  if (audit?.hasAudit) {
    score += 20; // has audit
    if (audit.auditCount >= 3) score += 10;
    else if (audit.auditCount >= 2) score += 5;
    if (audit.auditorReputation !== undefined) {
      score += Math.round((audit.auditorReputation / 100) * 10);
    } else {
      missing.push('auditorReputation');
      score += 5;
    }
  } else {
    missing.push('hasAudit');
  }

  // Bug bounty: 0-15 pts
  if (os?.hasBugBounty) {
    score += 15;
  } else if (audit?.hasAudit) {
    score += 5; // audited but no bounty
  } else {
    missing.push('hasBugBounty');
  }

  // Open source: 0-25 pts
  if (os?.hasRepository) {
    score += 15;
    if (os.commitActivity !== undefined) {
      if (os.commitActivity > 100) score += 10;
      else if (os.commitActivity > 30) score += 7;
      else score += 3;
    } else {
      missing.push('commitActivity');
      score += 3;
    }
  } else {
    missing.push('hasRepository');
    score += 5; // not all services need to be open source
  }

  // Code quality signals: 0-20 pts
  if (os?.contributorCount !== undefined) {
    if (os.contributorCount > 100) score += 10;
    else if (os.contributorCount > 20) score += 7;
    else score += 3;
  } else {
    score += 3;
  }

  score = clamp(score);
  const confidence = fieldConfidence(6, missing);

  return {
    factorId: 'security',
    score,
    confidence,
    hasData: true,
    weight: FACTOR_WEIGHTS.security,
    missingFields: missing,
  };
}

// ── Factor 3: Transparency (20%) ──────────────────────────────
function scoreTransparency(data: FactorData): FactorScore {
  const por = data.proofOfReserves;
  const team = data.teamTransparency;
  const reg = data.regulatory;
  if (!por && !team && !reg) return noData('transparency', 0.20);

  let score = 0;
  const missing: string[] = [];

  // Proof of reserves: 0-30 pts
  if (por?.hasProof) {
    score += 20;
    if (por.verificationMethod === 'on_chain') score += 10;
    else if (por.verificationMethod === 'attestation') score += 7;
    if (por.coverageRatio !== undefined && por.coverageRatio >= 1.0) score += 5;
  } else {
    missing.push('hasProof');
  }

  // Team transparency: 0-25 pts
  if (team) {
    if (team.namedMembers > 0) score += Math.min(10, team.namedMembers * 2);
    if (team.verifiableProfiles > 0) score += Math.min(10, team.verifiableProfiles * 2);
    if (team.hasLegalEntity) score += 5;
  } else {
    missing.push('teamTransparency');
  }

  // Regulatory: 0-25 pts
  if (reg) {
    if (reg.licenseCount > 0) score += Math.min(15, reg.licenseCount * 2);
    if (reg.hasKycAml) score += 5;
    if (reg.regulatoryViolations === 0) score += 5;
    else if (reg.regulatoryViolations <= 2) score += 0;
    else score -= 5;
  } else {
    missing.push('regulatory');
  }

  // Legal transparency: 0-10 pts
  if (team?.hasLegalEntity && reg?.hasLegalTransparency) {
    score += 10;
  } else {
    score += 3;
  }

  score = clamp(score);
  const confidence = fieldConfidence(5, missing);

  return {
    factorId: 'transparency',
    score,
    confidence,
    hasData: true,
    weight: FACTOR_WEIGHTS.transparency,
    missingFields: missing,
  };
}

// ── Factor 4: Protection (20%) ────────────────────────────────
function scoreProtection(data: FactorData): FactorScore {
  const ins = data.insurance;
  const inc = data.incidentHistory;
  if (!ins && !inc) return noData('protection', 0.20);

  let score = 0;
  const missing: string[] = [];

  // Insurance: 0-40 pts
  if (ins?.hasInsurance) {
    score += 20;
    if (ins.coverageAmount !== undefined) {
      if (ins.coverageAmount > 1e9) score += 15;
      else if (ins.coverageAmount > 1e8) score += 10;
      else if (ins.coverageAmount > 1e7) score += 5;
    } else {
      missing.push('coverageAmount');
      score += 5;
    }
    if (ins.isPubliclyVerifiable) score += 5;
  } else {
    missing.push('hasInsurance');
    score += 5; // not all services need insurance
  }

  // Incident response: 0-30 pts
  if (inc) {
    if (inc.totalIncidents === 0) {
      score += 25;
    } else {
      // Recovered from incidents well
      if (inc.avgResponseQuality !== undefined) {
        score += Math.round((inc.avgResponseQuality / 100) * 15);
      }
      if (inc.avgRecoveryDays !== undefined && inc.avgRecoveryDays <= 7) {
        score += 10;
      } else if (inc.avgRecoveryDays !== undefined && inc.avgRecoveryDays <= 30) {
        score += 5;
      }
    }
  } else {
    missing.push('incidentHistory');
    score += 10;
  }

  // Cold storage / withdrawal guarantees: 0-20 pts
  // (inferred from other data)
  if (ins?.hasInsurance && ins.isPubliclyVerifiable) {
    score += 15;
  } else if (ins?.hasInsurance) {
    score += 10;
  } else {
    score += 5;
  }

  score = clamp(score);
  const confidence = fieldConfidence(4, missing);

  return {
    factorId: 'protection',
    score,
    confidence,
    hasData: true,
    weight: FACTOR_WEIGHTS.protection,
    missingFields: missing,
  };
}

// ── Helpers ───────────────────────────────────────────────────
function noData(factorId: string, weight: number): FactorScore {
  return {
    factorId,
    score: 0,
    confidence: 0,
    hasData: false,
    weight,
    missingFields: ['no_data_source'],
  };
}

function clamp(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function fieldConfidence(totalFields: number, missing: string[]): number {
  return Math.min(1, (totalFields - missing.length) / totalFields);
}

function aggregateScores(factors: FactorScore[], methodologyVersion: string): FinalScore {
  let weightedSum = 0;
  let totalWeight = 0;
  const factorMap: Record<string, FactorScore> = {};

  for (const f of factors) {
    factorMap[f.factorId] = f;

    if (f.hasData) {
      weightedSum += f.score * f.weight;
      totalWeight += f.weight;
    }
  }

  // Final score: weighted average of scored factors
  const finalScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight)) : 0;

  // Confidence: how many factors actually had data
  const factorsWithData = factors.filter((f) => f.hasData).length;
  const overallConfidence = factorsWithData / factors.length;

  // Data coverage
  const dataCoverage = factorsWithData / factors.length;

  // Grade: needs at least 1 factor with data
  const grade = factorsWithData < 1 ? 'unscored' : scoreToGrade(finalScore);

  return {
    score: finalScore,
    grade,
    confidence: Math.round(overallConfidence * 100) / 100,
    factors: factorMap,
    dataCoverage: Math.round(dataCoverage * 100) / 100,
    methodologyVersion,
    calculatedAt: new Date(),
  };
}

function scoreToGrade(score: number): FinalScore['grade'] {
  if (score >= GRADE_THRESHOLDS.platinum) return 'platinum';
  if (score >= GRADE_THRESHOLDS.gold) return 'gold';
  if (score >= GRADE_THRESHOLDS.silver) return 'silver';
  if (score >= GRADE_THRESHOLDS.bronze) return 'bronze';
  return 'unscored';
}
