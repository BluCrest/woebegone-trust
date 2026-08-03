# Point Woebegone Trust Registry

## Architecture Document

Open-source crypto trust scoring and verification platform. No black boxes. No accounts for reading. A public good.

---

## A. Tech Stack

### Backend

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | **Node.js 20 LTS** | Mature, fast, great ecosystem for web APIs |
| Language | **TypeScript 5.x** | Type safety, better DX, catches bugs early |
| Framework | **Fastify** | 2-3x faster than Express, built-in schema validation, plugin architecture |
| ORM | **Drizzle ORM** | Type-safe SQL, lightweight, better performance than Prisma for read-heavy work |
| Validation | **Zod** | Runtime validation + type inference, pairs perfectly with TypeScript |

### Database

| Component | Choice | Why |
|-----------|--------|-----|
| Primary DB | **PostgreSQL 16** | JSON support for flexible scoring data, full ACID, mature, free |
| Cache | **Redis 7** | Score caching, rate limiting, job queues, session storage |
| Search | **PostgreSQL full-text search** | Avoids Elasticsearch complexity, sufficient for MVP |

### Blockchain and Web3

| Library | Use Case |
|---------|----------|
| **viem** | EVM chain interactions (lighter than ethers.js, better TypeScript support) |
| **ethers.js** | Fallback for complex contract ABIs |

### Job Queue

| Component | Choice | Why |
|-----------|--------|-----|
| **BullMQ** | Background jobs | Redis-backed, retries, rate limiting, prioritized queues, great TypeScript support |

### Infrastructure

| Component | Choice | Why |
|-----------|--------|-----|
| **Docker** | Containerization | Consistent environments, easy deployment |
| **GitHub Actions** | CI/CD | Free for public repos, good ecosystem |

### Why NOT alternatives considered

- **Prisma**: Too heavy for read-heavy workload, migration system is slow
- **Express**: Slower, no built-in validation
- **MongoDB**: Relationships matter here (services, scores, audits, verifications)
- **Elasticsearch**: Overkill for MVP, PostgreSQL search is sufficient

---

## B. Core Modules

### 1. Data Collection Layer

**Architecture pattern: Collector, Normalize, Store**

Each data source has a dedicated collector module:

```typescript
interface DataCollector {
  source: string;
  dataType: 'on_chain' | 'api' | 'scrape' | 'manual';
  collect(serviceId: string): Promise<RawData>;
  normalize(raw: RawData): Promise<NormalizedData>;
}
```

**Collector types:**

- **On-Chain**: Verify wallet addresses, check proof-of-reserves, track transaction volumes
- **API Clients**: Pull structured data from aggregators (DeFiLlama TVL, CER scores, audit databases)
- **Web Scrapers**: Extract audit reports, team info, regulatory filings (use Playwright for JS-rendered pages)
- **Manual**: Structured submission forms with evidence requirements

**Data sources by category:**

| Category | Sources |
|----------|---------|
| On-Chain | Etherscan, Blockscout, Dune, Chainlink oracles, proof-of-reserves contracts |
| API | CoinGecko, CER.live, DeFiLlama, Immunefi, Messari |
| Web | Audit PDFs, GitHub repos, project websites, news, Twitter/X |
| Manual | Self-submissions, community reports, disputes |

### 2. Scoring Engine

**Key concepts:**

- **Factor score**: Individual 0-100 score per trust factor
- **Confidence level**: 0-1 (how much data we have, missing data = lower confidence)
- **Weighted sum**: Factors times weights times confidence
- **Final score**: Normalized to 0-100 with confidence adjustment

**Flow:** Factor Calculators -> Weighted Aggregator -> Final Score (0-100 + confidence)

**Methodology versioning:**

- Each scoring run tagged with methodology_version
- Historical scores preserved with old weights
- Methodology changes require community review

### 3. Verification Layer (Woebegone Verified)

**Verification workflow:**

1. Service owner submits proof via API
2. Platform validates data against thresholds (automated)
3. If passing: Issue on-chain credential (soulbound token)
4. Service owner receives credential
5. If issues found: Credential can be revoked via on-chain transaction

**Verification credential (Soulbound Token):**

```typescript
interface WoebegoneCredential {
  serviceId: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  trustScore: number;
  verifiedFactors: string[];
  issuedAt: number;
  expiresAt: number;
  methodologyVersion: string;
  metadataURI: string;  // IPFS/Arweave link to full verification report
}
```

