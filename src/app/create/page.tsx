import type { Metadata } from "next";
import { CreateEventScreen } from "@/components/create/CreateEventScreen";

export const metadata: Metadata = { title: "Create Event | Attnd" };

export default function CreatePage() { return <CreateEventScreen />; }
