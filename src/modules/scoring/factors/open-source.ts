import type { FactorCalculator, FactorScore } from '../scoring.types.js';

export const openSourceCalculator: FactorCalculator = {
  factorId: 'openSource',

  async calculate(_serviceId: string, data): Promise<FactorScore> {
    const osData = data.openSource;

    if (!osData) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0,
        hasData: false,
        weight: 0.08,
        missingFields: ['openSource'],
      };
    }

    if (!osData.hasRepository) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0.3,
        hasData: false,
        weight: 0.08,
        missingFields: [],
      };
    }

    let score = 0;
    const missingFields: string[] = [];

    // Code repository exists (0-20)
    score += 20;

    // Code activity (0-20)
    if (osData.commitActivity !== undefined) {
      if (osData.commitActivity > 100) score += 20;
      else if (osData.commitActivity > 50) score += 15;
      else if (osData.commitActivity > 10) score += 10;
      else score += 5;
    } else {
      missingFields.push('commitActivity');
      score += 8;
    }

    // Code coverage/tests (0-15)
    if (osData.testCoverage !== undefined) {
      score += Math.round((osData.testCoverage / 100) * 15);
    } else {
      missingFields.push('testCoverage');
      score += 5;
    }

    // Community contributions (0-15)
    if (osData.contributorCount !== undefined) {
      if (osData.contributorCount > 50) score += 15;
      else if (osData.contributorCount > 10) score += 10;
      else if (osData.contributorCount > 3) score += 7;
      else score += 3;
    } else {
      missingFields.push('contributorCount');
      score += 5;
    }

    // Documentation quality (0-15)
    if (osData.documentationQuality !== undefined) {
      score += Math.round((osData.documentationQuality / 100) * 15);
    } else {
      missingFields.push('documentationQuality');
      score += 5;
    }

    // Bug bounty program (0-15)
    if (osData.hasBugBounty) {
      score += 15;
    } else {
      missingFields.push('hasBugBounty');
    }

    score = Math.min(100, Math.max(0, score));

    const totalFields = 6;
    const confidence = Math.min(1, (totalFields - missingFields.length) / totalFields);

    return {
      factorId: this.factorId,
      score,
      confidence,
      hasData: true,
      weight: 0.08,
      missingFields,
    };
  },
};
