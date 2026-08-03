import type { FactorCalculator, FactorData, FactorScore, FinalScore } from './scoring.types.js';
import { securityAuditsCalculator } from './factors/security-audits.js';
import { proofOfReservesCalculator } from './factors/proof-of-reserves.js';
import { trackRecordCalculator } from './factors/track-record.js';
import { teamTransparencyCalculator } from './factors/team-transparency.js';
import { insuranceCalculator } from './factors/insurance.js';
import { regulatoryCalculator } from './factors/regulatory.js';
import { openSourceCalculator } from './factors/open-source.js';
import { incidentHistoryCalculator } from './factors/incident-history.js';
import { getLogger } from '../../utils/logger.js';

const FACTOR_CALCULATORS: FactorCalculator[] = [
  securityAuditsCalculator,
  proofOfReservesCalculator,
  trackRecordCalculator,
  teamTransparencyCalculator,
  insuranceCalculator,
  regulatoryCalculator,
  openSourceCalculator,
  incidentHistoryCalculator,
];

const GRADE_THRESHOLDS = {
  platinum: 90,
  gold: 75,
  silver: 60,
  bronze: 40,
} as const;

const TOTAL_WEIGHT = 1.0;

export async function calculateTrustScore(
  serviceId: string,
  factorData: FactorData,
  methodologyVersion: string = '1.0.0'
): Promise<FinalScore> {
  const logger = getLogger();
  logger.info({ serviceId, methodologyVersion }, 'Calculating trust score');

  const factorScores: FactorScore[] = [];

  for (const calculator of FACTOR_CALCULATORS) {
    try {
      const result = await calculator.calculate(serviceId, factorData);
      factorScores.push(result);
      logger.debug(
        { factor: result.factorId, score: result.score, confidence: result.confidence },
        'Factor calculated'
      );
    } catch (err) {
      logger.error({ factor: calculator.factorId, err }, 'Factor calculation failed');
      factorScores.push({
        factorId: calculator.factorId,
        score: 0,
        confidence: 0,
        hasData: false,
        weight: 0,
        missingFields: ['calculation_error'],
      });
    }
  }

  return aggregateScores(factorScores, methodologyVersion);
}

function aggregateScores(
  factors: FactorScore[],
  methodologyVersion: string
): FinalScore {
  let weightedSum = 0;
  let totalWeight = 0;
  const factorMap: Record<string, FactorScore> = {};

  for (const factor of factors) {
    factorMap[factor.factorId] = factor;

    if (factor.hasData) {
      weightedSum += factor.score * factor.weight * factor.confidence;
      totalWeight += factor.weight * factor.confidence;
    }
  }

  const finalScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
  const overallConfidence = totalWeight > 0 ? totalWeight / TOTAL_WEIGHT : 0;
  const roundedScore = Math.round(finalScore);

  const factorsWithData = factors.filter((f) => f.hasData).length;
  const dataCoverage = factorsWithData / factors.length;
  const grade = factorsWithData < 4 ? 'unscored' : scoreToGrade(roundedScore);

  return {
    score: roundedScore,
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
