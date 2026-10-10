// GA4 event helper. No-op unless gtag was loaded (NEXT_PUBLIC_GA_ID set). Never pass PII.
export function track(event: string, params?: Record<string, string>) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", event, params);
}
