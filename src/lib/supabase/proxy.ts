import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return responseWithAffiliateCookie(request, NextResponse.next({ request }));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const isAdminLogin = request.nextUrl.pathname === "/admin/login";
  if (!user && request.nextUrl.pathname.startsWith("/admin") && !isAdminLogin) {
    const loginUrl = request.nextUrl.clone(); loginUrl.pathname = "/admin/login"; loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl); response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return responseWithAffiliateCookie(request, redirect);
  }
  const protectedPath = ["/create", "/dashboard", "/tickets", "/profile"].some((prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`));
  if (!user && protectedPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/onboarding";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return responseWithAffiliateCookie(request, redirect);
  }
  if (user && request.nextUrl.pathname !== "/account-suspended") {
    const { data: profile } = await supabase.from("profiles").select("account_status").eq("id", user.id).maybeSingle();
    if (profile?.account_status === "suspended") {
      const suspendedUrl = request.nextUrl.clone(); suspendedUrl.pathname = "/account-suspended"; suspendedUrl.search = "";
      const redirect = NextResponse.redirect(suspendedUrl); response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return responseWithAffiliateCookie(request, redirect);
    }
  }
  return responseWithAffiliateCookie(request, response);
}

function responseWithAffiliateCookie(request: NextRequest, response: NextResponse) {
  const affiliateId = request.nextUrl.searchParams.get("affiliate_id");
  if (affiliateId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(affiliateId)) {
    response.cookies.set("attnd_affiliate", affiliateId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    const momentId = request.nextUrl.searchParams.get("moment");
    if (momentId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(momentId)) response.cookies.set("attnd_affiliate_moment", momentId, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
