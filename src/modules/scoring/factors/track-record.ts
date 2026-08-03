import type { FactorCalculator, FactorScore } from '../scoring.types.js';

export const trackRecordCalculator: FactorCalculator = {
  factorId: 'trackRecord',

  async calculate(_serviceId: string, data): Promise<FactorScore> {
    const trData = data.trackRecord;

    if (!trData) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0,
        hasData: false,
        weight: 0.15,
        missingFields: ['trackRecord'],
      };
    }

    let score = 0;
    const missingFields: string[] = [];

    // Years of operation (0-20): capped at 10 years
    score += Math.min(20, Math.round(trData.yearsOperating * 2));

    // Uptime percentage (0-25)
    if (trData.uptimePercent !== undefined) {
      score += Math.round((trData.uptimePercent / 100) * 25);
    } else {
      missingFields.push('uptimePercent');
      score += 10;
    }

    // Volume handled (0-15)
    if (trData.volumeHandled !== undefined) {
      if (trData.volumeHandled > 1_000_000_000_000) score += 15; // >$1T
      else if (trData.volumeHandled > 100_000_000_000) score += 12; // >$100B
      else if (trData.volumeHandled > 10_000_000_000) score += 9; // >$10B
      else if (trData.volumeHandled > 1_000_000_000) score += 6; // >$1B
      else score += 3;
    } else {
      missingFields.push('volumeHandled');
      score += 5;
    }

    // No major incidents (0-25)
    if (trData.majorIncidents === 0) {
      score += 25;
    } else if (trData.majorIncidents <= 2) {
      score += 15;
    } else if (trData.majorIncidents <= 5) {
      score += 5;
    } else {
      score += 0;
    }

    // Community reputation (0-15)
    if (trData.communitySentiment !== undefined) {
      score += Math.round((trData.communitySentiment / 100) * 15);
    } else {
      missingFields.push('communitySentiment');
      score += 7;
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
