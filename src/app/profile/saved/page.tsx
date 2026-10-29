import type { Metadata } from "next";
import { ProfileEventCollectionScreen } from "@/components/profile/ProfileEventCollectionScreen";
export const metadata: Metadata = { title: "Saved | Attnd" };
export default function SavedEventsPage() { return <ProfileEventCollectionScreen />; }
