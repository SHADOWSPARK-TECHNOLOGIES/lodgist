export const supportWhatsApp = "https://wa.me/2349136094315";
export const supportWhatsAppAsk =
  "https://wa.me/2349136094315?text=" + encodeURIComponent("I need a home. Area: ");

export const brand = {
  endorsement: "A platform curated by ShadowSpark Technologies",
  tagline: "Rent with more confidence.",
  productLabel: "Product",
  companyLabel: "Company",
  browse: "Browse homes",
  list: "List a property",
  trust: "Trust and safety",
  about: "About Lodgist",
  privacy: "How we handle trust",
  support: "Lodgist Support · ShadowSpark Technologies",
  authLine: "A ShadowSpark Technologies platform",
};

export function formatYearlyRent(price?: number | null) {
  if (price == null || Number.isNaN(price)) return "";
  return `\u20a6${Number(price).toLocaleString("en-NG")} / year`;
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
  curatorLine: brand.authLine,
  email: "Email",
  password: "Password",
  passwordPlaceholder: "At least 8 characters",
  namePlaceholder: "Chioma Okonkwo",
  emailPlaceholder: "you@example.com",
  phonePlaceholder: "080...",
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
  badge: "Starting in Imo. More cities after homes are reviewed.",
  titleLead: "Find a place in Nigeria",
  titleAccent: "you can actually trust",
  subtitle: "See the checks on the landlord and the listing before you pay.",
  browseCta: "See places we have checked",
  listCta: "List a house (free)",
  stepsTitle: "How it works",
  steps: [
    { n: "1", title: "Find a place", body: "Search homes in your area." },
    { n: "2", title: "Check before you trust", body: "See what Lodgist checked and what still needs a look." },
    { n: "3", title: "Look before you pay", body: "Inspect the property before sending rent." },
  ],
  nigeriaTitle: "Built for renting in Nigeria",
  nigeria: ["Annual rent", "Move-in costs", "Area notes", "Trust checks", "WhatsApp assistance"],
  whyTitle: "Why people use Lodgist",
  whySub: "Most ads look fine until money leaves your account. We slow that part down.",
  storiesTitle: "Example stories",
  storiesNote: "These are examples, not live reviews.",
  closeTitle: "Ready to look?",
  closeSub: "Create a free account. Browse first. Pay only when you are ready.",
  closeCta: "Create a free account",
  footer: brand.endorsement,
  features: [
    { icon: "\u{1f6e1}\ufe0f", title: "Trust score", desc: "Each listing shows the checks we actually ran: identity, photos, price against nearby homes, and complaint history." },
    { icon: "\u{1f4b0}", title: "Pay after you look", desc: "Do not send rent until you have seen the house and said it is real." },
    { icon: "\u{1f4f1}", title: "WhatsApp if that is easier", desc: "Search, ask questions, and book a viewing on WhatsApp." },
    { icon: "\u{1f511}", title: "Sign in with this phone", desc: "Fingerprint or Face ID. No password sitting on a stolen phone." },
  ],
  stats: [
    { value: "Checks", label: "On every listing", sub: "Only what we can show" },
    { value: "Up front", label: "Rent and fees", sub: "Shown before you pay" },
    { value: "ID", label: "When the score says so", sub: "Not a blanket claim" },
    { value: "WhatsApp", label: "Help while we are open", sub: "Hours shown in the chat" },
  ],
  examples: [
    { name: "Example", city: "Owerri", score: "Solid", text: "A renter finds a flat, sees the landlord checks, and moves in without paying an agent first." },
    { name: "Example", city: "Port Harcourt", score: "Solid", text: "The renter looks at the house before any rent leaves their account." },
    { name: "Example", city: "Lagos", score: "Solid", text: "A landlord lists a house and only hears from people who created an account." },
  ],
};

