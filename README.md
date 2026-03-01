# Travel Map
## [TRY IT LIVE!](https://travel-map-nine.vercel.app/)

Travel Map is a full-stack social travel planning app centered on a live, interactive map. Users can browse and search trips, save activities/lodging into personal plans, and view detailed trip content. For students, it creates a peer-powered way to see where classmates are going, how they plan, and what experiences are actually realistic on a student budget. Instead of relying on a travel agent or expensive packaged itineraries, students can use real trips from people like them to plan affordable, independent travel with more confidence.

---

## What this project does (feature-first)

### 1) Map-first travel discovery
- Interactive US-focused map powered by Leaflet.
- Trip markers show photo thumbnails and support rich selection states.
- Marker grouping by location: multiple trips in the same place can be browsed in-order.

### 2) Trip detail + full-screen exploration
- Left sidebar trip view with author, media, activities, and lodgings.
- Full-screen review mode for deeper trip browsing.
- Activity/lodging selection syncs with map markers so users can jump between content and geography.

### 3) Powerful trip search and filtering
- Search by trip title, author, activity text, and place text.
- Filter by tags and max cost.
- Structured results include matching trip plus matching sub-items (activities/lodgings).

### 4) Save-to-plans workflow
- Users can save/unsave activities and lodgings from trips.
- Dedicated Plans panel aggregates saved items across all trips.
- One-click open-trip from a saved plan entry.

### 5) Role-aware account experience
- Signup/signin flow with account type selection (`traveler` or `student`).
- Guided profile setup flow:
	- profile photo upload,
	- bio,
	- university selection (students) with search suggestions.
- Profile modal supports viewing user details and their trip history.

### 6) Profile discovery and viewing
- Open user profiles directly from trips and map-side interactions.
- View profile details such as name, bio, school, and profile image.
- Browse a user’s posted trips in one place to understand their travel style.
- Jump from a profile into any listed trip for deeper exploration.

### 7) Trip creator tools
- Floating quick-add menu for student users.
- Trip composer for:
	- regular trips,
	- pop-up posts/events with start/end time.
- Add lodgings and activities with per-item notes, costs, media, and map location.
- Cover image uploads with backend optimization.
- Trip deletion support for owner-managed content.

### 8) Pop-up/event behavior
- Pop-up posts are time bounded.
- Expired pop-ups are excluded from active display logic.

### 9) Image pipeline + media handling
- Authenticated image upload API.
- Server-side image optimization (WebP when possible, PNG/JPEG fallback).
- S3 object storage with organized key paths by folder/user/time.

### 10) Production-minded auth + session behavior
- Cookie-backed session support plus bearer token support for API calls.
- `/me` session validation flow.

### 11) Deployment path to AWS Lambda
- Flask backend can run locally and in AWS Lambda.
- Includes Lambda handler + Lambda Python base image Dockerfile.

---

## Tech stack

### Frontend
- Next.js 16 (App Router) + React 19 + TypeScript
- Leaflet for map rendering

### Backend
- Flask (Python)
- PostgreSQL on AWS RDS
- AWS S3 for image storage
- Docker Image in AWS ECR for Lambda execution

### APIs / data sources
- Nominatim (OpenStreetMap) for place search
- Hipolabs Universities API for college lookup

### Infra / deployment
- Local development: Next.js + Flask
- Serverless option: AWS Lambda + ECR image workflow
- Api: API Gateway routes request from frontend to lambda handler

---

## High-level architecture

```text
client (Next.js)
	├─ app routes/pages (signup, profile-setup, trips, map)
	├─ /api/places and /api/universities proxy routes
	└─ components (map, sidebars, profile modal, trip composer integrations)

server (Flask)
	├─ auth routes (create-user, login, me, logout)
	├─ profile routes (setup, update, user profile, my trips)
	├─ trips routes (list/get/create/delete + activities/lodgings)
	├─ plans routes (save/unsave + list)
	└─ uploads route (S3 image upload pipeline)
```

---

## Key API surfaces

### Auth
- `POST /create-user`
- `POST /login`
- `GET /me`
- `POST /logout`

### Profile
- `POST /profile/setup`
- `POST /profile/update`
- `GET /users/me/trips`
- `GET /users/:user_id/profile`

### Trips
- `GET /trips`
- `GET /trips/:trip_id`
- `POST /trips`
- `DELETE /trips/:trip_id`
- `POST /trips/:trip_id/lodgings`
- `POST /trips/:trip_id/activities`

### Plans
- `GET /users/me/plans`
- `POST /users/me/plans/activities/:activity_id`
- `POST /users/me/plans/lodgings/:lodge_id`

### Uploads
- `POST /uploads/images`

---

## Current project status

Travel Map already includes end-to-end core flows for:
- account creation/authentication,
- profile onboarding,
- map-based trip discovery,
- student trip/pop-up creation,
- save-to-plans behavior,
- media upload and optimization.

If you want, this README can be extended next with screenshots/GIFs and a short “Product Walkthrough” section tailored for recruiters or demo day.
