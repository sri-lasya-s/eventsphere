#  EventSphere

> **Event management & discovery platform** — create, discover, and RSVP to events with real-time weather forecasts powered by OpenWeatherMap.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (SPA)                         │
│                  Vanilla HTML/JS frontend                    │
└───────────────────────────┬─────────────────────────────────┘
                            │ GraphQL over HTTP
┌───────────────────────────▼─────────────────────────────────┐
│                   Apollo Server 4 (Express)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Auth Layer  │  │  Resolvers   │  │  Weather Service │   │
│  │  JWT + bcrypt│  │  (modular)   │  │  + In-mem cache  │   │
│  └──────────────┘  └──────┬───────┘  └─────────┬────────┘   │
└─────────────────────────┬─┘──────────────────┬─┘────────────┘
                          │                    │
              ┌───────────▼────────┐  ┌────────▼────────────┐
              │  PostgreSQL via    │  │  OpenWeatherMap API  │
              │  Prisma ORM        │  │  (geocode + weather) │
              └────────────────────┘  └─────────────────────┘
```

## Database Schema

```
users (1) ──────< events (organizer)
users (1) ──────< rsvps
events (1) ─────< rsvps
categories (1) ─< events
```

**4 tables:** `users`, `events`, `rsvps`, `categories`

**Relationships:**
- User → Events (one-to-many as organizer)
- User → RSVPs (one-to-many)
- Event → RSVPs (one-to-many)
- Category → Events (one-to-many)
- Users ↔ Events (many-to-many through RSVPs)

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Runtime     | Node.js 20                        |
| API         | GraphQL (Apollo Server 4)         |
| ORM         | Prisma 5                          |
| Database    | PostgreSQL 16                     |
| Auth        | JWT + bcrypt                      |
| External    | OpenWeatherMap API                |
| Frontend    | Vanilla HTML/JS SPA               |
| Logging     | Winston                           |
| Testing     | Jest + Supertest                  |
| Container   | Docker + Docker Compose           |
| CI/CD       | GitHub Actions                    |

## Quick Start

### Prerequisites
- Node.js ≥ 20
- PostgreSQL 16 (or Docker)
- OpenWeatherMap API key (free at openweathermap.org)

### 1. Clone & Install
```bash
git clone https://github.com/yourname/eventsphere.git
cd eventsphere
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, OPENWEATHER_API_KEY
```

### 3. Database Setup
```bash
npx prisma migrate dev --name init
npx prisma generate
node prisma/seed.js
```

### 4. Start Development Server
```bash
npm run dev
# Server → http://localhost:4000
# GraphQL Playground → http://localhost:4000/graphql
# Frontend SPA → http://localhost:4000
```

### Test Accounts (after seeding)
| Email | Password | Role |
|-------|----------|------|
| admin@eventsphere.com | Password123! | ADMIN |
| organizer@eventsphere.com | Password123! | ORGANIZER |
| user@eventsphere.com | Password123! | ATTENDEE |

---

## Docker Deployment

```bash
# Set your API key
export OPENWEATHER_API_KEY=your_key_here

# Start all services
docker compose up -d

# Run migrations inside container
docker compose exec app npx prisma migrate deploy
docker compose exec app node prisma/seed.js
```

---

## GraphQL API

Access the interactive playground at `http://localhost:4000/graphql`.

### Example Queries

**List events with weather:**
```graphql
query {
  events(filters: { status: UPCOMING }, limit: 10) {
    totalCount
    edges {
      id title location startDate
      weather { temperature description icon }
      category { name icon }
      spotsLeft attendeeCount
    }
  }
}
```

**Get weather for any location:**
```graphql
query {
  weatherForLocation(location: "New York, NY") {
    temperature feelsLike description icon humidity windSpeed
  }
  forecastForLocation(location: "New York, NY") {
    cityName days { date tempMin tempMax description precipitation }
  }
}
```

