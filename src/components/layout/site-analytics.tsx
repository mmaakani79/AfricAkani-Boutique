"use client";

import { Analytics } from "@vercel/analytics/next";
import { filterAnalyticsEvent } from "@/lib/analytics-filter";

// Vercel Web Analytics (no cookies). A client component of its own because the
// filter is a function, which a server layout cannot hand to a client component.
// The filter keeps the admin area out of the count and removes everything after
// "?" from the recorded address.
export function SiteAnalytics() {
  return <Analytics beforeSend={filterAnalyticsEvent} />;
}
