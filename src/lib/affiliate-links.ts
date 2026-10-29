function currentUserId() {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem("attnd:user-id");
  return id && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? id : null;
}

const affiliateOrigin = "https://www.attnd.space";

export function buildAffiliateEventUrl(_origin: string, eventId: string) {
  const url = new URL(`/events/${eventId}`, affiliateOrigin);
  const userId = currentUserId();
  if (userId) url.searchParams.set("affiliate_id", userId);
  return url.toString();
}

export function buildAffiliateProfileUrl(_origin: string) {
  const url = new URL("/profile", affiliateOrigin);
  const userId = currentUserId();
  if (userId) url.searchParams.set("affiliate_id", userId);
  return url.toString();
}
