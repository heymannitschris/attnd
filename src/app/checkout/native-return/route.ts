import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Stripe Checkout return target for the iOS app. Checkout runs inside an
// ASWebAuthenticationSession that completes when it reaches the app scheme;
// the app then loads `next` in its WebView. Only relative /events/ paths are
// accepted so this cannot be used as an open redirect.
export function GET(request: Request) {
  const next = new URL(request.url).searchParams.get("next") || "";
  const safe = next.startsWith("/events/") && !next.startsWith("//") && !next.includes("\\") ? next : "/tickets";
  return NextResponse.redirect(`com.ninjaworld.attndr://checkout/return?next=${encodeURIComponent(safe)}`, 302);
}
