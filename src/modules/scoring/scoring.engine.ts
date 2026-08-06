import type { FactorScore, FinalScore } from './scoring.types.js';
import { getLogger } from '../../utils/logger.js';
import { auditService, type AuditResult } from '../auditing/auditor.js';
import { SECURITY_QUESTIONS, type QuestionCategory } from '../auditing/questions.js';

const GRADE_THRESHOLDS = {
  platinum: 85,
  gold: 70,
  silver: 55,
  bronze: 40,
} as const;

/**
 * Real-time trust scoring engine v3.0.
 * Delegates to SecurityAuditor which probes live infrastructure
 * against 20 security questions. No hardcoded scores.
 */
export async function calculateTrustScore(
  serviceId: string,
  service: {
    id: string;
    name: string;
    website?: string;
    category?: string;
  },
  _methodologyVersion: string = '3.0.0'
): Promise<FinalScore> {
  const logger = getLogger();
  logger.info({ serviceId }, 'Starting real-time security audit');

  const auditResult = await auditService(service);

  return convertAuditToFinalScore(auditResult);
}

const CATEGORY_TO_FACTOR: Record<QuestionCategory, string> = {
  http_tls: 'security',
  dns_domain: 'trackRecord',
  api_server: 'security',
  code_repo: 'openSource',
  business_compliance: 'regulatory',
  on_chain: 'protection',
};

const FACTOR_WEIGHTS: Record<string, number> = {
  security: 0.30,
  trackRecord: 0.30,
  regulatory: 0.20,
  openSource: 0.10,
  protection: 0.10,
};

function convertAuditToFinalScore(audit: AuditResult): FinalScore {
  // Build questionId → category map
  const questionCategoryMap = new Map<string, QuestionCategory>();
  for (const q of SECURITY_QUESTIONS) {
    questionCategoryMap.set(q.id, q.category);
  }

  // Group question results by factor
  const factorGroups: Record<string, { scores: number[]; confidences: number[] }> = {};

  for (const question of audit.questions) {
    const category = questionCategoryMap.get(question.questionId) || 'http_tls';
    const factorId = CATEGORY_TO_FACTOR[category] || 'security';
    if (!factorGroups[factorId]) {
      factorGroups[factorId] = { scores: [], confidences: [] };
    }
    factorGroups[factorId].scores.push(question.score);
    factorGroups[factorId].confidences.push(question.confidence);
  }

  // Build factor scores — simple average within each factor
  const factors: Record<string, FactorScore> = {};
  for (const [factorId, group] of Object.entries(factorGroups)) {
    const avgScore = Math.round(group.scores.reduce((a, b) => a + b, 0) / group.scores.length);
    const avgConfidence = Math.round(
      (group.confidences.reduce((a, b) => a + b, 0) / group.confidences.length) * 100
    ) / 100;

    factors[factorId] = {
      factorId,
      score: Math.min(100, Math.max(0, avgScore)),
      confidence: Math.min(1, Math.max(0, avgConfidence)),
      hasData: true,
      weight: FACTOR_WEIGHTS[factorId] || 0.10,
      missingFields: [],
    };
  }

  // Final score: weighted average of factors
  let weightedSum = 0;
  let totalWeight = 0;
  for (const factor of Object.values(factors)) {
    weightedSum += factor.score * factor.weight;
    totalWeight += factor.weight;
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const factorsWithData = Object.values(factors).filter(f => f.hasData).length;
  const overallConfidence =
    Object.values(factors).reduce((sum, f) => sum + f.confidence, 0) / Math.max(1, factorsWithData);

  const grade = factorsWithData < 2 ? 'unscored' : scoreToGrade(finalScore);

  return {
    score: finalScore,
    grade,
    confidence: Math.round(Math.min(1, overallConfidence) * 100) / 100,
    factors,
    dataCoverage: Math.round((factorsWithData / Math.max(1, Object.keys(factors).length)) * 100) / 100,
    methodologyVersion: audit.methodologyVersion,
    calculatedAt: audit.auditedAt,
  };
}

function scoreToGrade(score: number): FinalScore['grade'] {
  if (score >= GRADE_THRESHOLDS.platinum) return 'platinum';
  if (score >= GRADE_THRESHOLDS.gold) return 'gold';
  if (score >= GRADE_THRESHOLDS.silver) return 'silver';
  if (score >= GRADE_THRESHOLDS.bronze) return 'bronze';
  return 'unscored';
}
