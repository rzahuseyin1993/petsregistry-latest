ISSUES TO FIX

1. Stripe webhook does not verify Stripe-Signature or use STRIPE_WEBHOOK_SECRET; spoofed requests could theoretically update the database.

2. PayPal webhook does not cryptographically verify that events came from PayPal.

3. Webhook URLs or project refs may point at the wrong Supabase project or mix test keys with live endpoints or Stripe test mode with production keys.

4. Stripe and PayPal may deliver the same webhook more than once; duplicate processing can grant certificate credits or other benefits twice unless events are tracked as processed.

5. Checkout success and cancel redirects may still use the browser Origin or Supabase host instead of the live public domain in some flows; users can land on wrong URLs after paying.

6. PayPal exposes capture id versus order id in different payloads; mismatches against payment_id stored in donations or orders can leave rows stuck as pending.

7. Edge functions invoked with service role sometimes trust client-supplied user id in the JSON body instead of enforcing the authenticated user id from the JWT.

8. upload.php on the server plus VITE_UPLOAD_TOKEN plus CORS must stay aligned; failures look like broken or intermittent images.

9. Database may still contain old Supabase Storage image URLs while new uploads use the cPanel server URL; mixed references cause inconsistent loading.

10. Pet Expert chat uses a separate chat-storage.php endpoint in addition to the main upload path; two pipelines increase failure modes unless both stay configured.

11. Donate and similar pages may ignore query parameters such as success=true after returning from payment so users see no confirmation.

12. Raw Stripe or PayPal errors shown to users are unclear; support needs clearer messages and correlation with gateway logs.

13. supabase/config.toml verify_jwt settings may not match how each function is called; some routes can return 401 unexpectedly or expose functions that should be public only to gateways.

14. JWT defaults on certain AI or checkout-related functions may block legitimate calls or allow the wrong callers unless each function is audited.


UPDATES TO IMPLEMENT

1. Implement Stripe webhook signature verification using the raw request body and STRIPE_WEBHOOK_SECRET stored in Edge secrets; reject invalid signatures with HTTP 400.

2. Implement PayPal webhook verification per current PayPal developer documentation including certificate or signature validation.

3. Add an idempotency store for processed Stripe and PayPal event ids so retries do not duplicate business logic.

4. Introduce a single helper or convention that resolves the public site URL from site_settings.site_url or a PUBLIC_SITE_URL secret and use it on every checkout redirect including membership-checkout, donation-checkout, certificate-checkout, and Stripe flyer checkout paths.

5. Audit every edge function that uses the service role key and enforce that user id comes from the JWT subject or matches it when the client sends userId.

6. Complete the frontend post-payment UX: read search params on donate and related routes, show success or cancel toasts, optionally refetch donation or order status for logged-in users.

7. Map common payment gateway failure codes to user-friendly messages and retain admin-visible detail or request ids for debugging.

8. Validate and document all Edge secrets needed in production including LOVABLE_API_KEY for AI functions, SMTP or API keys for send-smtp-email, VAPID for push-notifications, and Stripe webhook secret after verification is implemented.

9. Audit RLS policies and has_role checks for admin-only paths such as save-payment-settings and sensitive RPCs.

10. Plan migration or background cleanup for legacy Supabase Storage URLs in favor of server-hosted image URLs where policy requires images only on your server.

11. Either consolidate Pet Expert uploads with the main imageUpload flow or formally document two endpoints and rotate tokens safely.

12. Deploy or redeploy all seventeen edge functions after repo changes and run smoke tests for Stripe and PayPal in test mode for membership, donation, certificate purchase, and flyer checkout.

13. Configure Stripe Dashboard and PayPal Developer webhooks to the exact deployed function URLs on the production project reference.

14. Configure pg_cron or equivalent scheduled calls for cleanup-lost-reports and check-membership-expiry against the production project URL and service authorization.

15. Optional progressive web app work: manifest, service worker, install prompts for Safari add to home screen and broader installability.

16. Optional Android distribution via Capacitor or Trusted Web Activity with Play Store signing as a separate scope from the web app.
