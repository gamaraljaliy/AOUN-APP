# AOUN | عون

**لك في كل مكان عون** · [العربية](README.md)

AOUN is a bilingual Arabic–English mobile guide to accessibility at public places in Riyadh. It brings facility records and visitor experiences together so people with disabilities, older adults and their companions can plan a visit.

A restaurant might earn five stars from one visitor while another still needs to know, “Can I get inside with my wheelchair and use the restroom?” In AOUN, a visitor can select **accessible entrance and accessible restroom** together. The search returns places that list both facilities, and each listing shows the details behind the result.

## Using AOUN

| Role | What they can do |
|---|---|
| Guest | Search by name or category, filter by any combination of nine accessibility features, and explore places on the map. |
| Member | Save places, review ease of access, attach facility photos, and edit or delete their reviews. Members can also report a listing and follow the administrator’s response. |
| Administrator | Add places, update facility records, review reports, record a resolution or rejection reason, and manage accounts and reviews. |

## How it works

The mobile app uses **React Native, TypeScript and Expo Router**. A search sends the selected facilities to **FastAPI**, which queries place records in **PostgreSQL**. The client also uses **Supabase Auth** for sign-in. Database policies govern member and administrator access.

- **Accessibility levels and visitor ratings.** A place’s level is calculated from the availability of applicable facilities. Stars capture individual experiences. The level stays unset when facility records are incomplete. [Classification query](supabase/migrations/20261124000100_place_card_photos.sql)
- **Review photos.** The backend validates images with Pillow and issues signed links to private review photos in Supabase Storage. [Photo handling](backend/review_photos.py)

## Repository structure

```text
mobile/
  app/                 Screens and navigation routes
  services/            Place queries and account operations
  ui/ · theme/         Interface components and visual theme
  tests/               Mobile tests
backend/
  main.py              Place API
  review_photos.py     Review photo processing
  tests/               Service tests
supabase/
  migrations/          Schema, classification rules and access policies
  seed.sql             Development data
  tests/               SQL tests
docs/                  Setup guides and data contracts
.github/workflows/     Continuous integration checks
```

## Run locally

Use Python 3.12, Node.js 22.13 or later in the 22.x line, and a development Supabase environment. Follow the [setup guide](docs/setup.md) to initialize the database and install dependencies. Configure the API address, Supabase URL and publishable key using the [mobile template](mobile/.env.example), and configure the photo service keys using the [backend template](backend/.env.example).

After setup, run each command in a separate terminal from the repository root. This example targets the iOS simulator on macOS with an SDK 54-compatible Expo client.

```bash
(cd backend && .venv/bin/python -m uvicorn main:app --reload --port 8000)
```

```bash
(cd mobile && npx expo start --go --ios)
```

## Run checks

```bash
(cd mobile && npm run typecheck && node --test tests/*.test.cjs)
(cd backend && .venv/bin/python -m unittest discover -s tests)
```

[GitHub Actions](.github/workflows/check.yml) also runs migrations and permission tests against PostgreSQL and checks what happens when a review photo is attached while a deletion is in progress.

[Place API contract](docs/api.md) · [Database design](docs/database.md) · [Account setup](docs/auth-admin.md)
