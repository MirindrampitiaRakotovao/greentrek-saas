import type { ReactNode } from "react";

import { MarketingShell } from "@/components/marketing/marketing-shell";

/** Site de la plateforme : landing SaaS et tarifs (§7.5). */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
