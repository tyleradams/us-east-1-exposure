# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **static Next.js website** that tracks which services have exposure to AWS US-EAST-1 region outages. All data is stored in a single JSON file (`data/tracking.json`) and the site is fully client-side with no backend.

**Key architectural decision**: This is built as a static export (`output: 'export'` in next.config.js), meaning:
- No server-side rendering or API routes
- Everything must work in the browser
- The entire site can be deployed to any static host (Vercel, Netlify, GitHub Pages, etc.)
- All data operations happen client-side

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (opens at http://localhost:3000)
npm run dev

# Build for production (outputs to out/ directory)
npm run build

# Run linter
npm run lint

# Start production server (after building)
npm start
```

## Architecture

### Data Flow (Normalized JSON → Client-side Query → React State)

1. **Single source of truth**: `data/tracking.json` contains three normalized tables:
   - `events`: AWS outage events
   - `services`: Services/products with their features
   - `eventImpacts`: Join table linking events → services → features with impact details

2. **Data layer**: `lib/data.ts` provides:
   - TypeScript interfaces for all data types
   - Helper functions to join normalized data (e.g., `getEnrichedServices()`)
   - Client-side search function (`searchServices()`)
   - All data querying is done via these helpers, not direct JSON access

3. **UI layer**: `app/page.tsx` is a client component (`'use client'`) that:
   - Uses React state for search query
   - Calls data helpers to get filtered/enriched results
   - Renders expandable service cards with nested feature impacts

### File Structure

```
app/
  layout.tsx         # Root layout with metadata
  page.tsx           # Main page (client component with search UI)
  globals.css        # Tailwind base styles

lib/
  data.ts            # Data types, helpers, and search logic

data/
  tracking.json      # All data (events, services, eventImpacts)
```

### TypeScript Path Aliases

- `@/*` maps to project root (configured in tsconfig.json)
- Example: `import { data } from '@/lib/data'` or `import trackingData from '@/data/tracking.json'`

## Data Schema

### Events
AWS outage events with metadata about what AWS services were affected.

```typescript
{
  id: string                    // Unique identifier (e.g., "aws-useast1-2025-10-20")
  date: string                  // ISO 8601 timestamp of event
  title: string                 // Human-readable title
  description: string           // Detailed description
  awsServicesAffected: string[] // AWS services that went down (e.g., ["Route53", "DynamoDB"])
  sources: Array<{              // Evidence sources
    url: string
    type: string
    createdAt: string
  }>
  createdAt: string             // When this record was added
}
```

### Services
Services/products that may be affected by US-EAST-1 outages. Each service has nested features.

```typescript
{
  id: string                    // Unique identifier (e.g., "fortnite")
  name: string                  // Display name
  company: string               // Company that owns the service
  logoUrl: string               // Logo URL (uses Clearbit or fallback)
  url: string                   // Service homepage
  category: string              // Category (e.g., "gaming", "productivity")
  features: Feature[]           // Nested features array (see below)
  createdAt: string             // When this record was added
}
```

**Features** (nested within services):
```typescript
{
  id: string                    // Unique within service (e.g., "matchmaking")
  name: string                  // Feature name
  description: string           // What the feature does
}
```

### Event Impacts
Join table that links events to specific service features with impact details.

```typescript
{
  id: string                                          // Unique identifier
  eventId: string                                     // References events[].id
  serviceId: string                                   // References services[].id
  featureId: string                                   // References services[].features[].id
  impactType: 'full_outage' | 'degraded' | 'no_impact' | 'unknown'
  description: string                                 // What happened during this event
  verificationStatus: 'verified' | 'unverified' | 'user_reported'
  sourceUrl: string                                   // Evidence URL
  sourceType: string                                  // Source type (e.g., "official_status_page")
  createdAt: string                                   // When this impact record was added
}
```

## Data Editing Rules

**CRITICAL**: Data in `tracking.json` is **append-only**. Never edit existing records, only add new ones.

### Adding a new event
Add a new object to the `events` array in `tracking.json`.

### Adding a new service
Add a new object to the `services` array with its `features` array populated.

### Adding impact evidence
Add a new object to the `eventImpacts` array, referencing existing `eventId`, `serviceId`, and `featureId`.

## Deployment

This project is configured for static export and can be deployed anywhere:

1. **Vercel** (recommended): Auto-deploys on push to main
2. **Other static hosts**: Run `npm run build` and upload the `out/` directory

The build output is fully static HTML/CSS/JS with no server dependencies.

## Common Patterns

### Data enrichment pattern
The `lib/data.ts` file uses an enrichment pattern to join normalized data:

```typescript
// Raw normalized data → Enriched data with joins
getEnrichedServices()  // Returns services with impact counts and exposure flags
getEnrichedImpacts()   // Returns impacts with service/event/feature objects joined
```

### Client-side search
Search is implemented via `searchServices(query)` which filters enriched services by:
- Service name
- Company name
- Category
- Feature name or description

### Logo fallback pattern
Service logos use Clearbit API with fallback to UI Avatars:
```typescript
onError={(e) => {
  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(service.name)}&background=random`
}}
```

## Next.js Configuration Notes

- **Static export mode**: `output: 'export'` in next.config.js
- **Image optimization disabled**: `images.unoptimized: true` (required for static export)
- **App Router**: Using Next.js 14 App Router (not Pages Router)
- **Client components**: Main page must be a client component for React hooks (search state)
