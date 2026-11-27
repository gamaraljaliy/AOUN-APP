# AOUN | عون

**لك في كل مكان عون**

[العربية](README.md)

AOUN is a mobile app for planning visits to public places in Riyadh. It serves people with disabilities, older adults and their companions. Two visitors to the same place may need different information: one might need a step-free entrance, another Braille signs or visual alerts. AOUN brings facility details and visitor experiences together so each person can decide whether a place suits their needs before setting out.

Developed as a software engineering project at King Saud University, AOUN is available in Arabic and English.

## What you can do with AOUN

- **Discover places.** Guests can search by name or explore the map, then narrow results by venue category and nine accessibility features, including lifts, designated parking and accessible restrooms.
- **Plan a visit.** Each listing includes the address, a photo, the overall accessibility level and the availability of individual facilities. Members can save places to revisit later.
- **Share an access experience.** After a visit, members can rate ease of access, write a review and attach photos of entrances or facilities. They can edit or delete their contributions from My Ratings.
- **Correct a listing.** Members can report incorrect, missing or outdated information. An administrator reviews the report, and its author can track the status and read the resolution or reason for rejection in My Reports.

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

## Developer documentation

[Local setup](docs/setup.md) · [Place API](docs/api.md) · [Database guide](docs/database.md)