**Verification tiers:**

| Tier | Trust Score | Requirements |
|------|-------------|--------------|
| Bronze | 40-59 | Basic checks passed, team identified |
| Silver | 60-74 | Audit completed, proof of reserves (if applicable) |
| Gold | 75-89 | Multiple audits, strong track record, insurance |
| Platinum | 90-100 | Comprehensive verification, full transparency |

### 4. API Layer

RESTful API with versioning. Public endpoints require no authentication.

**Design principles:**

- JSON responses only
- Pagination via cursor-based approach
- Rate limiting per IP (100 req/min for unauthenticated)
- ETag support for caching
- Filterable and sortable results

### 5. Storage Schema

Key tables and relationships:

- services (1) -> (many) service_scores -> score_history
- services (1) -> (many) data_points -> raw_evidence
- services (1) -> (many) verification_credentials
- services (1) -> (many) verification_requests
- services (1) -> (many) audit_reports

Full schema in Section F.

### 6. Background Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| refresh-service-data | Daily | Pull fresh data from all sources |
| recalculate-scores | Daily (after data refresh) | Recalculate trust scores |
| verify-credentials | Hourly | Check credential expiration |
| scrape-audit-reports | Weekly | Find new audit publications |
| check-incidents | Every 6 hours | Scan for security incidents |
| clean-stale-data | Weekly | Archive old data points |

---

## C. Scoring Methodology

### Trust Factors (8 dimensions)

| # | Factor | Weight | Data Sources | Rationale |
|---|--------|--------|--------------|-----------|
| 1 | Security Audits | 20% | Audit reports, CER, Immunefi | Direct measure of code security |
| 2 | Proof of Reserves | 15% | On-chain verification, attestations | Solvency verification for custodial services |
| 3 | Track Record | 15% | On-chain data, incident databases | Historical performance and uptime |
| 4 | Team Transparency | 12% | Public identities, LinkedIn, interviews | Accountability and reputational stake |
| 5 | Insurance Coverage | 10% | Public disclosures, verified claims | Protection against losses |
| 6 | Regulatory Compliance | 10% | Licenses, registrations, legal filings | Legal standing and compliance |
| 7 | Open Source Status | 8% | GitHub repos, code audits | Transparency and auditability |
| 8 | Incident History | 10% | CVE databases, news, community reports | Past failures and response quality |

### Factor Calculation Examples

**Security Audits (20%):**

- Has any audit: +30 points
- Audit recency (0-25): 25 minus (months since audit times 2)
- Auditor reputation (0-25): from CER/industry data
- Audit scope (0-10): full scope = 10, partial = 5
- Multiple audits bonus: 3+ audits = +10, 2 audits = +5

**Proof of Reserves (15%):**

- Has any PoR: +20 points
- Verification method (0-30): on-chain = 30, attestation = 15
- Coverage ratio (0-30): ratio times 30
- Freshness (0-10): 10 minus days since proof (min 0)
- Liabilities scope (0-10): all covered = 10, partial = 5

**Track Record (15%):**

- Years of operation (0-20): capped at 10 years
- Uptime percentage (0-25): based on historical availability
- Volume handled (0-15): higher volume = more trust
- No major incidents (0-25): clean record = full points
- Community reputation (0-15): aggregated sentiment

**Team Transparency (12%):**

- Named team members (0-25): public identities
- LinkedIn/profiles verifiable (0-20): verifiable presence
- Public communications (0-15): interviews, AMAs, blogs
- Company registration (0-20): legal entity exists
- Track record of team (0-20): previous projects, reputation

**Insurance Coverage (10%):**

- Has insurance (0-30): yes = 30
- Coverage amount relative to AUM (0-40): ratio-based
- Insurer reputation (0-15): tier-1 insurer = 15
- Publicly verifiable (0-15): documentation available

**Regulatory Compliance (10%):**

- Licenses held (0-30): number and jurisdiction quality
- KYC/AML implementation (0-20): verified compliance
- Regulatory history (0-20): no fines or violations
- Jurisdiction quality (0-15): well-regulated jurisdiction
- Legal transparency (0-15): terms of service, legal entity

**Open Source Status (8%):**

- Code repository exists (0-20): public repo
- Code activity (0-20): recent commits, active development
- Code coverage/tests (0-15): test suite quality
- Community contributions (0-15): external contributors
- Documentation quality (0-15): comprehensive docs
- Bug bounty program (0-15): active program

