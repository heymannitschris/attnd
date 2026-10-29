# Attnd

Mobile first event platform built with Next.js, Supabase and Stripe.

## Backend setup

1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations` in filename order with the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and add the project URL, publishable key and service role key.
4. In Supabase Auth, enable the login providers you want to use. Email magic links work with the email provider; phone login also needs an SMS provider; Google and Apple need their OAuth credentials and callback URLs.
5. Add `https://YOUR_DOMAIN/auth/callback` and the local callback URL to the Supabase redirect allow list.
6. Add a Stripe secret key and create a webhook for `POST /api/stripe/webhook`. Subscribe it to `checkout.session.completed` and `checkout.session.expired`, then add the signing secret to `.env.local`.
7. Set `NEXT_PUBLIC_APP_URL` to the deployed app URL.
8. Configure `RESEND_API_KEY` and `EMAIL_FROM` for invitation and transfer emails.
9. Configure the APNs key, team ID and bundle ID from `.env.example`. Enable Push Notifications for the Xcode target and upload the same APNs key details to the deployment.
10. Complete Stripe Connect onboarding from the withdrawal screen before creating real host or affiliate payouts.

The service role key is server only. Never expose it with a `NEXT_PUBLIC_` prefix.

## What is persisted

- Supabase Auth sessions, profiles and onboarding details
- Draft and published events, schedules, expectations, locations and media
- Ticket types, Stripe orders, issued tickets and QR check-ins
- Affiliate attribution, commissions and Stripe Connect payout records
- Event invitations, ticket transfers, in-app notifications and APNs devices
- Public event media and private ownership rules through Row Level Security

Stripe Embedded Checkout handles card and wallet availability directly inside Attnd on the website and in the native app shell. Adaptive Pricing is enabled so eligible customers can see localized currencies. Promotion codes are entered in Stripe Checkout and must be created in Stripe.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```
