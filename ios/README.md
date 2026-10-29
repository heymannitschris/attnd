# Event Platform iOS

The iOS target is a small native shell around the hosted Attnd app. It uses `WKWebView`, keeps links from the same host inside the app, opens external links in Safari, supports pull to refresh, and provides branded configuration and offline states. Google and Apple OAuth open in `ASWebAuthenticationSession` and return to the web app through `com.ninjaworld.attndr://auth/callback` so the Supabase PKCE session is stored in the app's WebView.

## Before archiving

1. Set `APP_SERVER_URL` in the Xcode target build settings to the production HTTPS URL.
2. Select the Apple Developer Team in Signing & Capabilities.
3. Use the registered bundle identifier `com.ninjaworld.attndr` for the matching App Store Connect record.
4. Increment `CURRENT_PROJECT_VERSION` for every upload.

Open `EventPlatform.xcodeproj`, choose **Any iOS Device (arm64)**, then use **Product > Archive**. In Organizer choose **Distribute App > App Store Connect > Upload**.
