import type { FactorCalculator, FactorScore } from '../scoring.types.js';

export const teamTransparencyCalculator: FactorCalculator = {
  factorId: 'teamTransparency',

  async calculate(_serviceId: string, data): Promise<FactorScore> {
    const teamData = data.teamTransparency;

    if (!teamData) {
      return {
        factorId: this.factorId,
        score: 0,
        confidence: 0,
        hasData: false,
        weight: 0.12,
        missingFields: ['teamTransparency'],
      };
    }

    let score = 0;
    const missingFields: string[] = [];

    // Named team members (0-25)
    if (teamData.namedMembers > 0) {
      score += Math.min(25, teamData.namedMembers * 5);
    } else {
      missingFields.push('namedMembers');
    }

    // Verifiable profiles (0-20)
    if (teamData.verifiableProfiles > 0) {
      score += Math.min(20, teamData.verifiableProfiles * 4);
    } else {
      missingFields.push('verifiableProfiles');
    }

    // Public communications (0-15)
    if (teamData.publicCommunications > 0) {
      score += Math.min(15, teamData.publicCommunications * 3);
    } else {
      missingFields.push('publicCommunications');
    }

    // Company registration (0-20)
    if (teamData.hasLegalEntity) {
      score += 20;
    } else {
      missingFields.push('hasLegalEntity');
    }

    // Team track record (0-20)
    if (teamData.teamTrackRecord !== undefined) {
      score += Math.round((teamData.teamTrackRecord / 100) * 20);
    } else {
      missingFields.push('teamTrackRecord');
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    const totalFields = 5;
    const confidence = Math.min(1, (totalFields - missingFields.length) / totalFields);

    return {
      factorId: this.factorId,
      score,
      confidence,
      hasData: true,
      weight: 0.12,
      missingFields,
    };
  },
};
