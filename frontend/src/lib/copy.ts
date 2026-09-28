export const supportWhatsApp = "https://wa.me/2349136094315";

export function formatYearlyRent(price?: number | null) {
  if (price == null || Number.isNaN(price)) return "";
  return `\u20A6${price.toLocaleString("en-NG")} / year`;
}

export const nav = {
  browse: "Browse",
  dashboard: "Dashboard",
  signOut: "Sign out",
  signIn: "Sign in",
  getStarted: "Get started",
  getStartedFree: "Get started free",
};

export const auth = {
  loginTitle: "Welcome back",
  loginSubtitle: "Use the email you signed up with",
  email: "Email",
  password: "Password",
  signIn: "Sign in",
  noAccount: "No account?",
  createOne: "Create one",
  welcomeBack: "Welcome back.",
  loginFailed: "We could not sign you in. Check your email and password, or create an account.",
  getStarted: "Create your Lodgist account",
  createAccountSubtitle: "Takes a minute. You can browse listings right after.",
  fullName: "Full name",
  phoneOptional: "WhatsApp number (optional)",
  createAccount: "Create account",
  alreadyHaveAccount: "Already have an account?",
  registrationSuccess: "You are in. Let's look at places.",
  registrationFailure: "We could not create the account. Try again, or use a different email.",
  registerFailed: "We could not finish that. Try again.",
  notAvailable: "Not ready yet",
};

export const home = {
  metaTitle: "Find a place in Nigeria you can actually trust",
  badge: "Open now in Imo. Port Harcourt next.",
  titleLead: "Find a place in Nigeria",
  titleAccent: "you can actually trust",
  subtitle: "We check the landlord and the listing before you pay. Your rent sits with Lodgist until you see the house.",
  browseCta: "See places we have checked",
  listCta: "List a house (free)",
  whyTitle: "Why people use Lodgist",
  whySub: "Most ads look fine until money leaves your account. We slow that part down.",
  storiesTitle: "Example stories",
  storiesNote: "These are examples, not live reviews.",
  closeTitle: "Ready to look?",
  closeSub: "Create a free account. Browse first. Pay only when you are ready.",
  closeCta: "Create a free account",
  footer: "Lodgist is built by ShadowSpark in Nigeria",
  features: [
    { icon: "\u{1F6E1}\uFE0F", title: "Trust score", desc: "Each listing shows the checks we actually ran: identity, photos, price against nearby homes, and complaint history." },
    { icon: "\u{1F4B0}", title: "Rent held until you see it", desc: "Pay into Lodgist first. We release the money after you inspect and say the house is real." },
    { icon: "\u{1F4F1}", title: "WhatsApp if that is easier", desc: "Search, ask questions, and book a viewing on WhatsApp." },
    { icon: "\u{1F511}", title: "Sign in with this phone", desc: "Fingerprint or Face ID. No password sitting on a stolen phone." },
  ],
  stats: [
    { value: "Checks", label: "On every listing", sub: "Only what we can show" },
    { value: "\u20A60", label: "Hidden fees", sub: "Rent and fees shown up front" },
    { value: "ID", label: "When the score says so", sub: "Not a blanket 100%" },
    { value: "WhatsApp", label: "Help while we are open", sub: "Hours shown in the chat" },
  ],
  examples: [
    { name: "Example", city: "Owerri", score: "Solid", text: "A renter finds a flat, sees the landlord checks, and moves in without paying an agent first." },
    { name: "Example", city: "Port Harcourt", score: "Solid", text: "Money stays with Lodgist until the viewing confirms the house." },
    { name: "Example", city: "Lagos", score: "Solid", text: "A landlord lists a house and only hears from people who created an account." },
  ],
};

export const listings = {
  title: "Places we have checked",
  subtitle: "The score on each card is the trust score for that landlord.",
  searchPlaceholder: "Try \"2 bedroom Owerri\" or \"World Bank\"",
  emptyTitle: "Nothing matches that yet",
  emptyBody: "Try another area, or message us on WhatsApp and we will look.",
  emptyCta: "Message us on WhatsApp",
  homeCta: "Back to home",
};

export const search = {
  title: "Find a place",
  button: "Search",
  placeholder: "New Owerri, Irete, World Bank",
  startTitle: "Type an area",
  startBody: "Example: New Owerri, Irete, or World Bank.",
  noTitle: "Nothing for that search",
  noBody: "Try a different area, or see every place we have checked.",
  browseAll: "See all places",
  fetchError: "Listings did not load. Check your network and try again.",
};

export const jargon = {
  trustScore: "Trust score",
  trustHint: "Higher means more checks passed.",
  weak: "Weak",
  average: "Average",
  solid: "Solid",
  strong: "Strong",
};

export const dashboard = {
  overview: {
    truthScore: "Trust score",
    hnwStatus: "Higher-value checks",
    accountType: "Account type",
    passkey: "Phone sign-in",
  },
  hnw: {
    verified: "Extra checks on",
    standard: "Standard",
    verifiedDesc: "Extra identity checks are on for this account.",
    standardDesc: "Standard account. Extra checks are not required yet.",
  },
};
