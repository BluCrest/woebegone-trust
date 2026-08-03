import type { FactorCalculator, FactorScore } from '../scoring.types.js';

export const insuranceCalculator: FactorCalculator = {
  factorId: 'insurance',

  async calculate(_serviceId: string, data): Promise<FactorScore> {
    const insData = data.insurance;

    if (!insData) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0,
        hasData: false,
        weight: 0.10,
        missingFields: ['insurance'],
      };
    }

    if (!insData.hasInsurance) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0.4,
        hasData: false,
        weight: 0.10,
        missingFields: [],
      };
    }

    let score = 0;
    const missingFields: string[] = [];

    // Has insurance (0-30)
    score += 30;

    // Coverage amount relative to AUM (0-40)
    if (insData.coverageAmount !== undefined && insData.aum !== undefined && insData.aum > 0) {
      const ratio = insData.coverageAmount / insData.aum;
      score += Math.min(40, Math.round(ratio * 40));
    } else {
      missingFields.push('coverageAmount', 'aum');
      score += 15;
    }

    // Insurer reputation (0-15)
    if (insData.insurerReputation !== undefined) {
      score += Math.round((insData.insurerReputation / 100) * 15);
    } else {
      missingFields.push('insurerReputation');
      score += 5;
    }

    // Publicly verifiable (0-15)
    if (insData.isPubliclyVerifiable) {
      score += 15;
    } else {
      missingFields.push('isPubliclyVerifiable');
    }

    score = Math.min(100, Math.max(0, score));

    const totalFields = 4;
    const confidence = Math.min(1, (totalFields - missingFields.length) / totalFields);

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
