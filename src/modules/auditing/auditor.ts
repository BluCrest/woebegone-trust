import type {
  AuditResult,
  QuestionResult,
  QuestionCategory,
  SecurityQuestion,
} from './questions.js';
import { SECURITY_QUESTIONS, getQuestionsForCategory } from './questions.js';
import { probeHttp, evaluateHttpQuestions } from './probes/http.js';
import { probeDns, evaluateDnsQuestions } from './probes/dns.js';
import { probeApi, evaluateApiQuestions } from './probes/api.js';
import { probeGithub, evaluateGithubQuestions, getGithubRepo } from './probes/github.js';
import { probeBusiness, evaluateBusinessQuestions } from './probes/business.js';
import { probeOnChain, evaluateOnChainQuestions } from './probes/on-chain.js';
import { getLogger } from '../../utils/logger.js';

export type { AuditResult } from './questions.js';

const GRADE_THRESHOLDS = {
  platinum: 85,
  gold: 70,
  silver: 55,
  bronze: 40,
} as const;

/**
 * Real-time security auditor.
 * Probes live infrastructure against security questions
 * that are relevant to the service's category.
 * No hardcoded scores — everything comes from live probes.
 */
export async function auditService(service: {
  id: string;
  name: string;
  website?: string;
  category?: string;
}): Promise<AuditResult> {
  const logger = getLogger();

  logger.info({ serviceId: service.id, category: service.category }, 'Starting real-time security audit');

  // Get questions applicable to this service's category
  const applicableQuestions = getQuestionsForCategory(service.category || 'other');
  const applicableIds = new Set(applicableQuestions.map(q => q.id));
  const allQuestions: QuestionResult[] = [];

  // Determine which probe types are needed
  const neededProbeTypes = new Set(applicableQuestions.map(q => q.probeType));

  // ── HTTP/TLS Probe ──────────────────────────────────────────
  if (neededProbeTypes.has('http') && service.website) {
    try {
      const httpResult = await probeHttp(service.website);
      const httpQuestions = evaluateHttpQuestions(httpResult)
        .filter(q => applicableIds.has(q.questionId));
      allQuestions.push(...httpQuestions);
      logger.info(
        { serviceId: service.id, https: httpResult.https, hsts: httpResult.hsts },
        'HTTP probe complete'
      );
    } catch (err) {
      logger.warn({ serviceId: service.id, err }, 'HTTP probe failed');
    }
  }

  // ── DNS Probe ─────────────────────────────────────────────
  if (neededProbeTypes.has('dns') && service.website) {
    try {
      const dnsResult = await probeDns(service.website);
      const dnsQuestions = evaluateDnsQuestions(dnsResult)
        .filter(q => applicableIds.has(q.questionId));
      allQuestions.push(...dnsQuestions);
      logger.info(
        { serviceId: service.id, domainAge: dnsResult.domainAge, dnssec: dnsResult.dnssec },
        'DNS probe complete'
      );
    } catch (err) {
      logger.warn({ serviceId: service.id, err }, 'DNS probe failed');
    }
  }

  // ── API Probe ─────────────────────────────────────────────
  if (neededProbeTypes.has('api') && service.website) {
    try {
      const apiResult = await probeApi(service.website);
      const apiQuestions = evaluateApiQuestions(apiResult)
        .filter(q => applicableIds.has(q.questionId));
      allQuestions.push(...apiQuestions);
      logger.info(
        { serviceId: service.id, rateLimit: apiResult.hasRateLimiting, errorSafe: apiResult.errorHandlingSafe },
        'API probe complete'
      );
    } catch (err) {
      logger.warn({ serviceId: service.id, err }, 'API probe failed');
    }
  }

  // ── GitHub Probe ────────────────────────────────────────────
  if (neededProbeTypes.has('github')) {
    const githubRepo = getGithubRepo(service.id);
    if (githubRepo) {
      try {
        const githubResult = await probeGithub(githubRepo);
        const githubQuestions = evaluateGithubQuestions(githubResult)
          .filter(q => applicableIds.has(q.questionId));
        allQuestions.push(...githubQuestions);
        logger.info(
          { serviceId: service.id, stars: githubResult.stars, commits90d: githubResult.commitActivity90d },
          'GitHub probe complete'
        );
      } catch (err) {
        logger.warn({ serviceId: service.id, err }, 'GitHub probe failed');
      }
    }
  }

  // ── Business Probe ──────────────────────────────────────────
  if (neededProbeTypes.has('business')) {
    try {
      const businessResult = await probeBusiness(service.id);
      const businessQuestions = evaluateBusinessQuestions(businessResult)
        .filter(q => applicableIds.has(q.questionId));
      allQuestions.push(...businessQuestions);
      logger.info(
        { serviceId: service.id, legalEntity: businessResult.hasLegalEntity, audits: businessResult.auditCount },
        'Business probe complete'
      );
    } catch (err) {
      logger.warn({ serviceId: service.id, err }, 'Business probe failed');
    }
  }

  // ── On-Chain Probe ──────────────────────────────────────────
  if (neededProbeTypes.has('on_chain')) {
    try {
      const onChainResult = await probeOnChain(service.id);
      const onChainQuestions = evaluateOnChainQuestions(onChainResult)
        .filter(q => applicableIds.has(q.questionId));
      allQuestions.push(...onChainQuestions);
      logger.info(
        { serviceId: service.id, hasContract: onChainResult.hasContract, verified: onChainResult.isVerified },
        'On-chain probe complete'
      );
    } catch (err) {
      logger.warn({ serviceId: service.id, err }, 'On-chain probe failed');
    }
  }

  // ── Calculate Final Score ───────────────────────────────────
  const result = calculateFinalScore(service.id, allQuestions);

  logger.info(
    {
      serviceId: service.id,
      score: result.overallScore,
      grade: result.grade,
      confidence: result.confidence,
      questionsAsked: applicableQuestions.length,
      questionsAnswered: allQuestions.length,
      questionsPassed: allQuestions.filter(q => q.passed).length,
      probeTime: result.totalProbeTime,
    },
    'Security audit complete'
  );

  return result;
}

