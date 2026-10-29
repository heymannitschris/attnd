"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export const adminSections = ["Overview", "Users", "Events", "Affiliates", "Payouts", "Local Reviews", "Reports", "Refunds", "Payments", "Activity Log", "Admin Team"] as const;
export type AdminSectionName = typeof adminSections[number];

const hrefFor = (section: AdminSectionName) => section === "Overview" ? "/admin" : `/admin?tab=${encodeURIComponent(section)}`;

export function AdminSidebar({ active, role, name, avatarUrl, counts = {}, onNavigate }: { active: AdminSectionName; role: string; name: string; avatarUrl?: string | null; counts?: Partial<Record<AdminSectionName, number>>; onNavigate?: (section: AdminSectionName) => void }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => { const saved = window.localStorage.getItem("attnd-admin-theme") === "light" ? "light" : "dark"; document.documentElement.dataset.adminTheme = saved; const frame = window.requestAnimationFrame(() => setTheme(saved)); return () => window.cancelAnimationFrame(frame); }, []);
  function toggleTheme() { const next = theme === "dark" ? "light" : "dark"; setTheme(next); window.localStorage.setItem("attnd-admin-theme", next); document.documentElement.dataset.adminTheme = next; }
  const visibleSections = role === "super_admin" ? adminSections : adminSections.filter((section) => section !== "Admin Team");
  return <aside className="admin-sidebar">
    <header className="admin-sidebar-title"><h1>{role === "super_admin" ? "Super Admin Dashboard" : "Admin Dashboard"}</h1></header>
    <nav>{visibleSections.map((section) => onNavigate ? <button key={section} type="button" aria-current={active === section ? "page" : undefined} onClick={() => onNavigate(section)}><AdminNavIcon name={section} /><strong>{section}</strong>{Boolean(counts[section]) && <em>{counts[section]}</em>}</button> : <Link key={section} href={hrefFor(section)} aria-current={active === section ? "page" : undefined}><AdminNavIcon name={section} /><strong>{section}</strong>{Boolean(counts[section]) && <em>{counts[section]}</em>}</Link>)}</nav>
    <footer><button className="admin-theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}><ThemeIcon light={theme === "light"} /><span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button><Link href="/profile" className="admin-sidebar-profile">{avatarUrl ? <Image src={avatarUrl} alt="" width={43} height={43} unoptimized /> : <span>{name.slice(0,1).toUpperCase()}</span>}<div><strong>{name}</strong><small>{role.replaceAll("_", " ")}</small></div><b>›</b></Link></footer>
  </aside>;
}

function ThemeIcon({ light }: { light: boolean }) { return light ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>; }

function AdminNavIcon({ name }: { name: AdminSectionName }) {
  const paths: Record<AdminSectionName, React.ReactNode> = {
    Overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    Users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    Events: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
    Affiliates: <><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m8.6 10.5 6.8-3M8.6 13.5l6.8 3"/></>,
    Payouts: <><path d="M12 2v14M7 11l5 5 5-5"/><path d="M4 19h16v3H4z"/></>,
    "Local Reviews": <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    Reports: <><path d="M4 21V4a1 1 0 0 1 1-1h11l-1 5 1 5H5"/></>,
    Refunds: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M8 12h8M12 8v8"/></>,
    Payments: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h2"/></>,
    "Activity Log": <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M5 3 3 2M19 3l-3 2"/></>,
    "Admin Team": <><path d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/><path d="M4 22a8 8 0 0 1 16 0M19 4v4M17 6h4"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
