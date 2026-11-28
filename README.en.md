# AOUN | عون

**لك في كل مكان عون**

[العربية](README.md)

AOUN is a mobile guide to accessibility features at public places in Riyadh, designed for people with disabilities, older adults and their companions. Visitors can look up a place by name, search for the facilities they need or explore nearby places on a map.

## Why AOUN?

One visitor may need a step-free entrance to get into a building. Another may rely on Braille signs to find their way once inside. AOUN lists each facility alongside the overall accessibility level. When choosing a restaurant, for example, a visitor can check whether it lists both an accessible entrance and an accessible restroom. Visitor reviews and photos add practical details, such as where to find the entrance someone used.

AOUN was developed as a software engineering project at King Saud University and is available in Arabic and English.

## What you can do with AOUN

- **Discover places.** Guests can search by name or explore the map, then narrow results by venue category and nine accessibility features, including lifts, designated parking and accessible restrooms.
- **Plan a visit.** Each listing includes the address, a photo, the overall accessibility level and the availability of individual facilities. Members can save places to revisit later.
- **Share an access experience.** After a visit, members can rate ease of access, write a review and attach photos of entrances or facilities. They can edit or delete their contributions from My Ratings.
- **Correct a listing.** Members can report incorrect, missing or outdated information. An administrator reviews the report, and its author can track the status and read the resolution or reason for rejection in My Reports.

## How AOUN describes accessibility

AOUN records nine facilities individually: ramps, lifts, accessible restrooms, designated parking, accessible entrances, tactile paths, Braille signs, visual alerts and assistive listening systems. Selecting several filters returns places with **all** the selected facilities.

A listing has two distinct indicators. The **accessibility level** comes from the proportion of applicable facilities recorded as available. At 70% or above the listing is classified as accessible, below 70% with some facilities available it is partially accessible, and at zero it is classified as inaccessible. The level stays unset when records are incomplete or no facilities apply. The **star rating** reflects visitors’ experiences. A visitor can give a place five stars for their own visit while the facility record still classifies it as partially accessible.

## Maintaining the directory

Administrators maintain place listings and facility records, manage accounts and reviews, and review incoming reports about the directory.

## Architecture

The mobile client calls FastAPI for place discovery and review photo processing. It also connects directly to Supabase for authentication and account operations. Database policies and functions check the caller’s identity and permissions for member and administrator actions.

| Layer | Tools | Responsibility |
|---|---|---|
| Mobile app | React Native · TypeScript · Expo SDK 54 · Expo Router | Screens, navigation and a shared place detail view for search and map results. |
| Maps and location | Expo Location · react-native-maps · Leaflet | Device location and place markers on mobile and web. |
| Place and photo API | Python · FastAPI · Uvicorn · Pillow | Place queries, review photo validation and signed access to private images. |
| Accounts and storage | Supabase Auth · PostgreSQL · Supabase Storage | Sign-in, favorites, reviews, reports, photos and member/admin permissions. |

## Repository structure

```text
AOUN-APP/
├── mobile/
│   ├── app/
│   │   ├── home.tsx
│   │   ├── filters.tsx
│   │   ├── nearby.tsx
│   │   ├── live-places/[id].tsx
│   │   └── admin/
│   ├── services/
│   │   ├── places.ts
│   │   ├── reports.ts
│   │   └── supabase.ts
│   ├── auth/
│   ├── ui/
│   ├── theme/
│   ├── assets/
│   └── tests/
├── backend/
│   ├── main.py
│   ├── review_photos.py
│   ├── review_photo_cleanup.py
│   └── tests/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
├── docs/
│   ├── api.md
│   └── database.md
├── .github/workflows/
├── README.md
└── README.en.md
```

## Working on the project

To follow a search from screen to storage, start with the [filter screen](mobile/app/filters.tsx) and the [places client](mobile/services/places.ts) that builds the request. The [API server](backend/main.py) handles the query. The [database migrations](supabase/migrations/) define the tables, classification rules and permissions.

**Development environment:** Python 3.12, Node.js 22.13 or later in the 22.x line, and a development Supabase project. Follow the [setup guide](docs/setup.md) for database initialization and dependencies, and the [account guide](docs/auth-admin.md) for sign-in and recovery redirects. Configuration templates are available for the [mobile client](mobile/.env.example) and [backend](backend/.env.example).

After setup, run each command in a separate terminal from the repository root on macOS. The second opens the iOS simulator using an SDK 54-compatible Expo Go client.

```bash
(cd backend && .venv/bin/python -m uvicorn main:app --reload --port 8000)
```

```bash
(cd mobile && npx expo start --go --ios)
```

### Tests

Mobile tests cover account links, favorites, reviews, reports and review photos. Backend tests exercise place queries and image handling. The [SQL suite](supabase/tests/) checks discovery, account, admin and review photo behavior against a test database. To run the mobile and backend checks after installing dependencies:

```bash
(cd mobile && npm run typecheck && node --test tests/*.test.cjs)
(cd backend && .venv/bin/python -m unittest discover -s tests)
```

[Place API contract](docs/api.md) · [Database documentation](docs/database.md)
