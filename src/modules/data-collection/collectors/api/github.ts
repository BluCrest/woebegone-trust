import { getLogger } from '../../../../utils/logger.js';

interface GitHubRepoData {
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  license: string | null;
  lastPush: string;
  contributorCount: number;
  commitActivity90d: number;
}

export async function fetchGitHubRepo(repo: string): Promise<GitHubRepoData | null> {
  const logger = getLogger();

  try {
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
      logger.warn({ repo, status: repoRes.status }, 'GitHub repo fetch failed');
      return null;
    }

    const repoData = await repoRes.json() as {
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      language: string | null;
      license: { spdx_id: string } | null;
      pushed_at: string;
    };

    // Commit activity (last 90 days)
    let commitActivity90d = 0;
    if (commitsRes.ok) {
      const commits = await commitsRes.json() as Array<{ total: number }>;
      // Last 13 weeks (90 days)
      commitActivity90d = commits.slice(-13).reduce((sum, week) => sum + week.total, 0);
    }

    // Contributor count (from Link header)
    let contributorCount = 0;
    if (contributorsRes.ok) {
      const linkHeader = contributorsRes.headers.get('link') || '';
      const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      contributorCount = lastPageMatch ? parseInt(lastPageMatch[1]) : 1;
    }

    return {
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      language: repoData.language,
      license: repoData.license?.spdx_id || null,
      lastPush: repoData.pushed_at,
      contributorCount,
      commitActivity90d,
    };
  } catch (err) {
    logger.error({ repo, err }, 'GitHub API error');
    return null;
  }
}
