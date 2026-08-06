import type { QuestionResult } from '../questions.js';
import { SECURITY_QUESTIONS } from '../questions.js';
import { webSearch, type SearchResult } from '../search/web-search.js';
import { getLogger } from '../../../utils/logger.js';

export interface WebSearchProbeResult {
  serviceId: string;
  serviceName: string;
  hasLegalEntity: boolean;
  legalEntityEvidence: string;
  hasSecurityAudits: boolean;
  auditEvidence: string;
  auditCount: number;
  auditorNames: string[];
  hasProofOfReserves: boolean;
  porEvidence: string;
  hasBugBounty: boolean;
  bugBountyEvidence: string;
  hasIncidents: boolean;
  incidentEvidence: string;
  teamPublic: boolean;
  teamEvidence: string;
  rawResults: SearchResult[];
  responseTime: number;
}

/**
 * Web search probe — discovers security information about a service
 * by searching the web. No hardcoded data.
 *
 * For each applicable question, it runs a targeted search query,
 * analyzes the results, and scores the question.
 */
export async function probeWebSearch(
  serviceId: string,
  serviceName: string,
  website?: string
): Promise<WebSearchProbeResult> {
  const startTime = Date.now();
  const logger = getLogger();
  const allResults: SearchResult[] = [];

  // Run all search queries in parallel
  const queries = getSearchQueries(serviceName, website);
  const searchResults = await Promise.allSettled(
    queries.map(({ query, purpose }) =>
      webSearch(query, 5).then((results) => ({ purpose, results }))
    )
  );

  // Collect all results
  for (const result of searchResults) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value.results);
    }
  }

  // Analyze search results to answer each question
  const analysis = analyzeSearchResults(serviceName, allResults);

  logger.info(
    {
      serviceId,
      legalEntity: analysis.hasLegalEntity,
      audits: analysis.hasSecurityAudits,
      auditCount: analysis.auditCount,
      proofOfReserves: analysis.hasProofOfReserves,
      bugBounty: analysis.hasBugBounty,
      incidents: analysis.hasIncidents,
      searchResults: allResults.length,
    },
    'Web search probe complete'
  );

  return {
    serviceId,
    serviceName,
    ...analysis,
    rawResults: allResults,
    responseTime: Date.now() - startTime,
  };
}

function getSearchQueries(
  serviceName: string,
  website?: string
): Array<{ query: string; purpose: string }> {
  const domain = website ? new URL(website).hostname.replace('www.', '') : '';
  const queries = [
    {
      query: `${serviceName} cryptocurrency company registration legal entity`,
      purpose: 'legal_entity',
    },
    {
      query: `${serviceName} security audit smart contract audit report`,
      purpose: 'security_audits',
    },
    {
      query: `${serviceName} proof of reserves transparency`,
      purpose: 'proof_of_reserves',
    },
    {
      query: `${serviceName} bug bounty program responsible disclosure`,
      purpose: 'bug_bounty',
    },
    {
      query: `${serviceName} security incident hack breach`,
      purpose: 'incident_history',
    },
    {
      query: `${serviceName} team founders leadership public`,
      purpose: 'team_info',
    },
  ];

  // Add domain-specific queries
  if (domain) {
    queries.push({
      query: `${domain} site security headers TLS certificate`,
      purpose: 'security_headers',
    });
  }

  return queries;
}

