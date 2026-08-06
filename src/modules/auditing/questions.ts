export type QuestionCategory =
  | 'http_tls'
  | 'dns_domain'
  | 'api_server'
  | 'code_repo'
  | 'business_compliance'
  | 'on_chain';

export type ServiceCategory =
  | 'exchange'
  | 'defi'
  | 'wallet'
  | 'custodian'
  | 'hardware_wallet'
  | 'bridge'
  | 'lending'
  | 'staking'
  | 'payment'
  | 'mixer'
  | 'nft_marketplace'
  | 'other';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  weight: number;
  severity: Severity;
  probeType: string;
  applicableTo: ServiceCategory[]; // which service categories this question applies to
}

// ── Questions: each applies to specific service categories ────
export const SECURITY_QUESTIONS: SecurityQuestion[] = [
  // HTTP/TLS — applies to ALL services with a website
  {
    id: 'https_valid_tls',
    category: 'http_tls',
    question: 'Does the site use HTTPS with a valid TLS certificate?',
    weight: 0.08,
    severity: 'critical',
    probeType: 'http',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'hsts_enabled',
    category: 'http_tls',
    question: 'Is HTTP Strict Transport Security (HSTS) enabled?',
    weight: 0.05,
    severity: 'high',
    probeType: 'http',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'content_security_policy',
    category: 'http_tls',
    question: 'Does the site set a Content-Security-Policy header?',
    weight: 0.04,
    severity: 'medium',
    probeType: 'http',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'x_frame_options',
    category: 'http_tls',
    question: 'Is X-Frame-Options set to prevent clickjacking?',
    weight: 0.03,
    severity: 'medium',
    probeType: 'http',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'secure_cookie_flags',
    category: 'http_tls',
    question: 'Does the site set Secure and HttpOnly flags on cookies?',
    weight: 0.03,
    severity: 'medium',
    probeType: 'http',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },

  // DNS/Domain — applies to ALL
  {
    id: 'domain_age',
    category: 'dns_domain',
    question: 'Is the domain older than 2 years?',
    weight: 0.06,
    severity: 'high',
    probeType: 'dns',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'dnssec_enabled',
    category: 'dns_domain',
    question: 'Is DNSSEC enabled for the domain?',
    weight: 0.04,
    severity: 'medium',
    probeType: 'dns',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'valid_dns_records',
    category: 'dns_domain',
    question: 'Does the domain have valid A/AAAA/MX DNS records?',
    weight: 0.03,
    severity: 'low',
    probeType: 'dns',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },

  // API/Server — applies to ALL
  {
    id: 'no_tech_leak',
    category: 'api_server',
    question: 'Does the server avoid leaking technology stack in headers?',
    weight: 0.04,
    severity: 'medium',
    probeType: 'http',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'error_handling',
    category: 'api_server',
    question: 'Does the API return proper error handling without stack traces?',
    weight: 0.04,
    severity: 'high',
    probeType: 'api',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'rate_limiting',
    category: 'api_server',
    question: 'Does the API implement rate limiting?',
    weight: 0.04,
    severity: 'medium',
    probeType: 'api',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },
  {
    id: 'cors_config',
    category: 'api_server',
    question: 'Is CORS configured securely (not allowing all origins)?',
    weight: 0.03,
    severity: 'medium',
    probeType: 'http',
    applicableTo: ['exchange', 'defi', 'wallet', 'custodian', 'hardware_wallet', 'bridge', 'lending', 'staking', 'payment', 'mixer', 'nft_marketplace', 'other'],
  },

  // Code/Repository — applies to DeFi, open-source projects only
  {
    id: 'repo_active',
    category: 'code_repo',
    question: 'Is the code repository public and actively maintained?',
    weight: 0.06,
    severity: 'high',
    probeType: 'github',
    applicableTo: ['defi', 'bridge', 'lending', 'staking', 'payment'],
  },
  {
    id: 'dependencies_current',
    category: 'code_repo',
    question: 'Are dependencies up to date with no known critical CVEs?',
    weight: 0.05,
    severity: 'critical',
    probeType: 'github',
    applicableTo: ['defi', 'bridge', 'lending', 'staking', 'payment'],
  },
  {
    id: 'bug_bounty',
    category: 'code_repo',
    question: 'Does the project have a bug bounty program?',
    weight: 0.04,
    severity: 'medium',
    probeType: 'github',
    applicableTo: ['defi', 'bridge', 'lending', 'staking', 'payment', 'exchange', 'custodian'],
  },

  // Business/Compliance — applies to exchanges, custodians, CeFi
  {
    id: 'legal_entity',
    category: 'business_compliance',
    question: 'Is the service registered as a legal entity?',
    weight: 0.06,
    severity: 'high',
    probeType: 'business',
    applicableTo: ['exchange', 'custodian', 'payment'],
  },
  {
    id: 'security_audits',
    category: 'business_compliance',
    question: 'Does the service have known third-party security audits?',
    weight: 0.07,
    severity: 'critical',
    probeType: 'business',
    applicableTo: ['exchange', 'custodian', 'hardware_wallet', 'defi', 'bridge', 'lending'],
  },
  {
    id: 'proof_of_reserves',
    category: 'business_compliance',
    question: 'Does the service publish proof of reserves (for exchanges/custodians)?',
    weight: 0.05,
    severity: 'high',
    probeType: 'business',
    applicableTo: ['exchange', 'custodian'],
  },

  // On-Chain — applies to DeFi only
  {
    id: 'contract_verified',
    category: 'on_chain',
    question: 'Are smart contracts verified on the block explorer?',
    weight: 0.05,
    severity: 'critical',
    probeType: 'on_chain',
    applicableTo: ['defi', 'bridge', 'lending', 'staking'],
  },
  {
    id: 'contract_no_critical_vulns',
    category: 'on_chain',
    question: 'Do smart contracts have no critical vulnerabilities in audits?',
    weight: 0.05,
    severity: 'critical',
    probeType: 'on_chain',
    applicableTo: ['defi', 'bridge', 'lending', 'staking'],
  },
];

/**
 * Get questions applicable to a specific service category
 */
export function getQuestionsForCategory(category: string): SecurityQuestion[] {
  return SECURITY_QUESTIONS.filter(q => q.applicableTo.includes(category as ServiceCategory));
}

export interface QuestionResult {
  questionId: string;
  passed: boolean;
  score: number; // 0-100 for this question
  confidence: number; // 0-1
  evidence: string; // what the probe found
  probeTime: number; // ms taken
  error?: string;
}

export interface AuditResult {
  serviceId: string;
  questions: QuestionResult[];
  overallScore: number;
  grade: 'platinum' | 'gold' | 'silver' | 'bronze' | 'unscored';
  confidence: number;
  categoryScores: Record<QuestionCategory, number>;
  totalProbeTime: number;
  auditedAt: Date;
  methodologyVersion: string;
}
