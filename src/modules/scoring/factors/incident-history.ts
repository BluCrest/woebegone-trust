import type { FactorCalculator, FactorScore } from '../scoring.types.js';

export const incidentHistoryCalculator: FactorCalculator = {
  factorId: 'incidentHistory',

  async calculate(_serviceId: string, data): Promise<FactorScore> {
    const incData = data.incidentHistory;

    if (!incData) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0,
        hasData: false,
        weight: 0.10,
        missingFields: ['incidentHistory'],
      };
    }

    let score = 0;
    const missingFields: string[] = [];

    // No incidents (0-40)
    if (incData.totalIncidents === 0) {
      score += 40;
    } else {
      // Incident severity distribution (0-25)
      const { critical, high, medium, low } = incData.severityDistribution;
      const severityPenalty = critical * 15 + high * 8 + medium * 3 + low * 1;
      score += Math.max(0, 25 - severityPenalty);
    }

    // Response quality (0-20)
    if (incData.avgResponseQuality !== undefined) {
      score += Math.round((incData.avgResponseQuality / 100) * 20);
    } else if (incData.totalIncidents > 0) {
      missingFields.push('avgResponseQuality');
      score += 5;
    } else {
      score += 15; // no incidents = good response
    }

    // Recovery time (0-15)
    if (incData.avgRecoveryDays !== undefined) {
      if (incData.avgRecoveryDays <= 1) score += 15;
      else if (incData.avgRecoveryDays <= 7) score += 12;
      else if (incData.avgRecoveryDays <= 30) score += 8;
      else score += 3;
    } else if (incData.totalIncidents > 0) {
      missingFields.push('avgRecoveryDays');
      score += 5;
    } else {
      score += 10;
    }

    score = Math.min(100, Math.max(0, score));

    const totalFields = 3;
    const hasIncidents = incData.totalIncidents > 0;
    const confidence = hasIncidents ? Math.min(1, (totalFields - missingFields.length) / totalFields) : 0.3;

    return {
      factorId: this.factorId,
      score,
      confidence,
      hasData: true,
      weight: 0.10,
      missingFields,
    };
  },
};
