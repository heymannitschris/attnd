# Google and Apple sign-in

The onboarding UI shows each provider only when Supabase Auth reports it as enabled. Both providers are currently disabled in the hosted Attnd project until their vendor credentials are configured.

## Shared Attnd URLs

- Website origin: `https://www.attnd.space`
- Supabase provider callback: `https://jcakijceipjupbhanpij.supabase.co/auth/v1/callback`
- Web app callback: `https://www.attnd.space/auth/callback`
- iOS app callback: `com.ninjaworld.attndr://auth/callback`
- iOS bundle ID: `com.ninjaworld.attndr`

The iOS app starts Google and Apple OAuth in `ASWebAuthenticationSession`. The callback is exchanged for a Supabase session inside the app's `WKWebView`, where its PKCE verifier was created. Google's OAuth page must not be opened directly inside `WKWebView`.

## Google Cloud

In Google Auth Platform, use an Attnd project and create a **Web application** OAuth client. Add `https://www.attnd.space` as an authorized JavaScript origin and the Supabase provider callback above as an authorized redirect URI. Configure the consent audience and publish the app, or include the intended test accounts while it is in testing. Add the resulting Client ID and Client Secret under Supabase Auth → Sign In / Providers → Google, then enable Google.

Google's setup guide: https://supabase.com/docs/guides/auth/social-login/auth-google

## Apple Developer

In Apple Developer, configure Sign in with Apple for the App ID `com.ninjaworld.attndr`, create a related **Services ID** for web OAuth, and register the Supabase callback above for that Services ID. Create a Sign in with Apple signing key. Enter the Services ID, Team ID, Key ID, and generated client secret in Supabase Auth → Sign In / Providers → Apple, then enable Apple. Keep the signing key private; Apple's web OAuth client secret needs periodic rotation.

Apple's setup guide: https://supabase.com/docs/guides/auth/social-login/auth-apple

Do not commit OAuth client secrets or Apple signing keys. Once each provider is enabled, the respective login and signup buttons appear automatically. Verify both the browser flow on `www.attnd.space` and the iOS flow using an updated app build.
