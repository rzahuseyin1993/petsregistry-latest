# Pet Palace Hub — Payment Integration & Testing Plan

**Project:** Pet Palace Hub  
**For:** Client review and step-by-step execution  
**Status:** Payment integration **not yet live** on production Supabase — complete **Phase 2 (Implement)** before testing in Phases 4–5.

**Tester:** _________________________  
**Date started:** _________________________  
**Supabase project ref:** _________________________  

**Legend:** ☐ Not started | ☑ Done | ✗ Blocked (note in Issues)

---

## Overview — 6 phases

| Phase | Name | Goal |
|:-----:|------|------|
| **1** | Prerequisites | Site, database, and admin access ready |
| **2** | **Implement** payment functions | Deploy backend + confirm app wiring (do this before testing) |
| **3** | Configure keys & webhooks | Client keys in Admin; Stripe/PayPal dashboards connected |
| **4** | Test Stripe | End-to-end flows in **test mode** |
| **5** | Test PayPal | End-to-end flows in **sandbox** |
| **6** | Verify & report | Admin checks, known limits, sign-off for go-live |

---

## Phase 1 — Prerequisites

**Goal:** Foundation is ready before any payment work.

| # | Task | Done | Notes |
|---|------|:----:|-------|
| 1.1 | Website runs locally or on staging URL | ☐ | |
| 1.2 | `.env` points to **external** Supabase (`VITE_SUPABASE_URL`, anon key) | ☐ | |
| 1.3 | All database migrations applied (`supabase db push`) | ☐ | |
| 1.4 | Admin user exists (`user_roles` = `admin`) | ☐ | |
| 1.5 | Client provides keys — **test/sandbox first** | ☐ | Stripe: `pk_test_` + `sk_test_` · PayPal: sandbox Client ID + Secret |
| 1.6 | Agree scope: which paid features must work at launch | ☐ | Membership, Donate, Certificate credits, Flyer (see Phase 6) |

**Phase 1 complete:** ☐ Yes → continue to Phase 2

---

## Phase 2 — Implement payment functions (required before testing)

**Goal:** Payment code from the Lovable project is **deployed and working** on your Supabase project.  
**Note:** Source code already exists in the repo; this phase is **deploy + verify**, not build from scratch.

### 2.1 Link and deploy Supabase

| # | Task | Done | Notes |
|---|------|:----:|-------|
| 2.1.1 | Link CLI to project: `supabase link --project-ref [YOUR_REF]` | ☐ | |
| 2.1.2 | Deploy payment edge functions (see list below) | ☐ | |
| 2.1.3 | Confirm functions appear in Supabase Dashboard → Edge Functions | ☐ | |

**Functions to deploy:**

| Function | Role |
|----------|------|
| `save-payment-settings` | Admin saves Stripe/PayPal keys to database |
| `membership-checkout` | Membership → Stripe or PayPal checkout URL |
| `donation-checkout` | Donations → Stripe or PayPal checkout URL |
| `certificate-checkout` | Certificate credits + admin “test connection” |
| `flyer-checkout` | Lost Pet Flyer subscription checkout |
| `stripe-webhook` | Marks payments complete after Stripe checkout |
| `paypal-webhook` | Marks payments complete after PayPal checkout |

### 2.2 Confirm database support

| # | Task | Done | Notes |
|---|------|:----:|-------|
| 2.2.1 | Table `payment_settings` exists (stores keys per provider) | ☐ | |
| 2.2.2 | Tables used by webhooks exist: `donations`, `memberships`, `certificate_credits`, `flyer_subscriptions`, etc. | ☐ | |
| 2.2.3 | `site_settings` has service pricing keys (or set in Admin → Payments) | ☐ | |
| 2.2.4 | `membership_plans` has at least one active plan | ☐ | |

### 2.3 Confirm frontend is wired (no new UI needed if repo unchanged)

| # | Task | Done | Notes |
|---|------|:----:|-------|
| 2.3.1 | **Admin → Payments** calls `save-payment-settings` | ☐ | |
| 2.3.2 | **Membership** page calls `membership-checkout` | ☐ | |
| 2.3.3 | **Donate** page calls `donation-checkout` | ☐ | |
| 2.3.4 | **Dashboard → Certificates** calls `certificate-checkout` for buying credits | ☐ | |
| 2.3.5 | **Flyer Builder** calls `flyer-checkout` when purchase required | ☐ | |

### 2.4 Smoke-test functions (no real money yet)

| # | Task | Done | Notes |
|---|------|:----:|-------|
| 2.4.1 | Invoke `save-payment-settings` as admin — no 401/403 | ☐ | After keys saved in Phase 3 |
| 2.4.2 | Edge function logs open — no crash on deploy | ☐ | Supabase → Functions → Logs |

**Phase 2 complete:** ☐ Yes → continue to Phase 3  
**If blocked:** Do not start Phase 4 until all checkout + webhook functions are deployed.

---

## Phase 3 — Configure keys & webhooks

**Goal:** Client keys are stored securely; gateways can notify your server after payment.

### 3.1 Admin panel

