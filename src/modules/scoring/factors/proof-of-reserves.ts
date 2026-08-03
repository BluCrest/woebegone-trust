import type { FactorCalculator, FactorScore } from '../scoring.types.js';

export const proofOfReservesCalculator: FactorCalculator = {
  factorId: 'proofOfReserves',

  async calculate(_serviceId: string, data): Promise<FactorScore> {
    const porData = data.proofOfReserves;

    if (!porData) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0,
        hasData: false,
        weight: 0.15,
        missingFields: ['proofOfReserves'],
      };
    }

    if (!porData.hasProof) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0.3,
        hasData: false,
        weight: 0.15,
        missingFields: [],
      };
    }

    let score = 0;
    const missingFields: string[] = [];

    // Has any PoR: +20 points
    score += 20;

    // Verification method (0-30)
    if (porData.verificationMethod === 'on_chain') {
      score += 30;
    } else if (porData.verificationMethod === 'attestation') {
      score += 15;
    } else {
      missingFields.push('verificationMethod');
      score += 5;
    }

    // Coverage ratio (0-30)
    if (porData.coverageRatio !== undefined) {
      score += Math.round(porData.coverageRatio * 30);
    } else {
      missingFields.push('coverageRatio');
      score += 10;
    }

    // Freshness (0-10)
    if (porData.lastProofDate) {
      const daysSince = getDaysSince(porData.lastProofDate);
      score += Math.max(0, 10 - Math.floor(daysSince / 30));
    } else {
      missingFields.push('lastProofDate');
      score += 3;
    }

    // Liabilities scope (0-10)
    if (porData.liabilitiesScope === 'all') {
      score += 10;
    } else if (porData.liabilitiesScope === 'partial') {
      score += 5;
    } else {
      missingFields.push('liabilitiesScope');
      score += 2;
    }

    score = Math.min(100, Math.max(0, score));

    const totalFields = 5;
    const confidence = Math.min(1, (totalFields - missingFields.length) / totalFields);

    return {
      factorId: this.factorId,
      score,
      confidence,
      hasData: true,
      weight: 0.15,
      missingFields,
    };
  },
};

function getDaysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}