**Register & Login:**
```graphql
mutation {
  register(input: { name: "Jane", email: "jane@test.com", password: "Secret123!" }) {
    token
    user { id name role }
  }
}
```

**Create Event** *(requires ORGANIZER/ADMIN role — pass `Authorization: Bearer <token>` header)*:
```graphql
mutation {
  createEvent(input: {
    title: "Chicago Dev Meetup"
    description: "Monthly JavaScript meetup"
    location: "Chicago, IL"
    startDate: "2025-08-15T18:00:00Z"
    endDate: "2025-08-15T21:00:00Z"
    capacity: 80
    categoryId: "<category-id>"
  }) { id title }
}
```

**RSVP:**
```graphql
mutation {
  createRsvp(eventId: "<event-id>", status: GOING) { id status }
}
```

---

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

Test coverage includes:
- Weather service with mocked HTTP calls
- Auth utilities (hashing, JWT)
- GraphQL resolver authorization
- Event CRUD operations
- RSVP business logic (capacity checks, duplicate prevention)

---

## CI/CD Pipeline

GitHub Actions runs on every push/PR to `main`:

1. **Test** — spins up a real Postgres service, runs migrations, executes all tests
2. **Build** — builds and pushes Docker image to Docker Hub (main branch only)
3. **Deploy** — triggers deployment webhook (configure in GitHub secrets)

**Required GitHub Secrets:**
```
DOCKER_USERNAME    # Docker Hub username
DOCKER_PASSWORD    # Docker Hub password/token
DEPLOY_WEBHOOK_URL # Your hosting provider webhook
```

---

## Project Structure

```
eventsphere/
├── src/
│   ├── graphql/
│   │   ├── typeDefs/      # GraphQL schema
│   │   └── resolvers/     # Modular resolvers (auth, event, user, rsvp, category)
│   ├── services/
│   │   └── weather.service.js  # OpenWeatherMap integration + cache
│   ├── utils/
│   │   ├── auth.js        # JWT + bcrypt helpers
│   │   └── logger.js      # Winston logger
│   └── index.js           # Express + Apollo entrypoint
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Demo data
├── tests/
│   ├── unit/              # Weather service, auth utils
│   └── integration/       # Full GraphQL resolver tests
├── frontend/
│   └── index.html         # SPA frontend
├── .github/workflows/
│   └── ci.yml             # CI/CD pipeline
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Future Improvements

1. **WebSocket subscriptions** — real-time RSVP count updates via GraphQL subscriptions
2. **Email notifications** — send confirmation emails on RSVP (SendGrid/Resend)
3. **Image uploads** — S3/Cloudflare R2 for event cover images
4. **Redis caching** — replace in-memory weather cache with Redis for multi-instance deployments
5. **Rate limiting** — per-IP rate limiting on auth mutations to prevent brute force
6. **Pagination cursors** — switch from offset to cursor-based pagination for large datasets
7. **Maps integration** — embed Google Maps for event location visualization
8. **Analytics dashboard** — admin view with event performance metrics
9. **Recurring events** — support weekly/monthly recurring event patterns
10. **Mobile app** — React Native client consuming the same GraphQL API

## Deployment (Railway)

EventSphere can be deployed to Railway in minutes.

### Steps

1. Go to [railway.app](https://railway.app) and sign up for free
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `eventsphere` repository
4. Add a PostgreSQL database:
   - Click **New** → **Database** → **PostgreSQL**
5. Set environment variables in Railway dashboard:

DATABASE_URL=<auto-filled by Railway>
JWT_SECRET=your-secret-key
OPENWEATHER_API_KEY=your-key
NODE_ENV=production
PORT=4000

6. Run migrations:
   - Go to Railway shell and run: `npx prisma migrate deploy`
7. Your app will be live at the Railway-provided URL

### Docker Deployment
```bash
docker compose up -d
```
This starts the app and PostgreSQL database together.
