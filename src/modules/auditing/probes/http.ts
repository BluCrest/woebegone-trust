import type { QuestionResult } from '../questions.js';
import { SECURITY_QUESTIONS } from '../questions.js';

export interface HttpProbeResult {
  url: string;
  https: boolean;
  tlsVersion?: string;
  hsts: boolean;
  csp: boolean;
  xFrameOptions: boolean;
  secureCookies: boolean;
  noTechLeak: boolean;
  corsSecure: boolean;
  statusCode: number;
  headers: Record<string, string>;
  responseTime: number;
}

const LEAKED_HEADERS = [
  'x-powered-by',
  'x-aspnet-version',
  'x-aspnetmvc-version',
  'x-generator',
  'server',
];

export async function probeHttp(url: string): Promise<HttpProbeResult> {
  const startTime = Date.now();
  const headers: Record<string, string> = {};
  let https = false;
  let statusCode = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'WoebegoneTrustRegistry/1.0 SecurityAudit' },
    });

    clearTimeout(timeout);

    https = url.startsWith('https://');
    statusCode = res.status;

    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
  } catch {
    // Try GET if HEAD fails
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'WoebegoneTrustRegistry/1.0 SecurityAudit' },
      });

      clearTimeout(timeout);

      https = url.startsWith('https://');
      statusCode = res.status;

      res.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    } catch {
      // Complete failure
    }
  }

  const hsts = !!headers['strict-transport-security'];
  const csp = !!headers['content-security-policy'];
  const xFrameOptions = !!headers['x-frame-options'];

  // Check secure cookie flags
  const setCookie = headers['set-cookie'] || '';
  const secureCookies = setCookie === '' || (
    setCookie.includes('Secure') && setCookie.includes('HttpOnly')
  );

  // Check for technology leaks
  let noTechLeak = true;
  for (const h of LEAKED_HEADERS) {
    if (headers[h]) {
      noTechLeak = false;
      break;
    }
  }

  // Check CORS
  const corsOrigin = headers['access-control-allow-origin'] || '';
  const corsSecure = corsOrigin !== '*' && corsOrigin !== '';

  return {
    url,
    https,
    hsts,
    csp,
    xFrameOptions,
    secureCookies,
    noTechLeak,
    corsSecure,
    statusCode,
    headers,
    responseTime: Date.now() - startTime,
  };
}

export function evaluateHttpQuestions(result: HttpProbeResult): QuestionResult[] {
  const questions = SECURITY_QUESTIONS.filter(q => q.probeType === 'http');

  return questions.map(q => {
    const startTime = Date.now();
    let passed = false;
    let score = 0;
    let evidence = '';

    switch (q.id) {
      case 'https_valid_tls':
        passed = result.https && result.statusCode > 0;
        score = result.https ? (result.statusCode >= 200 && result.statusCode < 400 ? 100 : 50) : 0;
        evidence = result.https
          ? `HTTPS valid, status ${result.statusCode}`
          : `HTTP only, no TLS`;
        break;

      case 'hsts_enabled':
        passed = result.hsts;
        score = result.hsts ? 100 : 0;
        evidence = result.hsts
          ? `HSTS: ${result.headers['strict-transport-security']}`
          : 'No HSTS header';
        break;

      case 'content_security_policy':
        passed = result.csp;
        score = result.csp ? 100 : 0;
        evidence = result.csp
          ? `CSP: ${result.headers['content-security-policy']?.substring(0, 100)}`
          : 'No Content-Security-Policy header';
        break;

      case 'x_frame_options':
        passed = result.xFrameOptions;
        score = result.xFrameOptions ? 100 : 0;
        evidence = result.xFrameOptions
          ? `X-Frame-Options: ${result.headers['x-frame-options']}`
          : 'No X-Frame-Options header';
        break;

      case 'secure_cookie_flags':
        passed = result.secureCookies;
        score = result.secureCookies ? 100 : 50;
        evidence = result.secureCookies
          ? 'Cookies have Secure+HttpOnly flags (or no cookies set)'
          : 'Cookies missing Secure or HttpOnly flags';
        break;

      case 'no_tech_leak':
        passed = result.noTechLeak;
        score = result.noTechLeak ? 100 : 30;
        evidence = result.noTechLeak
          ? 'No technology stack headers leaked'
          : `Technology headers detected: ${LEAKED_HEADERS.filter(h => result.headers[h]).join(', ')}`;
        break;

      case 'cors_config':
        passed = result.corsSecure;
        score = result.corsSecure ? 100 : 20;
        evidence = result.corsSecure
          ? 'CORS not allowing all origins'
          : 'CORS allows all origins (*)';
        break;
    }

    return {
      questionId: q.id,
      passed,
      score,
      confidence: result.statusCode > 0 ? 0.9 : 0.3,
      evidence,
      probeTime: Date.now() - startTime,
    };
  });
}
