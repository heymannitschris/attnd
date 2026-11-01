import { SITE_URL } from "@/lib/seo/site";

export const dynamic = "force-static";

const body = `# attnd

> attnd (www.attnd.space) is an event app focused on Koh Phangan (Thailand) and growing worldwide. Guests discover events, buy tickets or RSVP, and get QR tickets. Hosts create events, sell tickets with Stripe, reach the attnd community, work with co-hosts and affiliates, and check guests in via QR.

Apps: iOS (App Store) and Android (Google Play), plus the web app at ${SITE_URL}.

## Main pages
- [Home / for hosts](${SITE_URL}/): what attnd offers event organizers
- [Discover events](${SITE_URL}/discover): upcoming public events
- [Explore](${SITE_URL}/explore): events by category and on a map
- [Event pages](${SITE_URL}/events/{slug}): details, date, location, tickets for one event
- [Sitemap](${SITE_URL}/sitemap.xml): all public event URLs

## Legal & support
- [Support](${SITE_URL}/support)
- [Privacy policy](${SITE_URL}/privacy)
- [Terms](${SITE_URL}/terms)
- [Refund policy](${SITE_URL}/refunds)
`;

export function GET() {
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
