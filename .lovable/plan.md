
The user wants a comprehensive automated browser audit of four core flows: Flyer Builder, Profile Editor, QR/Public Pet URL, and Search. This is a testing task, not a code change — so I'll execute it with browser automation tools once approved.

Before presenting the plan, let me note key constraints from the codebase context:
- Logged-in flows (Flyer Builder, Edit Pet) require an authenticated session in the preview iframe. I cannot create accounts or log in without explicit approval.
- Lost flyer generation lives in `src/lib/generateLostFlyer.ts` (jsPDF, client-side). Triggered from `Dashboard.tsx` when a pet is marked Lost.
- Pet edit lives at `/dashboard/pets/:id/edit` (`EditPet.tsx`), supports image upload + webcam.
- Public pet URL pattern: `/pet/:id` (PetProfile.tsx), no login required.
- Search: `/search` is the public search page (logged-out friendly per memory).
- Right-click is disabled site-wide (content protection memory) — image saves via context menu won't work, that's intended.

## Test Plan

**Scope** — 4 flows on desktop (1280×720) + 1 mobile pass (390×844) for overlap check.

**1. Public flows (no auth needed)**
   - `/search` — type a query, verify results render and links work
   - `/pet/<id>` — open a public pet profile from search results, verify it renders without login and shows QR-related info
   - `/lost-pets` and `/lost-pets?type=found` — sanity check the homepage nav lands correctly

**2. Authenticated flows (require user approval to log in)**
   - `/dashboard` — locate a registered pet
   - Mark a pet as **Lost** → confirm `ReportLostDialog` opens and submits
   - Click **Download Lost Flyer** → capture console + network, confirm the PDF download is triggered (jsPDF `doc.save()` fires a blob download — I'll verify by watching for the click handler completing without console errors and inspecting the generated DOM/blob events)
   - `/dashboard/pets/:id/edit` — change a field (e.g., add a medical/description note), save, reload, verify persistence
   - Verify the in-app `WebcamCaptureDialog` opens when "Take Photo" is clicked (won't actually grant camera permission in headless browser — will just confirm dialog UI mounts)

**3. Mobile audit (390×844)**
   - Homepage, `/lost-pets`, `/search`, `/report-lost` — screenshot each, scan for overlaps, clipped text, broken layout

**4. Reporting**
   For each flow, I'll record: PASS/FAIL, console errors captured during the action, network failures (4xx/5xx), and visual issues from screenshots. Final summary will list:
   - Console errors (per flow)
   - Broken buttons / 404 links
   - Mobile overlap issues
   - Anything that needs a code fix

**What I need from you before starting**

```text
Auth needed for:
  - Flyer Builder test (mark pet Lost + download flyer)
  - Profile Editor test (edit + persist)
Public flows can run without you.
```

Two questions to unblock the auth-gated portion — please answer in your reply:

1. **Login** — Are you already logged into the preview? If yes, I'll just proceed. If no, do you want to (a) log in yourself in the preview tab, then I'll continue, or (b) provide test credentials I can use?

2. **Destructive actions** — Marking a pet as "Lost" triggers `ReportLostDialog` which writes a row to `lost_reports` and may send notifications. OK to proceed on a real pet (I'll mark it back to "registered" after), or do you want me to skip that step and only test the flyer download path on an already-lost pet?

Once you answer (or say "go ahead, I'm logged in, use any pet"), I'll run the full audit and post a structured report.
