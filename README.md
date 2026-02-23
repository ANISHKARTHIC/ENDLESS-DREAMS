# The Endless Dreams

**AI-Powered Dynamic Travel Intelligence**

A full-stack web application that uses algorithmic intelligence to craft, monitor, and dynamically adapt travel itineraries in real-time. Built for hackathon demonstration with production-quality architecture.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────┐
│   Next.js 16    │────▶│     Django REST API       │
│   React 19      │     │   DRF + JWT Auth          │
│   Tailwind v4   │     │                           │
│   Framer Motion │◀───▶│   WebSocket (Channels)    │
│   Mapbox GL     │     │   Celery Workers          │
└─────────────────┘     └──────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │    AI Engine        │
                    │  • Scoring Engine   │
                    │  • Route Optimizer  │
                    │  • Replanner        │
                    │  • Health Calculator│
                    └────────────────────┘
```

## Key Features

- **Weighted Scoring Engine**: `Score = (Interest × W1) + (Distance × W2) - (Risk × W3) - (Fatigue × W4)`
- **Route Optimization**: Nearest-neighbor heuristic with time-window constraints
- **Dynamic Replanning**: Only affected segments are replanned; locked items stay untouched
- **Stability Index**: Real-time trip health from budget, risk, weather, and schedule metrics
- **Weather Integration**: Live weather monitoring with indoor auto-swap during bad conditions
- **Drag-and-Drop**: Reorder itinerary items with real-time persistence
- **Real-time Updates**: WebSocket-powered live notifications

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| UI | Framer Motion, Lucide Icons, Glassmorphism design |
| Maps | Mapbox GL JS, react-map-gl |
| Backend | Django 6, Django REST Framework 3.16 |
| Real-time | Django Channels, WebSocket |
| Background | Celery 5.6 with Redis broker |
| Database | PostgreSQL (SQLite dev fallback) |
| AI/ML | Custom scoring engine (no LLM for optimization) |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Redis (optional - falls back to in-memory)
- PostgreSQL (optional - falls back to SQLite)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv ../venv
# Windows
..\venv\Scripts\activate
# macOS/Linux
source ../venv/bin/activate

# Install dependencies
pip install django djangorestframework djangorestframework-simplejwt
pip install django-cors-headers channels daphne celery redis
pip install psycopg2-binary requests

# Apply migrations
python manage.py migrate

# Seed sample data (40 places across 4 cities)
python manage.py seed_places

# Run development server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

All external APIs have mock fallbacks — the app works fully offline.

## Project Structure

```
backend/
├── config/              # Django settings (base/dev/prod), ASGI, Celery, URLs
├── users/               # Custom user model with travel preferences
├── places/              # Place catalog with real-time metrics
├── trips/               # Trip model and generation endpoint
├── itineraries/         # Itinerary items with ordering, locking, scoring
├── monitoring/          # Replan events, weather cache, Celery tasks
├── feedback/            # User feedback and ratings
├── ai_engine/           # Core AI modules
│   ├── scoring.py       # Weighted scoring formula
│   ├── optimizer.py     # Greedy nearest-neighbor route optimizer
│   ├── replanner.py     # Partial dynamic replanning
│   ├── health.py        # Stability index calculator
│   └── llm_layer.py     # Natural language interface (NL only)
├── services/            # Weather, Maps, LLM API abstractions
├── websockets/          # Django Channels consumers
└── seed/                # Sample data for 4 cities

frontend/
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── page.tsx           # Landing page
│   │   ├── dashboard/page.tsx # Trip creation dashboard
│   │   └── trip/[id]/page.tsx # Trip detail with live updates
│   ├── components/
│   │   ├── ui/          # Design system (Button, Card, Badge, etc.)
│   │   ├── layout/      # Navbar, Footer
│   │   ├── trip/        # Trip-specific components
│   │   └── map/         # Mapbox map visualization
│   ├── hooks/           # WebSocket hook
│   ├── lib/             # API client, utilities
│   ├── types/           # TypeScript interfaces
│   └── styles/          # Tailwind CSS with dark mode
```

## AI Engine Details

### Scoring Formula

```
Score = (Interest_Match × W1) + (Distance_Score × W2) - (Risk × W3) - (Fatigue × W4)
```

Weights dynamically adjust based on:
- **Budget pressure**: Increases cost sensitivity when budget is tight
- **Time pressure**: Prioritizes nearby places on short trips
- **Pace setting**: Adjusts activity density and buffer times

### Replanning

Triggered by weather changes, traffic data, or closures. Only affected items are replanned:
1. Identify affected items (weather-sensitive outdoor activities)
2. Find indoor alternatives with 1.3x score boost
3. Recalculate timing for affected days only
4. Notify via WebSocket in real-time

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/trips/generate/` | POST | Generate AI-optimized itinerary |
| `/api/v1/trips/{id}/` | GET | Trip details |
| `/api/v1/trips/{id}/health/` | GET | Stability index + components |
| `/api/v1/trips/{id}/itinerary/active/` | GET | Active itinerary with items |
| `/api/v1/itineraries/{id}/reorder/` | POST | Reorder items (drag-and-drop) |
| `/api/v1/itineraries/items/{id}/lock/` | POST | Toggle item lock |
| `/api/v1/places/city/{city}/` | GET | Places by city |
| `/api/v1/weather/` | GET | Current weather |
| `ws://*/ws/trip/{id}/` | WS | Real-time trip updates |

## Design

- **Glassmorphism** with backdrop blur and translucent layers
- **Dark mode** by default with smooth theme transitions
- **Framer Motion** animations throughout
- **Mobile-responsive** with adaptive layouts
- Minimal, premium aesthetic — no developer demo feel

---

Built with ❤️ for Hackathon
