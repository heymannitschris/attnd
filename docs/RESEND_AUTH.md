# Attnd email delivery

Resend sending domain: `mail.attnd.space`. The required DKIM and sending CNAME records are managed in Vercel DNS for `attnd.space`.

The onboarding email flow uses Supabase Auth's six-digit OTP. The SMTP configuration is in `supabase/config.toml` and reads its password from the `RESEND_API_KEY` environment variable. To enable delivery to users beyond the Supabase project team, verify `mail.attnd.space` in Resend, provide that secret locally, then push the Auth configuration to Supabase:

| Setting | Value |
| --- | --- |
| Sender email | `login@mail.attnd.space` |
| Sender name | `Attnd` |
| SMTP host | `smtp.resend.com` |
| SMTP port | `465` |
| SMTP username | `resend` |
| SMTP password | A Resend sending API key, stored only in Supabase's secret SMTP setting |

For the app's invitation and ticket email API, store a Resend sending API key as `RESEND_API_KEY` and `EMAIL_FROM=Attnd <tickets@mail.attnd.space>` in Vercel's server-side environment. Do not expose this key through a `NEXT_PUBLIC_` variable.

After activation, request an OTP for a non-team test address, verify that the email arrives from `login@mail.attnd.space`, and enter the code on the onboarding screen. The Resend DNS records can take time to be marked verified even after public DNS resolves.
