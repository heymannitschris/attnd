import { notFound } from "next/navigation";
import { CheckInDashboard, type CheckInEventSummary, type RecentCheckIn } from "@/components/dashboard/HostDashboardScreens";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AssignedCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const admin = createAdminClient();
  const byId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
  const { data: eventRow } = await admin.from("events")
    .select("id,slug,title,cover_url,starts_at,ends_at,city,host_id,ticket_types(quantity,sold_count)")
    .eq(byId ? "id" : "slug", id).maybeSingle();
  if (!eventRow) notFound();

  const isHost = eventRow.host_id === user.id;
  if (!isHost) {
    const { data: assignment } = await admin.from("event_staff").select("event_id")
      .eq("event_id", eventRow.id).eq("user_id", user.id).eq("role", "check_in").eq("status", "accepted").maybeSingle();
    if (!assignment) {
      const { data: teamAccess } = await admin.from("event_team_members").select("event_id")
        .eq("event_id", eventRow.id).eq("user_id", user.id).eq("can_check_in", true).eq("status", "accepted").maybeSingle();
      if (!teamAccess) notFound();
    }
  }

  const { data: checkInRows } = await admin.from("ticket_checkins")
    .select("id,checked_in_at,tickets(attendee_name,ticket_types(name))")
    .eq("event_id", eventRow.id).order("checked_in_at", { ascending: false }).limit(50);
  const tiers = (eventRow.ticket_types || []) as Array<{ quantity: number; sold_count: number }>;
  const event: CheckInEventSummary = {
    id: eventRow.id, slug: eventRow.slug, title: eventRow.title, coverUrl: eventRow.cover_url,
    startsAt: eventRow.starts_at, endsAt: eventRow.ends_at, city: eventRow.city,
    registered: tiers.reduce((sum, tier) => sum + tier.sold_count, 0), capacity: tiers.reduce((sum, tier) => sum + tier.quantity, 0),
  };
  const initialCheckIns: RecentCheckIn[] = (checkInRows || []).map((row) => {
    const ticket = row.tickets as unknown as { attendee_name: string | null; ticket_types: { name: string } | null } | null;
    return { id: row.id, name: ticket?.attendee_name || "Guest", tier: ticket?.ticket_types?.name || "Ticket", checkedInAt: row.checked_in_at };
  });
  return <CheckInDashboard event={event} initialCheckIns={initialCheckIns} />;
}