**Incident History (10%):**

- No incidents (0-40): clean record
- Incident severity distribution (0-25): weighted by severity
- Response quality (0-20): how incidents were handled
- Recovery time (0-15): how quickly resolved

### Handling Missing Data

```typescript
interface FactorScore {
  score: number;      // 0-100
  confidence: number; // 0-1
  hasData: boolean;
  missingFields: string[];
}
```

**Missing data strategy:**

- Missing factors are excluded from the weighted sum (not treated as 0)
- Confidence score reflects data coverage (6/8 factors = 0.75 confidence)
- Services with less than 4 factors scored are marked as "insufficient data"
- Users can see exactly which factors contributed to the score

### Score Calculation

```typescript
function calculateFinalScore(factors: FactorScore[]): FinalScore {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const factor of factors) {
    if (factor.hasData) {
      weightedSum += factor.score * factor.weight * factor.confidence;
      totalWeight += factor.weight * factor.confidence;
    }
  }

  const finalScore = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
  const overallConfidence = totalWeight / TOTAL_WEIGHT;

  return {
    score: Math.round(finalScore),
    confidence: overallConfidence,
    grade: scoreToGrade(finalScore),
    dataCoverage: overallConfidence
  };
}
```

### Methodology Versioning

- Methodology stored as versioned JSON config
- Each scoring run references methodology version
- Historical scores always calculated with original methodology
- Changes logged with diff, rationale, and changelog
- Major changes require 30-day notice period

```typescript
interface Methodology {
  version: string;  // semver: 1.0.0
  factors: FactorConfig[];
  weights: Record<string, number>;
  thresholds: ScoreThresholds;
  createdAt: Date;
  changelog: string;
}
```

---

## D. Data Sources

### On-Chain Sources

| Source | What to Collect | Reliability |
|--------|----------------|-------------|
| Etherscan / Blockscout | Wallet balances, transaction history, contract verification | High |
| Dune Analytics | Custom queries for protocol-specific metrics | High |
| Proof of Reserves contracts | Reserve verification, collateral ratios | High (if contract exists) |
| Chainlink oracles | Price feeds, reserve attestations | High |
| DeFiLlama | TVL, protocol data, chain breakdown | High |

### API Sources

| Source | What to Collect | Rate Limits |
|--------|----------------|-------------|
| CoinGecko | Market data, token info, exchange rankings | 10-50 calls/min |
| CER.live | Exchange security scores, hack history | Varies |
| DeFiLlama | Protocol TVL, fees, revenue | Generous |
| Immunefi | Bug bounty programs, vulnerability disclosures | Limited |
| Messari | Protocol profiles, governance data | Limited |

### Web Sources

| Source | What to Collect | Method |
|--------|----------------|--------|
| Project websites | Team pages, about sections | Scraping |
| GitHub repos | Code activity, contributors, issues | API |
| Audit reports (PDFs) | Findings, severity, remediation | Manual extraction |
| News articles | Incident reports, partnerships | RSS + NLP |
| Twitter/X | Team activity, community sentiment | API |

### Manual Sources

| Source | What to Collect | Process |
|--------|----------------|---------|
| Self-submissions | Service metadata, evidence links | Structured form with required fields |
| Community reports | Issues, concerns, tips | Submission form with moderation |
| Disputes | Challenged scores | Formal dispute process |

### Aggregation and Cross-Reference

**Cross-reference strategy:**

- Same data from multiple sources increases confidence
- Conflicting data triggers manual review
- Source reliability scores affect weighting
- Staleness detection based on expected update frequency

```typescript
interface AggregatedData {
  field: string;
  values: Array<{
    value: any;
    source: string;
    confidence: number;
    timestamp: Date;
  }>;
  consensus: any;      // most agreed-upon value
  confidence: number;  // 0-1 based on agreement
  conflicts: boolean;  // true if sources disagree
}
```

---

## E. API Design

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /v1/services | List all scored services (paginated, filterable) |
| GET | /v1/services/:id | Get specific service with full score breakdown |
| GET | /v1/services/:id/history | Score history (time series) |
| POST | /v1/services/submit | Self-submit a service for scoring |
| POST | /v1/verification/request | Request Woebegone Verified certification |
| GET | /v1/verification/:id | Check verification status |
| GET | /v1/methodology | Current scoring methodology (public) |
| GET | /v1/methodology/versions | List all methodology versions |
| GET | /v1/leaderboard | Top scored services by category |
| GET | /v1/categories | List service categories |

