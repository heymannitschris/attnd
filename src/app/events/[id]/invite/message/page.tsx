import { notFound } from "next/navigation";
import { InviteMessageScreen } from "@/components/events/InviteFlowScreens";
import { getEventBundle } from "@/lib/events-data";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ people?: string }> };
export default async function InviteMessagePage({ params, searchParams }: Props) { const { id } = await params; const { people } = await searchParams; const bundle = await getEventBundle(id); if (!bundle) notFound(); return <InviteMessageScreen event={bundle.event} peopleIds={people} />; }
