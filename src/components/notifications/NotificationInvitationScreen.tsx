"use client";

import Image from "next/image";
import Link from "next/link";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";

const attendees = [{ id: "alex", name: "Alex", portrait: 0 }, { id: "maya", name: "Maya", portrait: 1 }, { id: "jay", name: "Jay", portrait: 2 }, { id: "kim", name: "Kim", portrait: 3 }] as const;

export function NotificationInvitationScreen() {
  return <div className="notification-invitation-screen">
    <header className="notification-detail-header"><Link href="/notifications" aria-label="Back to notifications"><DiscoverIcon name="chevron" /></Link><span /></header>
    <section className="notification-invite-hero"><Image src="/events/gallery-sunset.jpg" alt="Mindset Mastery Workshop at sunset" fill priority sizes="(max-width: 672px) 100vw, 672px" className="object-cover" /><span /><time><small>OCT</small><strong>12</strong></time></section>
    <main className="notification-invite-content"><div className="notification-inviter"><Image src="/hosts/lukas-avatar.jpg" alt="Lukas Weber" fill sizes="92px" className="object-cover" /></div><h1>Lukas Weber invited you<br />to an event!</h1><p>“Hey! Would be great to have you there.<br />This event will be amazing! 🙌”</p>
      <article className="notification-event-card"><Image src="/events/gallery-sunset.jpg" alt="Tropical sunset workshop" width={92} height={112} /><div><h2>Mindset Mastery Workshop</h2><p><DiscoverIcon name="calendar" />Sat, Oct 12, 2024</p><p><DiscoverIcon name="pin" />Koh Phangan, Thailand</p><span><AvatarStack people={attendees} size={23} />86 going</span></div></article>
      <Link className="notification-primary-action notification-view-event-fixed" href="/events/palm-grove-sessions">View Event</Link>
    </main>
  </div>;
}