### API Versioning Strategy

- URL-based versioning: `/v1/`, `/v2/`
- Current version: v1
- Deprecation policy: 6 months notice before removal
- Breaking changes only in major versions
- New fields added without version bump

### Request/Response Examples

**GET /v1/services:**

```json
{
  "data": [
    {
      "id": "binance",
      "name": "Binance",
      "type": "exchange",
      "score": 78,
      "grade": "gold",
      "confidence": 0.92,
      "lastUpdated": "2026-01-15T00:00:00Z",
      "verified": true,
      "verifiedTier": "gold"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6ImJpbmFuY2UifQ==",
    "hasMore": true
  },
  "meta": {
    "total": 245,
    "methodologyVersion": "1.2.0"
  }
}
```

**GET /v1/services/:id:**

```json
{
  "data": {
    "id": "binance",
    "name": "Binance",
    "type": "exchange",
    "website": "https://binance.com",
    "score": {
      "overall": 78,
      "grade": "gold",
      "confidence": 0.92,
      "factors": {
        "securityAudits": { "score": 85, "confidence": 0.95, "weight": 0.20 },
        "proofOfReserves": { "score": 90, "confidence": 0.98, "weight": 0.15 },
        "trackRecord": { "score": 75, "confidence": 0.90, "weight": 0.15 },
        "teamTransparency": { "score": 60, "confidence": 0.80, "weight": 0.12 },
        "insurance": { "score": 70, "confidence": 0.70, "weight": 0.10 },
        "regulatoryCompliance": { "score": 80, "confidence": 0.85, "weight": 0.10 },
        "openSource": { "score": 40, "confidence": 0.60, "weight": 0.08 },
        "incidentHistory": { "score": 65, "confidence": 0.88, "weight": 0.10 }
      }
    },
    "verification": {
      "verified": true,
      "tier": "gold",
      "issuedAt": "2025-11-01T00:00:00Z",
      "expiresAt": "2026-11-01T00:00:00Z",
      "credentialId": "0x..."
    },
    "lastUpdated": "2026-01-15T00:00:00Z"
  }
}
```

**POST /v1/services/submit:**

```json
{
  "name": "NewExchange",
  "type": "exchange",
  "website": "https://newexchange.com",
  "contactEmail": "trust@newexchange.com",
  "evidence": {
    "auditReports": ["https://..."],
    "proofOfReserves": "https://...",
    "teamPage": "https://...",
    "github": "https://github.com/..."
  }
}
```

### Rate Limiting

- Unauthenticated: 100 requests per minute per IP
- Self-submissions: 10 requests per hour per IP
- Verification requests: 5 requests per day per service

---

## F. File/Folder Structure

### Directory Layout

