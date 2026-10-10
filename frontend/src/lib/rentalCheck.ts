export const RENTAL_PRICE_NGN = 5000;

export const RECOMMENDATION_COPY = {
  LOWER_RISK: "LOWER RISK — PROCEED WITH NORMAL PRECAUTIONS",
  UNCERTAIN: "UNCERTAIN — VERIFY THESE ITEMS FIRST",
  HIGH_RISK: "HIGH RISK — DO NOT PAY YET",
} as const;

export type RecommendationCode = keyof typeof RECOMMENDATION_COPY;

export function lockedRecommendation(code: string | null | undefined): string | null {
  if (!code || !(code in RECOMMENDATION_COPY)) return null;
  return RECOMMENDATION_COPY[code as RecommendationCode];
}

export function formatNaira(amount: number): string {
  return `\u20a6${amount.toLocaleString("en-NG")}`;
}
