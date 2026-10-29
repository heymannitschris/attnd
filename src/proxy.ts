import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/create/:path*",
    "/dashboard/:path*",
    "/tickets/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/account-suspended",
  ],
};
