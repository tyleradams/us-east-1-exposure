# US-EAST-1 Exposure Tracker

A simple static website that tracks which services still have exposure to AWS US-EAST-1 region outages.

## Features

- **Simple JSON data storage** - All data in one normalized JSON file
- **Client-side search** - Fast, in-browser filtering
- **Append-only history** - Track impact evidence over time
- **Static export** - No backend needed, deploys anywhere
- **Auto-deploy on push** - Push to GitHub, auto-deploy on Vercel

## Tech Stack

- Next.js 14 (App Router, Static Export)
- TypeScript
- Tailwind CSS
- Client-side data querying (no database)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
```

This creates a static export in the `out/` directory.

## Data Structure

All data lives in `/data/tracking.json` with three normalized tables:

### Events
```json
{
  "id": "aws-useast1-2025-10-20",
  "date": "2025-10-20T14:30:00Z",
  "title": "US-EAST-1 DNS/DynamoDB Outage",
  "description": "...",
  "awsServicesAffected": ["Route53", "DynamoDB"],
  "sources": [...],
  "createdAt": "2025-10-23T10:00:00Z"
}
```

### Services
```json
{
  "id": "fortnite",
  "name": "Fortnite",
  "company": "Epic Games",
  "logoUrl": "https://logo.clearbit.com/epicgames.com",
  "url": "https://fortnite.com",
  "category": "gaming",
  "features": [
    {
      "id": "matchmaking",
      "name": "Matchmaking",
      "description": "Ability to join and start game matches"
    }
  ],
  "createdAt": "2025-10-23T10:00:00Z"
}
```

### Event Impacts (joins events + services + features)
```json
{
  "id": "impact-001",
  "eventId": "aws-useast1-2025-10-20",
  "serviceId": "fortnite",
  "featureId": "matchmaking",
  "impactType": "full_outage",
  "description": "Matchmaking completely unavailable during outage window",
  "verificationStatus": "verified",
  "sourceUrl": "https://status.epicgames.com/incidents/xyz",
  "sourceType": "official_status_page",
  "createdAt": "2025-10-23T10:00:00Z"
}
```

## Adding New Data

### To add a new event:
1. Edit `/data/tracking.json`
2. Add a new object to the `events` array
3. Commit and push

### To add a new service:
1. Edit `/data/tracking.json`
2. Add a new object to the `services` array with its features
3. Commit and push

### To add impact evidence:
1. Edit `/data/tracking.json`
2. Add a new object to the `eventImpacts` array
3. Reference existing `eventId`, `serviceId`, and `featureId`
4. Commit and push

**Remember:** Everything is append-only. Don't edit existing entries, add new ones instead.

## Deployment

### Deploy to Vercel (Recommended)

1. Push this repo to GitHub

2. Go to [vercel.com](https://vercel.com) and click "New Project"

3. Import your GitHub repository

4. Vercel auto-detects Next.js - no config needed

5. Click "Deploy"

6. Done! Every push to `main` auto-deploys

### Deploy to Other Hosts

Since this is a static export, you can deploy the `out/` directory anywhere:

```bash
npm run build
# Upload the out/ directory to any static host
```

Works with:
- Netlify
- GitHub Pages
- Cloudflare Pages
- Any static hosting

## Project Structure

```
/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page with search
│   └── globals.css         # Tailwind CSS
├── data/
│   └── tracking.json       # All data (events, services, impacts)
├── lib/
│   └── data.ts             # Data helpers and types
├── next.config.js          # Static export config
├── tailwind.config.js      # Tailwind config
└── package.json
```

## Impact Types

- `full_outage` - Feature completely unavailable
- `degraded` - Feature slow or partially working
- `no_impact` - Explicitly confirmed NOT affected during outage
- `unknown` - Unclear or conflicting reports

## Verification Statuses

- `verified` - Confirmed accurate from official sources
- `unverified` - Claim exists but not independently confirmed
- `user_reported` - Based on user reports, not official confirmation

## Future Enhancements

Ideas for later:

- Automated data ingestion from AWS Health Dashboard
- RSS/email alerts for new US-EAST-1 events
- Charts showing exposure trends over time
- API for programmatic access
- Migration to real database when update frequency increases

## License

MIT