function analyzeSearchResults(
  serviceName: string,
  results: SearchResult[]
): Omit<WebSearchProbeResult, 'serviceId' | 'serviceName' | 'rawResults' | 'responseTime'> {
  const allText = results.map((r) => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
  const nameLower = serviceName.toLowerCase();

  // Legal entity detection
  const legalKeywords = [
    'inc', 'corp', 'llc', 'ltd', 'company', 'registered', 'incorporated',
    'headquarters', 'founded', 'established', 'legal entity', 'subsidiary',
  ];
  const hasLegalEntity =
    legalKeywords.some((kw) => allText.includes(kw)) &&
    results.some((r) => r.snippet.toLowerCase().includes(nameLower));

  const legalEntityEvidence = results
    .filter((r) => legalKeywords.some((kw) => r.snippet.toLowerCase().includes(kw)))
    .slice(0, 2)
    .map((r) => r.snippet.substring(0, 150))
    .join(' | ');

  // Security audit detection
  const auditKeywords = [
    'audit', 'audited', 'security review', 'code review', 'penetration test',
    'formal verification', 'certik', 'trail of bits', 'openzeppelin',
    'quantstamp', 'consensys', 'slowmist', 'halborn', 'certik',
  ];
  const auditResults = results.filter((r) =>
    auditKeywords.some((kw) => r.snippet.toLowerCase().includes(kw))
  );
  const hasSecurityAudits = auditResults.length > 0;

  // Count unique auditors
  const auditorNames: string[] = [];
  const auditorPatterns = [
    'trail of bits', 'openzeppelin', 'quantstamp', 'consensys', 'slowmist',
    'halborn', 'certik', 'peckshield', 'mixbytes', 'statemind', 'runtime verification',
    'kudelski', 'deloitte', 'kpmg', 'pwc', 'ernst & young',
  ];
  for (const pattern of auditorPatterns) {
    if (allText.includes(pattern) && !auditorNames.includes(pattern)) {
      auditorNames.push(pattern);
    }
  }

  const auditCount = Math.min(10, auditResults.length + auditorNames.length);

  const auditEvidence = auditResults
    .slice(0, 3)
    .map((r) => r.snippet.substring(0, 150))
    .join(' | ');

  // Proof of reserves detection
  const porKeywords = [
    'proof of reserves', 'proof-of-reserves', 'merkle tree', 'attestation',
    'reserve ratio', '1:1 backing', 'solvency', 'reserves verified',
  ];
  const hasProofOfReserves = porKeywords.some((kw) => allText.includes(kw));

  const porEvidence = results
    .filter((r) => porKeywords.some((kw) => r.snippet.toLowerCase().includes(kw)))
    .slice(0, 2)
    .map((r) => r.snippet.substring(0, 150))
    .join(' | ');

  // Bug bounty detection
  const bountyKeywords = [
    'bug bounty', 'bugbounty', 'responsible disclosure', 'security bounty',
    'hackerone', 'immunefi', 'code4rena', 'sherlock', 'code review contest',
  ];
  const hasBugBounty = bountyKeywords.some((kw) => allText.includes(kw));

  const bugBountyEvidence = results
    .filter((r) => bountyKeywords.some((kw) => r.snippet.toLowerCase().includes(kw)))
    .slice(0, 2)
    .map((r) => r.snippet.substring(0, 150))
    .join(' | ');

  // Incident detection
  const incidentKeywords = [
    'hack', 'breach', 'exploit', 'stolen', 'drained', 'vulnerability',
    'incident', 'compromised', 'lost funds', 'security issue',
  ];
  const incidentResults = results.filter((r) =>
    incidentKeywords.some((kw) => r.snippet.toLowerCase().includes(kw))
  );
  const hasIncidents = incidentResults.length >= 2; // need multiple signals to confirm

  const incidentEvidence = incidentResults
    .slice(0, 2)
    .map((r) => r.snippet.substring(0, 150))
    .join(' | ');

  // Team transparency detection
  const teamKeywords = [
    'founder', 'ceo', 'cto', 'team', 'leadership', 'about us',
    'advisors', 'board', 'public', 'doxxed', 'doxxed team',
  ];
  const teamPublic = teamKeywords.some((kw) => allText.includes(kw));

  const teamEvidence = results
    .filter((r) => teamKeywords.some((kw) => r.snippet.toLowerCase().includes(kw)))
    .slice(0, 2)
    .map((r) => r.snippet.substring(0, 150))
    .join(' | ');

  return {
    hasLegalEntity,
    legalEntityEvidence: legalEntityEvidence || 'No legal entity info found via web search',
    hasSecurityAudits,
    auditEvidence: auditEvidence || 'No audit info found via web search',
    auditCount,
    auditorNames,
    hasProofOfReserves,
    porEvidence: porEvidence || 'No proof of reserves info found via web search',
    hasBugBounty,
    bugBountyEvidence: bugBountyEvidence || 'No bug bounty info found via web search',
    hasIncidents,
    incidentEvidence: incidentEvidence || 'No incident info found via web search',
    teamPublic,
    teamEvidence: teamEvidence || 'No team info found via web search',
  };
}

export function evaluateWebSearchQuestions(result: WebSearchProbeResult): QuestionResult[] {
  const questions = SECURITY_QUESTIONS.filter((q) => q.probeType === 'business');

  return questions.map((q) => {
    const startTime = Date.now();
    let passed = false;
    let score = 0;
    let evidence = '';

    switch (q.id) {
      case 'legal_entity':
        passed = result.hasLegalEntity;
        score = result.hasLegalEntity ? 100 : 0;
        evidence = result.legalEntityEvidence;
        break;

      case 'security_audits':
        passed = result.hasSecurityAudits;
        if (result.hasSecurityAudits) {
          if (result.auditCount >= 5) score = 100;
          else if (result.auditCount >= 3) score = 80;
          else if (result.auditCount >= 1) score = 60;
          evidence = `${result.auditCount} audit(s) found: ${result.auditorNames.join(', ')}. ${result.auditEvidence}`;
        } else {
          score = 0;
          evidence = result.auditEvidence;
        }
        break;

      case 'proof_of_reserves':
        if (result.hasProofOfReserves) {
          passed = true;
          score = 100;
          evidence = result.porEvidence;
        } else {
          passed = false;
          score = 50; // neutral — not all services need PoR
          evidence = result.porEvidence || 'No proof of reserves found (may not be applicable)';
        }
        break;
    }

    return {
      questionId: q.id,
      passed,
      score,
      confidence: result.responseTime > 0 ? 0.7 : 0.1,
      evidence: evidence.substring(0, 300),
      probeTime: Date.now() - startTime,
    };
  });
}
