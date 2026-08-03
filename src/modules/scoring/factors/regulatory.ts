import type { FactorCalculator, FactorScore } from '../scoring.types.js';

export const regulatoryCalculator: FactorCalculator = {
  factorId: 'regulatoryCompliance',

  async calculate(_serviceId: string, data): Promise<FactorScore> {
    const regData = data.regulatory;

    if (!regData) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0,
        hasData: false,
        weight: 0.10,
        missingFields: ['regulatory'],
      };
    }

    let score = 0;
    const missingFields: string[] = [];

    // Licenses held (0-30)
    if (regData.licenseCount > 0) {
      score += Math.min(30, regData.licenseCount * 6);
    } else {
      missingFields.push('licenseCount');
    }

    // KYC/AML implementation (0-20)
    if (regData.hasKycAml) {
      score += 20;
    } else {
      missingFields.push('hasKycAml');
    }

    // Regulatory history (0-20): no violations = full points
    if (regData.regulatoryViolations === 0) {
      score += 20;
    } else if (regData.regulatoryViolations <= 2) {
      score += 10;
    } else {
      score += 0;
    }

    // Jurisdiction quality (0-15)
    if (regData.jurisdictionQuality !== undefined) {
      score += Math.round((regData.jurisdictionQuality / 100) * 15);
    } else {
      missingFields.push('jurisdictionQuality');
      score += 5;
    }

    // Legal transparency (0-15)
    if (regData.hasLegalTransparency) {
      score += 15;
    } else {
      missingFields.push('hasLegalTransparency');
    }

    score = Math.min(100, Math.max(0, score));

    const totalFields = 5;
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
