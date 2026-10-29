import Link from "next/link";

export default function AccountSuspendedPage() {
  return <main className="account-suspended"><div><span>ATTND</span><h1>Account suspended</h1><p>This account is currently unavailable. Contact Attnd support if you believe this is a mistake.</p><Link href="/legal">Contact support</Link></div></main>;
}
