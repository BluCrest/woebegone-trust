# Point Woebegone Trust Registry

Open-source crypto trust scoring and verification platform. No black boxes. No accounts for reading. A public good.

## What It Does

Rates crypto services (exchanges, wallets, DeFi protocols, bridges, custodians) on 8 trust dimensions:

1. **Security Audits** (20%) — Code security through professional audits
2. **Proof of Reserves** (15%) — Solvency verification for custodial services
3. **Track Record** (15%) — Historical performance and uptime
4. **Team Transparency** (12%) — Accountability and reputational stake
5. **Insurance Coverage** (10%) — Protection against losses
6. **Regulatory Compliance** (10%) — Legal standing and compliance
7. **Open Source Status** (8%) — Transparency and auditability
8. **Incident History** (10%) — Past failures and response quality

### Trust Tiers

| Tier | Score | Requirements |
|------|-------|-------------|
| Platinum | 90-100 | Full verification, maximum transparency |
| Gold | 75-89 | Multiple audits, insurance, strong track record |
| Silver | 60-74 | Audit done, proof of reserves |
| Bronze | 40-59 | Basic checks, team identified |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start database (PostgreSQL + Redis)
docker compose up -d

# 3. Set up environment
cp .env.example .env

# 4. Run migrations
npm run db:push

# 5. Seed initial data
npm run seed

# 6. Start development server
npm run dev
```

The API runs at `http://localhost:3000`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/services` | List all scored services |
| GET | `/v1/services/:id` | Get specific service with full score breakdown |
| GET | `/v1/services/:id/history` | Score history (time series) |
| GET | `/v1/services/leaderboard` | Top scored services by category |
| POST | `/v1/verification/request` | Request Woebegone Verified certification |
| GET | `/v1/verification/:id` | Check verification status |
| GET | `/v1/methodology` | Current scoring methodology (public) |
| GET | `/v1/methodology/versions` | List all methodology versions |
| GET | `/v1/categories` | List service categories |
| GET | `/health` | Health check |

### Example: Get Service

```bash
curl http://localhost:3000/v1/services/binance
```

```json
{
  "data": {
    "id": "binance",
    "name": "Binance",
    "category": "exchange",
    "score": {
      "overallScore": 72,
      "grade": "silver",
      "confidence": 0.85,
      "factors": { ... }
    }
  }
}
```

### Example: List Services by Category

```bash
curl "http://localhost:3000/v1/services?category=defi&sort=score&order=desc"
```

### Example: Get Leaderboard

```bash
curl "http://localhost:3000/v1/services/leaderboard?limit=5"
```

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript
- **Framework**: Fastify
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Queue**: BullMQ

## Project Structure

```
src/
├── index.ts                     # Entry point
├── app.ts                       # Fastify app setup
├── config/                      # Environment configuration
├── db/
│   └── schema/                  # Drizzle table definitions
├── modules/
│   ├── services/                # Service CRUD + API routes
│   ├── scoring/                 # Trust scoring engine
│   │   └── factors/             # 8 individual factor calculators
│   ├── verification/            # Woebegone Verified system
│   └── data-collection/         # External data collectors
├── api/
│   ├── middleware/               # Rate limiting, error handling
│   └── routes/v1/               # REST API endpoints
├── jobs/                        # BullMQ background jobs
└── utils/                       # Logger, crypto, helpers
```

## Scoring Methodology

Each factor is calculated independently with its own sub-factors. Missing data is excluded (not treated as 0). Confidence reflects data coverage.

The methodology is versioned and stored as JSON configs in `methodology/`.

## Environment Variables

See `.env.example` for all required variables. All secrets via environment variables only — never in code.

## License

MIT — public good, open source.