export const listings = {
  title: "Find a place",
  subtitle: "Annual rent is shown first. A Trust Score appears only when we have one.",
  searchPlaceholder: "Try \"2 bedroom Owerri\" or \"World Bank\"",
  maxRent: "Highest annual rent",
  count: (n: number) => (n === 1 ? "1 home" : `${n} homes`),
  emptyTitle: "No checked homes here yet",
  emptyBody: "We're starting with Imo and adding more homes as they're reviewed.",
  emptyCta: "Ask us on WhatsApp",
  listCta: "List your property",
  elsewhere: "Looking somewhere else? Tell us the area you want.",
  searchEmptyTitle: "Nothing matches that search",
  searchEmptyBody: "Try another area or a higher rent, or tell us on WhatsApp.",
  loadErrorTitle: "Homes did not load",
  loadErrorBody: "Check your connection and try again, or message us on WhatsApp.",
  retry: "Try again",
  noScore: "No Trust Score yet",
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
  title: "Dashboard",
  loading: "Loading your dashboard",
  sessionTitle: "Sign in to continue",
  sessionBody: "Your dashboard is behind your account.",
  goToLogin: "Sign in",
  logout: "Sign out",
  extraChecks: "Extra checks on",
  tabs: {
    overview: "Overview",
    listings: "Your houses",
    reviews: "Reviews",
    passkeys: "Phone sign-in",
    hnw: "Extra checks",
  },
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

export const passkeys = {
  title: "Phone sign-in",
  subtitle: "Use this phone instead of a password.",
  add: "Add this phone",
  adding: "Adding...",
  loadFailed: "We could not load your phones. Try again.",
  registerFailed: "We could not add this phone. Try again.",
  deleteFailed: "We could not remove that phone. Try again.",
  unsupported: "This browser cannot use phone sign-in. Try Chrome or Safari.",
  emptyTitle: "No phone sign-in yet",
  emptyBody: "Add this phone so you can sign in without a password.",
  synced: "Synced",
  thisPhone: "This phone",
  otherDevice: "Another device",
  created: "Added",
  lastUsed: "Last used",
  remove: "Remove",
  removing: "Removing...",
};

export const reviews = {
  signInError: "Sign in before you leave a review.",
  signInBody: "Sign in to say how the house was.",
  rating: "How was it?",
  comment: "What should the next person know?",
  optional: "(optional)",
  placeholder: "Was the house as described? Was the landlord easy to reach?",
  updateFailed: "We could not update your review. Try again.",
  submitFailed: "We could not send your review. Try again.",
  submitting: "Sending...",
  update: "Update your review",
  submit: "Send review",
  sending: "Sending your review...",
  stars: "Rate",
};

export const neighborhood = {
  unavailable: "We do not have area details for this house yet.",
  safety: "Area check",
  flood: "Flood note",
  amenities: "Nearby",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const listingCard = {
  noPhoto: "No photo yet",
  listedBy: "Listed by",
  trust: "Trust score",
  view: "View house",
  markRented: "Mark as taken",
  beds: "beds",
  baths: "baths",
  status: {
    available: "Open",
    rented: "Taken",
    sold: "Sold",
    withdrawn: "Taken down",
  } as Record<string, string>,
};

export const overview = {
  registering: "Adding...",
  registerPasskey: "Add this phone",
  passkeyUnavailable: "Phone sign-in is not available on this device",
  quick: "What you can do",
  browse: "See places",
  newListing: "List a house",
  recalculate: "Refresh the score",
};

export const audit = {
  title: "What we checked",
  running: "Checking...",
  run: "Check this listing",
  failed: "We could not run the check. Try again.",
  unknown: "Something went wrong. Try again.",
  risk: "How it looks",
  score: "Score",
  breakdown: "What went into the score",
  recommendations: "What to do next",
  needsLook: "This listing needs a second look before you pay.",
};

export const moveIn = {
  unavailable: "We do not have move-in costs for this house yet.",
  title: "What you pay to move in",
  total: "Total",
  notDeclared: "Total not listed",
  errors: "Numbers that do not add up",
  warnings: "Check these",
  note: "Note",
  structure: "How the money is split",
  baseRent: "Rent",
  agency: "Agent fee",
  legal: "Legal fee",
  caution: "Caution deposit",
  inspection: "Inspection fee",
  service: "Service charge",
};

export const payment = {
  title: "Payment status",
  empty: "No payment on this listing yet.",
  completed: "Paid",
  support: "Message us on WhatsApp",
  ref: "Reference",
};

export const milestones = {
  title: "Payments along the way",
  empty: "No staged payments on this listing.",
  noneYet: "Nothing paid yet",
  complete: "Finish this on WhatsApp",
};

export const about = {
  metaTitle: "About Lodgist",
  lead: "Lodgist is a Nigerian rental-trust platform curated by ShadowSpark Technologies.",
  parent: "ShadowSpark builds technology focused on practical automation, trust, and digital services for African markets.",
};

export const trustCenter = {
  metaTitle: "Trust and safety",
  title: "How Lodgist checks listings",
  intro: "Lodgist is curated by ShadowSpark Technologies. We combine listing checks, property information, rent context, and human review so you can see what was looked at before you pay.",
  checkedTitle: "What we checked",
  checked: [
    "Listing information",
    "Contact consistency",
    "Property and location information",
    "Rent context",
    "Available evidence",
  ],
  limitTitle: "Still check in person",
  limitBody: "Lodgist does not replace a physical inspection. Never send rent only because a listing has a high Trust Score. A score is not a promise that the house, the landlord, or the payment is safe.",
  reportTitle: "If something looks wrong",
  reportBody: "Message Lodgist Support on WhatsApp with the listing and what concerned you. We review the report and can change how the listing is shown. We do not claim every problem is caught.",
  browse: "Browse homes",
};

export const area = {
  unavailable: "We do not have area notes for this house yet.",
  safety: "Area check",
  flood: "Flood note",
  avgRent: "Typical rent nearby",
  occupancy: "How full the area is",
  amenities: "Nearby",
};
