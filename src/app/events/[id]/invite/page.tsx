import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitePeopleScreen } from "@/components/events/InviteFlowScreens";
import { getEventBundle } from "@/lib/events-data";
type Props = { params: Promise<{ id: string }> };
export const metadata: Metadata = { title: "Invite People | Attnd" };
export default async function InvitePeoplePage({ params }: Props) { const { id } = await params; const bundle = await getEventBundle(id); if (!bundle) notFound(); return <InvitePeopleScreen event={bundle.event} />; }