```
woebegone-trust-registry/
├── src/
│   ├── index.ts                    # Application entry point
│   ├── app.ts                      # Fastify app configuration
│   ├── config/
│   │   ├── index.ts                # Environment config loader
│   │   ├── database.ts             # Database connection config
│   │   ├── redis.ts                # Redis connection config
│   │   └── api-keys.ts             # External API key config (env vars only)
│   ├── modules/
│   │   ├── services/
│   │   │   ├── service.model.ts    # Drizzle schema
│   │   │   ├── service.service.ts  # Business logic
│   │   │   ├── service.routes.ts   # API routes
│   │   │   └── service.types.ts    # TypeScript types
│   │   ├── scoring/
│   │   │   ├── scoring.engine.ts   # Core scoring logic
│   │   │   ├── factors/            # Individual factor calculators
│   │   │   │   ├── security-audits.ts
│   │   │   │   ├── proof-of-reserves.ts
│   │   │   │   ├── track-record.ts
│   │   │   │   ├── team-transparency.ts
│   │   │   │   ├── insurance.ts
│   │   │   │   ├── regulatory.ts
│   │   │   │   ├── open-source.ts
│   │   │   │   └── incident-history.ts
│   │   │   ├── methodology.ts      # Methodology versioning
│   │   │   └── scoring.types.ts
│   │   ├── verification/
│   │   │   ├── verification.service.ts
│   │   │   ├── verification.routes.ts
│   │   │   ├── credential.ts       # On-chain credential issuance
│   │   │   └── verification.types.ts
│   │   └── data-collection/
│   │       ├── collectors/
│   │       │   ├── on-chain/
│   │       │   │   ├── etherscan.ts
│   │       │   │   ├── blockscout.ts
│   │       │   │   └── proof-of-reserves.ts
│   │       │   ├── api/
│   │       │   │   ├── coingecko.ts
│   │       │   │   ├── cer-live.ts
│   │       │   │   ├── defillama.ts
│   │       │   │   └── immunefi.ts
│   │       │   └── web/
│   │       │       ├── github.ts
│   │       │       ├── audit-reports.ts
│   │       │       └── project-websites.ts
│   │       ├── aggregator.ts       # Cross-reference logic
│   │       ├── normalizer.ts       # Data normalization
│   │       └── collector.types.ts
│   ├── jobs/
│   │   ├── queue.ts                # BullMQ queue setup
│   │   ├── refresh-data.job.ts     # Data refresh job
│   │   ├── recalculate-scores.job.ts
│   │   ├── check-credentials.job.ts
│   │   └── scheduled.ts            # Job scheduling config
│   ├── api/
│   │   ├── middleware/
│   │   │   ├── rate-limit.ts
│   │   │   ├── validation.ts
│   │   │   └── error-handler.ts
│   │   └── routes/
│   │       ├── v1/
│   │       │   ├── services.ts
│   │       │   ├── verification.ts
│   │       │   ├── methodology.ts
│   │       │   └── leaderboard.ts
│   │       └── index.ts            # Route registration
│   ├── db/
│   │   ├── schema/
│   │   │   ├── services.ts
│   │   │   ├── scores.ts
│   │   │   ├── data-points.ts
│   │   │   ├── verifications.ts
│   │   │   └── methodology.ts
│   │   ├── migrations/             # Drizzle migrations
│   │   └── index.ts                # DB connection
│   └── utils/
│       ├── logger.ts
│       ├── crypto.ts               # Signing, hashing
│       ├── ipfs.ts                 # IPFS/Arweave uploads
│       └── date.ts
├── methodology/                    # Versioned methodology configs
│   ├── 1.0.0.json
│   ├── 1.1.0.json
│   └── 1.2.0.json
├── contracts/                      # Smart contracts
│   ├── WoebegoneCredential.sol
│   └── foundry.toml
├── scripts/
│   ├── seed.ts                     # Seed initial data
│   └── deploy-contract.ts
├── tests/
│   ├── unit/
│   │   ├── scoring/
│   │   └── collectors/
│   ├── integration/
│   │   ├── api/
│   │   └── jobs/
│   └── fixtures/
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

### Config Management

- All secrets via environment variables (never in code)
- `.env.example` committed with dummy values
- `.env` in `.gitignore`
- Config loaded via `src/config/index.ts` with Zod validation
- Docker Compose for local development with `.env` file

**Required environment variables:**

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ETHERSCAN_API_KEY=...
COINGECKO_API_KEY=...
CER_LIVE_API_KEY=...
INFURA_URL=...
PRIVATE_KEY=...            # For credential issuance
IPFS_API_KEY=...
PORT=3000
NODE_ENV=development
```

---

## G. Security Considerations

### API Rate Limiting

- 100 req/min per IP for read endpoints
- 10 req/hour per IP for submissions
- 5 req/day per service for verification requests
- Implemented via Redis-backed rate limiter (BullMQ or ioredis)

### Input Validation

- All inputs validated with Zod schemas at API boundary
- SQL injection prevented by Drizzle ORM (parameterized queries)
- XSS prevention via JSON-only responses (no HTML rendering)
- File uploads (audit PDFs) validated for type, size, and scanned for malware

### Signed Verification Credentials

- Credentials signed with platform private key (ECDSA on Ethereum)
- Verifiable on-chain or via signature verification
- Metadata stored on IPFS/Arweave (immutable)
- Expiration dates enforced (1 year max, renewable)

### Anti-Gaming Measures

**Score manipulation prevention:**

- Data sourced from independent third parties where possible
- Self-submitted data weighted lower than third-party data
- Anomaly detection: flag sudden score changes for review
- Cross-reference multiple sources before accepting data
- Audit trail for all data changes (who, what, when)

**Sybil resistance:**

- One account per verified email for submissions
- Domain verification required for self-submissions
- Community reports require evidence
- Dispute resolution with transparent process

**Data freshness:**

- Stale data flagged and downweighted
- Automatic re-collection on suspicious patterns
- Manual review for data older than threshold

