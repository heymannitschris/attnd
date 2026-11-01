import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/checkout/", "/events/*/checkout", "/admin", "/dashboard", "/auth/", "/account-suspended", "/onboarding", "/notifications", "/tickets", "/create", "/marketing-preview"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
