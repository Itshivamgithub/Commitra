# Commitra

Commitra is an enterprise-grade GitHub analytics and insights platform designed for engineering teams to monitor repository health, code complexity, and CI/CD pipelines.

## Features
- **Real-Time Analytics Dashboard:** Push-based WebSockets replace polling for instant metric updates.
- **Repository Health Score:** 5-category grading algorithm (Commit Consistency, PR Health, Issue Health, Code Activity, Community).
- **AI Insights Engine:** OpenAI-powered analysis providing repository summaries, activity trends, and actionable recommendations.
- **Code Complexity Analysis:** Evaluates repository structure, large files, and language diversity using the GitHub Trees API.
- **CI/CD Pipeline Analytics:** Tracks GitHub Actions workflow success rates, deployment frequencies, and durations.
- **Team Workspaces:** Collaborative environments with Role-Based Access Control (Owner, Admin, Member, Viewer).
- **Automated Webhooks:** Registers GitHub webhooks to automatically sync data on push, PR, and issue events.
- **PDF Report Export:** Headless Chromium generates professional, recruiter-ready analytical reports.
- **Advanced Caching:** Redis-backed stale-while-revalidate pattern with cache stampede protection and tag-based invalidation.

## Tech Stack
| Category | Technology |
|---|---|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Recharts, SWR |
| **Backend** | Node.js, Express, TypeScript, Zod |
| **Database** | PostgreSQL (Neon), Prisma ORM |
| **Cache/Queue** | Redis, BullMQ, Socket.io |
| **AI** | OpenAI GPT-4o-mini |
| **DevOps** | Docker, Nginx, GitHub Actions |
| **Monitoring** | Prometheus, Grafana |

## Architecture
Commitra operates as a Turborepo monorepo with an Express API backend and Next.js frontend. Background processing is handled by BullMQ workers connected to Redis, ensuring the main thread remains unblocked during heavy GitHub API synchronization.

*(Placeholder for Architecture Diagram: `/docs/architecture.png`)*

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 8+
- PostgreSQL
- Redis
- GitHub OAuth App

### Local Development
1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up your `.env` file (see below)
4. Initialize the database:
   ```bash
   pnpm --filter api prisma db push
   ```
5. Start the development server:
   ```bash
   pnpm dev
   ```

### Environment Variables
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GITHUB_CLIENT_ID` | GitHub OAuth app Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app Client Secret |
| `JWT_SECRET` | Secret for signing JWTs |
| `OPENAI_API_KEY` | OpenAI API key for AI Insights |
| `RESEND_API_KEY` | Resend API key for workspace invites |
| `WEBHOOK_BASE_URL` | Base URL for receiving GitHub webhooks (use ngrok locally) |

## Project Structure
```
commitra-monorepo/
├── apps/
│   ├── api/            # Express backend
│   └── web/            # Next.js frontend
├── packages/
│   └── types/          # Shared TypeScript interfaces
├── monitoring/         # Prometheus & Grafana configs
└── nginx/              # Production proxy configs
```

## Deployment
Commitra includes a fully production-ready Docker Compose configuration and GitHub Actions pipeline.
1. Authenticate with Docker Hub.
2. The GitHub Action will build and push the `commitra-api` and `commitra-web` images automatically.
3. Deploy via a webhook to your cloud provider (e.g., Railway, Render).

## Roadmap
- Integration with Kubernetes.
- Mobile application for on-the-go analytics.
- Real-time Slack/Discord notification integration.
