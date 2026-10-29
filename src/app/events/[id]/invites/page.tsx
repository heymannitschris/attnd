import { notFound } from "next/navigation";
import { EventInvitesScreen } from "@/components/events/InviteFlowScreens";
import { getEventBundle } from "@/lib/events-data";
type Props = { params: Promise<{ id: string }> };
export default async function EventInvitesPage({ params }: Props) { const { id } = await params; const bundle = await getEventBundle(id); if (!bundle) notFound(); return <EventInvitesScreen event={bundle.event} />; }
