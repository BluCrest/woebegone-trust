// Scoring types

export interface FactorScore {
  factorId: string;
  score: number; // 0-100
  confidence: number; // 0-1
  hasData: boolean;
  weight: number;
  missingFields: string[];
}

export interface FinalScore {
  score: number;
  grade: 'platinum' | 'gold' | 'silver' | 'bronze' | 'unscored';
  confidence: number;
  factors: Record<string, FactorScore>;
  dataCoverage: number;
  methodologyVersion: string;
  calculatedAt: Date;
}

export interface FactorCalculator {
  factorId: string;
  calculate(serviceId: string, data: FactorData): Promise<FactorScore>;
}

export interface FactorData {
  securityAudits?: AuditData;
  proofOfReserves?: ProofOfReservesData;
  trackRecord?: TrackRecordData;
  teamTransparency?: TeamData;
  insurance?: InsuranceData;
  regulatory?: RegulatoryData;
  openSource?: OpenSourceData;
  incidentHistory?: IncidentData;
}

export interface AuditData {
  hasAudit: boolean;
  auditCount: number;
  lastAuditDate?: Date;
  auditorName?: string;
  auditorReputation?: number; // 0-100
  scopeCoverage?: 'full' | 'partial' | 'unknown';
  findings?: { severity: string; count: number }[];
}

export interface ProofOfReservesData {
  hasProof: boolean;
  verificationMethod?: 'on_chain' | 'attestation' | 'none';
  coverageRatio?: number; // 0-1
  lastProofDate?: Date;
  liabilitiesScope?: 'all' | 'partial' | 'unknown';
}

export interface TrackRecordData {
  yearsOperating: number;
  uptimePercent?: number;
  volumeHandled?: number; // USD
  majorIncidents: number;
  communitySentiment?: number; // 0-100
}

export interface TeamData {
  namedMembers: number;
  verifiableProfiles: number;
  publicCommunications: number;
  hasLegalEntity: boolean;
  teamTrackRecord?: number; // 0-100
}

export interface InsuranceData {
  hasInsurance: boolean;
  coverageAmount?: number;
  aum?: number; // assets under management
  insurerReputation?: number; // 0-100
  isPubliclyVerifiable: boolean;
}

export interface RegulatoryData {
  licenseCount: number;
  hasKycAml: boolean;
  regulatoryViolations: number;
  jurisdictionQuality?: number; // 0-100
  hasLegalTransparency: boolean;
}

export interface OpenSourceData {
  hasRepository: boolean;
  commitActivity?: number; // commits in last 90 days
  testCoverage?: number; // 0-100
  contributorCount?: number;
  documentationQuality?: number; // 0-100
  hasBugBounty: boolean;
}

export interface IncidentData {
  totalIncidents: number;
  severityDistribution: { critical: number; high: number; medium: number; low: number };
  avgResponseQuality?: number; // 0-100
  avgRecoveryDays?: number;
}