### Smart Contract Security

- Credential contract audited before deployment
- Upgradeable via proxy pattern (with timelock)
- Emergency pause function for credential revocation
- Multi-sig for contract upgrades

---

## H. Deployment Strategy

### Hosting Options

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| **Render** | $7-25/mo | Easy setup, auto-deploy, PostgreSQL included | Vendor lock-in, limited customization |
| **Railway** | $5-20/mo | Simple, good DX, PostgreSQL add-on | Newer platform, less documentation |
| **VPS (Hetzner/DigitalOcean)** | $10-20/mo | Full control, cheapest long-term | More setup, manual management |

**Recommendation: Render** for MVP (simplest path), migrate to VPS if needed for cost at scale.

### Database Hosting

- **Render PostgreSQL** (included with service) for MVP
- **Neon** or **Supabase** for managed PostgreSQL if separate hosting needed
- **Upstash Redis** for serverless Redis (or Redis Cloud free tier)

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: git push origin main  # Render auto-deploys from main
```

### Monitoring

- **Logging**: Pino (structured JSON logging) to stdout
- **Error tracking**: Sentry (free tier for open source)
- **Uptime**: BetterStack or UptimeRobot (free tier)
- **Metrics**: Basic Prometheus metrics endpoint
- **Health check**: GET /health endpoint

---

## I. MVP Scope

### v1.0 (MVP) - 6-8 weeks

**Must have:**

- [ ] PostgreSQL schema and Drizzle setup
- [ ] Service model (CRUD for crypto services)
- [ ] 3 scoring factors implemented:
  - Security Audits
  - Proof of Reserves
  - Track Record
- [ ] Basic scoring engine (weighted average, confidence)
- [ ] REST API:
  - GET /v1/services (list)
  - GET /v1/services/:id (detail)
  - GET /v1/methodology
- [ ] Data collection:
  - Etherscan on-chain data
  - CoinGecko API
  - Basic web scraper for audit reports
- [ ] Daily data refresh job
- [ ] Docker setup for local development
- [ ] Basic frontend (optional, can use Swagger/OpenAPI)

**Nice to have for v1.0:**

- [ ] Score history tracking
- [ ] Leaderboard endpoint
- [ ] Self-submission endpoint

### v1.1 (2-3 weeks after v1.0)

- [ ] All 8 scoring factors
- [ ] Self-submission with evidence upload
- [ ] Community reports
- [ ] Score history API
- [ ] Improved data aggregation

### v1.2 (4-6 weeks after v1.1)

- [ ] Verification credential system (on-chain)
- [ ] Woebegone Verified badge/tier
- [ ] IPFS metadata storage
- [ ] Verification request workflow

### v2.0 (8-12 weeks after v1.2)

- [ ] Advanced anti-gaming measures
- [ ] Dispute resolution system
- [ ] Methodology governance (community proposals)
- [ ] WebSocket for real-time score updates
- [ ] Advanced analytics dashboard

### Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| v1.0 MVP | 6-8 weeks | None |
| v1.1 Enhanced | 2-3 weeks | v1.0 live |
| v1.2 Verification | 4-6 weeks | v1.1 live |
| v2.0 Advanced | 8-12 weeks | v1.2 live |
| **Total to full platform** | **20-29 weeks** | |

### Build Order (Critical Path)

1. Database schema + Drizzle setup (days 1-2)
2. Service model + API routes (days 3-5)
3. Scoring engine + 3 factors (days 6-10)
4. Data collectors (Etherscan, CoinGecko) (days 11-14)
5. Background jobs (BullMQ) (days 15-17)
6. Docker + deployment (days 18-20)
7. Testing + polish (days 21-25)
8. Launch v1.0

---

## Appendix: Key Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Fastify over Express | 2-3x performance, built-in validation | Architect |
| Drizzle over Prisma | Lighter, faster for read-heavy workloads | Architect |
| PostgreSQL over MongoDB | Relational data (services, scores, audits) | Architect |
| viem over ethers.js | Better TypeScript, smaller bundle | Architect |
| URL-based API versioning | Simple, clear, industry standard | Architect |
| Soulbound tokens for credentials | Non-transferable, on-chain verifiable | Architect |
| Missing data = exclusion | More honest than artificial 0 scores | Architect |

---

*This document is version-controlled alongside the code. Methodology changes are tracked separately in the methodology/ directory.*
