import type { QuestionResult } from '../questions.js';
import { SECURITY_QUESTIONS } from '../questions.js';

export interface DnsProbeResult {
  domain: string;
  aRecords: string[];
  aaaaRecords: string[];
  mxRecords: string[];
  nsRecords: string[];
  dnssec: boolean;
  domainAge: number | null; // years, null if unknown
  hasValidDns: boolean;
  responseTime: number;
}

// DNS-over-HTTPS providers
const DOH_PROVIDERS = [
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/dns-query',
];

async function dnsQuery(domain: string, type: string): Promise<unknown[]> {
  for (const provider of DOH_PROVIDERS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${provider}?name=${domain}&type=${type}`, {
        headers: {
          Accept: 'application/dns-json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json() as {
        Status: number;
        Answer?: Array<{ name: string; type: number; data: string }>;
      };

      if (data.Status === 0 && data.Answer) {
        return data.Answer;
      }
    } catch {
      continue;
    }
  }
  return [];
}

async function checkDnssec(domain: string): Promise<boolean> {
  // Check DNSSEC via Cloudflare's DOH with DNSSEC OK bit
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
      {
        headers: {
          Accept: 'application/dns-json',
          'dnssec-ok': '1',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) return false;

    const data = await res.json() as {
      AD?: boolean; // Authenticated Data = DNSSEC validated
      CD?: boolean; // Checking Disabled
    };

    return data.AD === true;
  } catch {
    return false;
  }
}

async function getDomainAge(domain: string): Promise<number | null> {
  // Try RDAP (Registration Data Access Protocol) — the modern WHOIS
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json() as {
      events?: Array<{ eventAction: string; eventDate: string }>;
    };

    const registration = data.events?.find(
      (e) => e.eventAction === 'registration'
    );

    if (registration) {
      const regDate = new Date(registration.eventDate);
      const now = new Date();
      const years = (now.getTime() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return Math.round(years * 10) / 10;
    }
  } catch {
    // RDAP failed
  }

  return null;
}

export async function probeDns(url: string): Promise<DnsProbeResult> {
  const startTime = Date.now();
  const domain = new URL(url).hostname;

  // Run all DNS queries in parallel
  const [aRecords, aaaaRecords, mxRecords, nsRecords, dnssec, domainAge] =
    await Promise.all([
      dnsQuery(domain, 'A'),
      dnsQuery(domain, 'AAAA'),
      dnsQuery(domain, 'MX'),
      dnsQuery(domain, 'NS'),
      checkDnssec(domain),
      getDomainAge(domain),
    ]);

  const aAddrs = aRecords
    .filter((r: any) => r.type === 1)
    .map((r: any) => r.data);
  const aaaaAddrs = aaaaRecords
    .filter((r: any) => r.type === 28)
    .map((r: any) => r.data);
  const mxRecs = mxRecords
    .filter((r: any) => r.type === 15)
    .map((r: any) => r.data);
  const nsRecs = nsRecords
    .filter((r: any) => r.type === 2)
    .map((r: any) => r.data);

  const hasValidDns = aAddrs.length > 0 || aaaaAddrs.length > 0;

  return {
    domain,
    aRecords: aAddrs,
    aaaaRecords: aaaaAddrs,
    mxRecords: mxRecs,
    nsRecords: nsRecs,
    dnssec,
    domainAge,
    hasValidDns,
    responseTime: Date.now() - startTime,
  };
}

export function evaluateDnsQuestions(result: DnsProbeResult): QuestionResult[] {
  const questions = SECURITY_QUESTIONS.filter(q => q.probeType === 'dns');

  return questions.map(q => {
    const startTime = Date.now();
    let passed = false;
    let score = 0;
    let evidence = '';

    switch (q.id) {
      case 'domain_age':
        if (result.domainAge !== null) {
          passed = result.domainAge >= 2;
          if (result.domainAge >= 5) score = 100;
          else if (result.domainAge >= 3) score = 80;
          else if (result.domainAge >= 2) score = 60;
          else if (result.domainAge >= 1) score = 30;
          else score = 10;
          evidence = `Domain age: ${result.domainAge} years`;
        } else {
          passed = false;
          score = 30; // unknown = neutral
          evidence = 'Domain age unknown (RDAP lookup failed)';
        }
        break;

      case 'dnssec_enabled':
        passed = result.dnssec;
        score = result.dnssec ? 100 : 0;
        evidence = result.dnssec
          ? 'DNSSEC enabled'
          : 'DNSSEC not enabled';
        break;

      case 'valid_dns_records':
        passed = result.hasValidDns;
        score = result.hasValidDns ? 100 : 0;
        evidence = result.hasValidDns
          ? `A: ${result.aRecords.length}, AAAA: ${result.aaaaRecords.length}, MX: ${result.mxRecords.length}, NS: ${result.nsRecords.length}`
          : 'No valid A or AAAA records';
        break;
    }

    return {
      questionId: q.id,
      passed,
      score,
      confidence: result.responseTime > 0 ? 0.85 : 0.2,
      evidence,
      probeTime: Date.now() - startTime,
    };
  });
}
