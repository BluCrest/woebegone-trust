import type { QuestionResult } from '../questions.js';
import { SECURITY_QUESTIONS } from '../questions.js';

export interface ApiProbeResult {
  baseUrl: string;
  hasRateLimiting: boolean;
  rateLimitHeaders: string[];
  errorHandlingSafe: boolean;
  errorEvidence: string;
  statusCode: number;
  responseTime: number;
}

export async function probeApi(baseUrl: string): Promise<ApiProbeResult> {
  const startTime = Date.now();
  let hasRateLimiting = false;
  let rateLimitHeaders: string[] = [];
  let errorHandlingSafe = true;
  let errorEvidence = '';
  let statusCode = 0;

  // Check for rate limiting headers on normal request
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(baseUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'WoebegoneTrustRegistry/1.0 SecurityAudit' },
    });

    clearTimeout(timeout);
    statusCode = res.status;

    // Check rate limit headers
    const rateLimitHeaderNames = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
      'x-rate-limit-limit',
      'x-rate-limit-remaining',
    ];

    res.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (rateLimitHeaderNames.includes(lowerKey)) {
        hasRateLimiting = true;
        rateLimitHeaders.push(`${key}: ${value}`);
      }
    });
  } catch {
    // Connection failed
  }

  // Test error handling — hit a non-existent endpoint
  try {
    const errorUrl = `${baseUrl.replace(/\/$/, '')}/__nonexistent_test_endpoint_404_${Date.now()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(errorUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'WoebegoneTrustRegistry/1.0 SecurityAudit' },
    });

    clearTimeout(timeout);

    const body = await res.text();
    const lowerBody = body.toLowerCase();

    // Check for dangerous patterns in error responses
    const dangerousPatterns = [
      'stack trace',
      'at line',
      'at function',
      'node_modules',
      'vendor/',
      'src/',
      'internal/',
      'debug',
      'traceback',
      'exception',
      'sql',
      'query',
      'password',
      'secret',
      'token',
    ];

    const foundPatterns = dangerousPatterns.filter(p => lowerBody.includes(p));

    if (foundPatterns.length > 0) {
      errorHandlingSafe = false;
      errorEvidence = `Error response leaks: ${foundPatterns.join(', ')}`;
    } else {
      errorEvidence = `Error response safe (${res.status})`;
    }
  } catch {
    errorEvidence = 'Error endpoint unreachable';
  }

  return {
    baseUrl,
    hasRateLimiting,
    rateLimitHeaders,
    errorHandlingSafe,
    errorEvidence,
    statusCode,
    responseTime: Date.now() - startTime,
  };
}

export function evaluateApiQuestions(result: ApiProbeResult): QuestionResult[] {
  const questions = SECURITY_QUESTIONS.filter(q => q.probeType === 'api');

  return questions.map(q => {
    const startTime = Date.now();
    let passed = false;
    let score = 0;
    let evidence = '';

    switch (q.id) {
      case 'error_handling':
        passed = result.errorHandlingSafe;
        score = result.errorHandlingSafe ? 100 : 10;
        evidence = result.errorEvidence;
        break;

      case 'rate_limiting':
        passed = result.hasRateLimiting;
        score = result.hasRateLimiting ? 100 : 20;
        evidence = result.hasRateLimiting
          ? `Rate limit headers: ${result.rateLimitHeaders.join(', ')}`
          : 'No rate limiting detected';
        break;
    }

    return {
      questionId: q.id,
      passed,
      score,
      confidence: result.responseTime > 0 ? 0.8 : 0.2,
      evidence,
      probeTime: Date.now() - startTime,
    };
  });
}
