import { getConfig } from '../../../config/index.js';
import { getLogger } from '../../../utils/logger.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Multi-provider web search.
 * Falls through: Exa → Brave → Google → DuckDuckGo (free, no key).
 * Used by the auditor to discover security information about services.
 */
export async function webSearch(query: string, numResults = 8): Promise<SearchResult[]> {
  const config = getConfig();
  const logger = getLogger();

  // Try Exa first (best semantic search)
  if (config.EXA_API_KEY) {
    try {
      const results = await exaSearch(query, numResults, config.EXA_API_KEY);
      if (results.length > 0) return results;
    } catch (err) {
      logger.warn({ err }, 'Exa search failed');
    }
  }

  // Try Brave
  if (config.BRAVE_SEARCH_API_KEY) {
    try {
      const results = await braveSearch(query, numResults, config.BRAVE_SEARCH_API_KEY);
      if (results.length > 0) return results;
    } catch (err) {
      logger.warn({ err }, 'Brave search failed');
    }
  }

  // Try Google Custom Search
  if (config.GOOGLE_SEARCH_API_KEY && config.GOOGLE_SEARCH_CX) {
    try {
      const results = await googleSearch(query, numResults, config.GOOGLE_SEARCH_API_KEY, config.GOOGLE_SEARCH_CX);
      if (results.length > 0) return results;
    } catch (err) {
      logger.warn({ err }, 'Google search failed');
    }
  }

  // Fallback: DuckDuckGo (free, no API key needed)
  try {
    const results = await ddgSearch(query, numResults);
    if (results.length > 0) return results;
  } catch (err) {
    logger.warn({ err }, 'DuckDuckGo search failed');
  }

  return [];
}

async function exaSearch(query: string, numResults: number, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      numResults,
      type: 'neural',
      contents: { text: { maxCharacters: 500 } },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];

  const data = await res.json() as {
    results?: Array<{ title: string; url: string; text?: string; highlights?: string[] }>;
  };

  return (data.results || []).slice(0, numResults).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: (r.text || r.highlights?.[0] || '').trim(),
  }));
}

async function braveSearch(query: string, numResults: number, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];

  const data = await res.json() as {
    web?: { results?: Array<{ title: string; url: string; description: string }> };
  };

  return (data.web?.results || []).slice(0, numResults).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
  }));
}

async function googleSearch(
  query: string,
  numResults: number,
  apiKey: string,
  cx: string
): Promise<SearchResult[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=${numResults}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

  if (!res.ok) return [];

  const data = await res.json() as {
    items?: Array<{ title: string; link: string; snippet: string }>;
  };

  return (data.items || []).slice(0, numResults).map((r) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
  }));
}

async function ddgSearch(query: string, numResults: number): Promise<SearchResult[]> {
  // Try DuckDuckGo Instant Answer API first
  const instantResults = await ddgInstantAnswer(query);
  if (instantResults.length >= 3) return instantResults.slice(0, numResults);

  // Fallback to HTML scraping
  const htmlResults = await ddgHtmlSearch(query);
  return htmlResults.slice(0, numResults);
}

async function ddgInstantAnswer(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const data = await res.json() as {
    AbstractText?: string;
    Heading?: string;
    AbstractURL?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
  };

  const results: SearchResult[] = [];

  if (data.AbstractText) {
    results.push({
      title: data.Heading || 'Summary',
      url: data.AbstractURL || '',
      snippet: data.AbstractText,
    });
  }

  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics.slice(0, 5)) {
      if (topic.Text) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text,
          url: topic.FirstURL || '',
          snippet: topic.Text,
        });
      }
    }
  }

  return results;
}

async function ddgHtmlSearch(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(8000),
  });
  const html = await res.text();

  const results: SearchResult[] = [];
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
    const href = match[1];
    const cleanUrl = href.startsWith('//')
      ? 'https:' + href
      : decodeURIComponent(href.replace(/^\/\/redirect\.duckduckgo\.com\/\?uddg=/, '').split('&rut=')[0]);
    results.push({
      url: cleanUrl,
      title: match[2].replace(/<[^>]+>/g, '').trim(),
      snippet: match[3].replace(/<[^>]+>/g, '').trim(),
    });
  }

  return results;
}
