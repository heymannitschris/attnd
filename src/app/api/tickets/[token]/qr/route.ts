import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: RouteContext<"/api/tickets/[token]/qr">) {
  const { token } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  const { data: ticket } = await supabase.from("tickets").select("qr_token").eq("qr_token", token).eq("owner_id", user.id).maybeSingle();
  const { data: guestlist } = ticket ? { data: null } : await supabase.from("event_guestlist_entries").select("access_token").eq("access_token", token).eq("user_id", user.id).neq("status", "cancelled").maybeSingle();
  if (!ticket && !guestlist) return new Response("Pass not found", { status: 404 });
  const value = ticket ? `attnd:ticket:${ticket.qr_token}` : `attnd:guestlist:${guestlist!.access_token}`;
  const svg = await QRCode.toString(value, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "private, no-store" } });
}
