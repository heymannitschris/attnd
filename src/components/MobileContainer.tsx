import type { ReactNode } from "react";

export function MobileContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl">{children}</div>;
}