function calculateFinalScore(
  serviceId: string,
  questions: QuestionResult[]
): AuditResult {
  const startTime = Date.now();

  // Map question results to their definitions
  const questionMap = new Map<string, SecurityQuestion>();
  for (const q of SECURITY_QUESTIONS) {
    questionMap.set(q.id, q);
  }

  // Weighted average of all question scores
  let weightedSum = 0;
  let totalWeight = 0;

  for (const qr of questions) {
    const question = questionMap.get(qr.questionId);
    if (!question) continue;

    weightedSum += qr.score * question.weight;
    totalWeight += question.weight;
  }

  const overallScore = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100) / 100
    : 0;

  // Category scores
  const categoryScores: Record<QuestionCategory, number> = {
    http_tls: 0,
    dns_domain: 0,
    api_server: 0,
    code_repo: 0,
    business_compliance: 0,
    on_chain: 0,
  };

  const categoryWeights: Record<QuestionCategory, number> = {
    http_tls: 0,
    dns_domain: 0,
    api_server: 0,
    code_repo: 0,
    business_compliance: 0,
    on_chain: 0,
  };

  for (const qr of questions) {
    const question = questionMap.get(qr.questionId);
    if (!question) continue;

    categoryScores[question.category] += qr.score * question.weight;
    categoryWeights[question.category] += question.weight;
  }

  for (const cat of Object.keys(categoryScores) as QuestionCategory[]) {
    if (categoryWeights[cat] > 0) {
      categoryScores[cat] = Math.round(
        (categoryScores[cat] / categoryWeights[cat]) * 100
      ) / 100;
    }
  }

  // Confidence: average of all question confidences
  const confidence =
    questions.length > 0
      ? Math.round(
          (questions.reduce((sum, q) => sum + q.confidence, 0) /
            questions.length) *
            100
        ) / 100
      : 0;

  // Grade
  const passedQuestions = questions.filter((q) => q.passed).length;
  const grade =
    passedQuestions < 2
      ? 'unscored'
      : scoreToGrade(overallScore);

  return {
    serviceId,
    questions,
    overallScore: Math.round(overallScore),
    grade,
    confidence,
    categoryScores,
    totalProbeTime: Date.now() - startTime,
    auditedAt: new Date(),
    methodologyVersion: '3.0.0',
  };
}

function scoreToGrade(score: number): AuditResult['grade'] {
  if (score >= GRADE_THRESHOLDS.platinum) return 'platinum';
  if (score >= GRADE_THRESHOLDS.gold) return 'gold';
  if (score >= GRADE_THRESHOLDS.silver) return 'silver';
  if (score >= GRADE_THRESHOLDS.bronze) return 'bronze';
  return 'unscored';
}