| # | Task | Done | Notes |
|---|------|:----:|-------|
| 3.1.1 | Log in as admin → **Admin → Payments** | ☐ | |
| 3.1.2 | Enter Stripe Publishable + Secret keys → enable Stripe → **Save** | ☐ | |
| 3.1.3 | Click **Test Stripe Connection** → success | ☐ | |
| 3.1.4 | Enter PayPal Client ID + Secret → enable PayPal → **Save** | ☐ | |
| 3.1.5 | Click **Test PayPal Connection** → success | ☐ | |
| 3.1.6 | Save **service pricing** (membership, certificate, flyer, directory) | ☐ | |

### 3.2 Webhooks (required for membership/donations to activate)

| # | Task | Done | Notes |
|---|------|:----:|-------|
| 3.2.1 | **Stripe Dashboard** → Webhook endpoint: `https://[PROJECT-REF].supabase.co/functions/v1/stripe-webhook` | ☐ | |
| 3.2.2 | Stripe events: at least `checkout.session.completed` (+ subscription events if using recurring) | ☐ | |
| 3.2.3 | **PayPal Developer** → Webhook: `https://[PROJECT-REF].supabase.co/functions/v1/paypal-webhook` | ☐ | |
| 3.2.4 | PayPal events: `PAYMENT.CAPTURE.COMPLETED`, `BILLING.SUBSCRIPTION.ACTIVATED`, etc. | ☐ | |

**Phase 3 complete:** ☐ Yes → continue to Phase 4

---

## Phase 4 — Test Stripe (test mode)

**Test card:** `4242 4242 4242 4242` · any future expiry · any CVC

| # | Flow | Steps | Done | Notes |
|---|------|-------|:----:|-------|
| 4.1 | Membership | Sign in → `/membership` → Stripe → pay → membership active in dashboard | ☐ | |
| 4.2 | Donation (logged in) | `/donate` → package → Stripe → completed in Admin → Donations | ☐ | |
| 4.3 | Donation (guest) | Sign out → donate with email → Stripe → completed | ☐ | |
| 4.4 | Certificate credits | Dashboard → Certificates → Buy credits → Stripe → balance increases | ☐ | |
| 4.5 | Pay certificate with credit | Use 1 credit on unpaid certificate → shows **Paid** | ☐ | |
| 4.6 | Flyer (if paid for non-members) | Flyer Builder → purchase → Stripe → access granted | ☐ | N/A if members only |

**Phase 4 complete:** ☐ All pass | ☐ Issues in log below

---

## Phase 5 — Test PayPal (sandbox)

Use PayPal **sandbox buyer** account.

| # | Flow | Done | Notes |
|---|------|:----:|-------|
| 5.1 | Membership → PayPal → active membership | ☐ | |
| 5.2 | Donation → PayPal → completed in admin | ☐ | |
| 5.3 | Certificate credits → PayPal → balance increases | ☐ | |
| 5.4 | Flyer purchase → PayPal (if applicable) | ☐ | N/A |

**Phase 5 complete:** ☐ All pass | ☐ Issues in log below

---

## Phase 6 — Verify, limitations & client sign-off

### 6.1 Admin verification

| # | Check | Done | Notes |
|---|-------|:----:|-------|
| 6.1.1 | Admin → Memberships — test records correct status & payment id | ☐ | |
| 6.1.2 | Admin → Donations — status **completed**, correct method | ☐ | |
| 6.1.3 | Stripe / PayPal dashboards show test payments | ☐ | |
| 6.1.4 | Supabase function logs — no repeating checkout/webhook errors | ☐ | |

### 6.2 Out of scope today (confirm with client — not bugs)

| Feature | Actual behavior | Client informed |
|---------|-----------------|:---------------:|
| Store / cart checkout | Order saved as **pending** — no card charge | ☐ |
| Certificate “Pay” button | Uses **credits**, not direct card | ☐ |
| Business directory | **Paid** via active membership, not separate checkout | ☐ |

### 6.3 Go-live (only after Phases 4–5 pass in test mode)

| # | Task | Done | Notes |
|---|------|:----:|-------|
| 6.3.1 | Replace with **live** Stripe keys in Admin → Payments | ☐ | |
| 6.3.2 | Replace with **live** PayPal credentials | ☐ | |
| 6.3.3 | Webhooks active in **live** mode on both gateways | ☐ | |
| 6.3.4 | Re-run admin connection tests with live keys | ☐ | |
| 6.3.5 | Optional: one small live payment per gateway | ☐ | |

### 6.4 Summary for client

| Item | Result |
|------|--------|
| Phase 2 — Payment functions implemented/deployed | ☐ Yes ☐ No |
| Phase 3 — Keys + webhooks configured | ☐ Yes ☐ No |
| Phase 4 — Stripe tests | ☐ Pass ☐ Fail |
| Phase 5 — PayPal tests | ☐ Pass ☐ Fail |
| Phase 6 — Limitations understood | ☐ Yes |
| **Recommendation** | ☐ Ready for live keys ☐ Not ready |

---

## Issues log

| # | Phase | Problem | Action taken |
|---|-------|---------|--------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

**Client approval:** _________________________ **Date:** ___________
