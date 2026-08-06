import type { QuestionResult } from '../questions.js';
import { SECURITY_QUESTIONS } from '../questions.js';

export interface GithubProbeResult {
  repo: string;
  exists: boolean;
  isPublic: boolean;
  stars: number;
  forks: number;
  openIssues: number;
  lastPush: string | null;
  daysSinceLastPush: number | null;
  commitActivity90d: number;
  contributorCount: number;
  hasDependencies: boolean;
  dependencyFile: string | null;
  hasBugBounty: boolean;
  bugBountyEvidence: string;
  licenseExists: boolean;
  responseTime: number;
}

const GITHUB_REPOS: Record<string, string> = {
  uniswap: 'Uniswap/v3-core',
  aave: 'aave/aave-v3-core',
  lido: 'lidofinance/lido-dao',
  metamask: 'MetaMask/metamask-extension',
  compound: 'compound-finance/compound-protocol',
  makerdao: 'makerdao/dss',
  curve: 'curvefi/curve-js',
  sushiswap: 'sushiswap/sushiswap-core',
  'trust-wallet': 'trustwallet/trust-wallet-core',
  trezor: 'trezor/trezor-firmware',
  bitgo: 'BitGo/bitgo-sdk',
  phantom: 'phantom-app/phantom',
};

export function getGithubRepo(serviceId: string): string | null {
  return GITHUB_REPOS[serviceId] || null;
}

export async function probeGithub(repo: string): Promise<GithubProbeResult> {
  const startTime = Date.now();

  const defaultResult: GithubProbeResult = {
    repo,
    exists: false,
    isPublic: false,
    stars: 0,
    forks: 0,
    openIssues: 0,
    lastPush: null,
    daysSinceLastPush: null,
    commitActivity90d: 0,
    contributorCount: 0,
    hasDependencies: false,
    dependencyFile: null,
    hasBugBounty: false,
    bugBountyEvidence: '',
    licenseExists: false,
    responseTime: 0,
  };

  try {
    // Fetch repo data
    const [repoRes, commitsRes, contributorsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      }),
      fetch(`https://api.github.com/repos/${repo}/stats/commit_activity`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      }),
      fetch(`https://api.github.com/repos/${repo}/contributors?per_page=1&anon=true`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      }),
    ]);

    if (!repoRes.ok) {
      return { ...defaultResult, responseTime: Date.now() - startTime };
    }

    const repoData = await repoRes.json() as {
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      pushed_at: string;
      license: { spdx_id: string } | null;
      private: boolean;
    };

    defaultResult.exists = true;
    defaultResult.isPublic = !repoData.private;
    defaultResult.stars = repoData.stargazers_count;
    defaultResult.forks = repoData.forks_count;
    defaultResult.openIssues = repoData.open_issues_count;
    defaultResult.lastPush = repoData.pushed_at;
    defaultResult.licenseExists = !!repoData.license;

    if (repoData.pushed_at) {
      const pushDate = new Date(repoData.pushed_at);
      defaultResult.daysSinceLastPush = Math.floor(
        (Date.now() - pushDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Commit activity (last 90 days)
    if (commitsRes.ok) {
      const commits = await commitsRes.json() as Array<{ total: number }>;
      defaultResult.commitActivity90d = commits
        .slice(-13)
        .reduce((sum, week) => sum + week.total, 0);
    }

    // Contributor count
    if (contributorsRes.ok) {
      const linkHeader = contributorsRes.headers.get('link') || '';
      const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      defaultResult.contributorCount = lastPageMatch
        ? parseInt(lastPageMatch[1])
        : 1;
    }

    // Check for dependency files
    const depFiles = ['package.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'Gemfile'];
    for (const file of depFiles) {
      try {
        const depRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${file}`,
          { headers: { Accept: 'application/vnd.github.v3+json' } }
        );
        if (depRes.ok) {
          defaultResult.hasDependencies = true;
          defaultResult.dependencyFile = file;
          break;
        }
      } catch {
        continue;
      }
    }

    // Check for bug bounty — look in README and SECURITY.md
    const bountyIndicators = [
      'bug bounty',
      'bugbounty',
      'responsible disclosure',
      'security bounty',
      'hackerone',
      'immunefi',
      'code4rena',
      'sherlock',
    ];

    for (const file of ['README.md', 'SECURITY.md', '.github/SECURITY.md']) {
      try {
        const readmeRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${file}`,
          {
            headers: {
              Accept: 'application/vnd.github.v3.raw',
            },
          }
        );
        if (readmeRes.ok) {
          const content = await readmeRes.text();
          const lowerContent = content.toLowerCase();
          for (const indicator of bountyIndicators) {
            if (lowerContent.includes(indicator)) {
              defaultResult.hasBugBounty = true;
              defaultResult.bugBountyEvidence = `Found "${indicator}" in ${file}`;
              break;
            }
          }
          if (defaultResult.hasBugBounty) break;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // GitHub API failed
  }

  return { ...defaultResult, responseTime: Date.now() - startTime };
}

export function evaluateGithubQuestions(result: GithubProbeResult): QuestionResult[] {
  const questions = SECURITY_QUESTIONS.filter(q => q.probeType === 'github');

  return questions.map(q => {
    const startTime = Date.now();
    let passed = false;
    let score = 0;
    let evidence = '';

    switch (q.id) {
      case 'repo_active':
        if (result.exists && result.isPublic) {
          passed = true;
          // Score based on activity
          score = 30; // base for existing
          if (result.commitActivity90d > 100) score += 30;
          else if (result.commitActivity90d > 30) score += 20;
          else if (result.commitActivity90d > 5) score += 10;

          if (result.contributorCount > 50) score += 20;
          else if (result.contributorCount > 10) score += 10;

          if (result.daysSinceLastPush !== null && result.daysSinceLastPush < 30) score += 20;
          else if (result.daysSinceLastPush !== null && result.daysSinceLastPush < 90) score += 10;

          score = Math.min(100, score);
          evidence = `Public repo: ${result.stars}★, ${result.commitActivity90d} commits/90d, ${result.contributorCount} contributors, last push ${result.daysSinceLastPush}d ago`;
        } else if (result.exists && !result.isPublic) {
          score = 40;
          evidence = 'Private repository (cannot assess activity)';
        } else {
          score = 0;
          evidence = 'No public repository found';
        }
        break;

      case 'dependencies_current':
        if (result.hasDependencies) {
          passed = true; // We can't fully check CVEs without npm audit, but existence is good
          score = 50; // neutral — would need npm audit for full score
          evidence = `Dependencies found in ${result.dependencyFile} (CVE check requires deeper analysis)`;
        } else {
          passed = false;
          score = 30;
          evidence = 'No dependency file found or not applicable';
        }
        break;

      case 'bug_bounty':
        passed = result.hasBugBounty;
        score = result.hasBugBounty ? 100 : 0;
        evidence = result.hasBugBounty
          ? result.bugBountyEvidence
          : 'No bug bounty program detected';
        break;
    }

    return {
      questionId: q.id,
      passed,
      score,
      confidence: result.responseTime > 0 ? 0.7 : 0.1,
      evidence,
      probeTime: Date.now() - startTime,
    };
  });
}
