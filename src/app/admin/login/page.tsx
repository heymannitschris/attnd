import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginScreen } from "@/components/admin/AdminLoginScreen";

export const metadata: Metadata = { title: "Admin Sign In | Attnd", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return <Suspense fallback={<main className="admin-login-page"><section className="admin-login-brand"><span>ADMINISTRATION</span></section><section className="admin-login-panel" /></main>}><AdminLoginScreen /></Suspense>;
}
