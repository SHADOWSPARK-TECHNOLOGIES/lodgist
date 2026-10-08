/** Meta app WA bake 2026-09-29 (+2349045770572). Digits from NEXT_PUBLIC_SUPPORT_WHATSAPP. Null when the env var is unset. */
export function supportWhatsAppDigits(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/** wa.me link, or null when support WhatsApp is not configured. */
export function supportWhatsAppLink(text?: string): string | null {
  const digits = supportWhatsAppDigits();
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const brand = {
  endorsement: "A platform curated by ShadowSpark Technologies",
  tagline: "Rent with more confidence.",
  productLabel: "Product",
  companyLabel: "Company",
  browse: "Browse homes",
  check: "Check a rental",
  list: "Advertise with Lodgist",
  trust: "Trust and safety",
  about: "About Lodgist",
  aim: "Our aim",
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
  aim: "Aim",
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
  checkPrompt: "Found a house online? Before you send money, let Lodgist check it.",
  checkCta: "CHECK A RENTAL BEFORE I PAY",
  browseCta: "Browse homes",
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
    { icon: "\u{1f511}", title: "Sign in with email and password", desc: "Phone, fingerprint, and Face ID sign-in are not available yet." },
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

export const detail = {
  back: "All homes",
  rent: "Annual rent",
  moveIn: "What you pay to move in",
  noMoveIn: "Move-in costs are not listed for this home yet. Ask before you pay.",
  checked: "What we can say",
  unchecked: "Still check in person",
  uncheckedBody: "A Trust Score is not a reason to send rent. Walk the house first.",
  updated: "Listing updated",
  missing: "This home is not on Lodgist.",
  loadError: "We could not load this home.",
  retry: "Try again",
  whatsApp: "Ask on WhatsApp",
  whatsAppMissing: "WhatsApp support is not set up on this site yet.",
  report: "Report this listing",
  decisionTitle: "Before you pay",
  lastVerified: "Last verification",
  completed: "Checks completed",
  noneCompleted: "No checks are on file for this home.",
  outstanding: "Checks still open",
  inspection: "Book an inspection",
  inspectionBody: "Walk the house before you send rent.",
  signInToRequest: "Sign in to request a viewing",
  requestViewing: "Request a viewing",
  viewingDate: "Preferred date",
  viewingTime: "Preferred time (optional)",
  viewingNotes: "Note for follow-up (optional)",
  viewingSubmit: "Send request",
  viewingSending: "Sending",
  viewingNext: "We saved this request. Walk the house before you send rent. A Lodgist agent follows up on this reference.",
  viewingDuplicate: "You already have an open viewing request for this home. Use this reference.",
  viewingClosed: "Viewing requests open after this home is verified.",
  viewingLandlord: "Viewing requests are for renter accounts.",
  viewingReference: "Reference",
  viewingExisting: "This is your viewing request for this home.",
  viewingStatusFailed: "We could not load an existing viewing request. You can still send one.",
  viewingFailed: "We could not save this viewing request.",
  askInvoice: "Ask an agent to send an invoice",
  askInvoiceNote: "This asks an agent for an invoice. It does not mean a payment is completed.",
  unverified: "Not verified by Lodgist",
  labelsExplain: "Lodgist-reviewed means a Lodgist admin approved this listing to be shown. Verified by Lodgist means an admin recorded an evidence check. Neither label is a guarantee of the home, the landlord, its safety, or its title. Inspect before you pay.",
  source: "Source",
  rentMissing: "Not listed",
  sampleMoveIn: "Example figure, not a bill",
  noScore: "No Trust Score yet",
  sampleTitle: "Example only",
  sampleBody: "This home is not for rent and has not been checked. The fees below are an example, not a bill.",
};

export const listings = {
  title: "Find a place",
  subtitle: "Annual rent is shown first. A home Lodgist has not verified says so. A Trust Score appears only when we have one.",
  searchLabel: "Area or home type",
  searchPlaceholder: "Try \"2 bedroom Owerri\" or \"World Bank\"",
  loading: "Loading homes…",
  maxRent: "Highest annual rent",
  count: (n: number) => (n === 1 ? "1 home" : `${n} homes`),
  emptyTitle: "No homes here yet",
  emptyBody: "We're starting with Imo. Only a Lodgist-reviewed home is shown. Review is not verification.",
  emptyCta: "Ask us on WhatsApp",
  whatsAppMissing: "WhatsApp support is not set up on this site yet.",
  listCta: "List your property",
  elsewhere: "Looking somewhere else? Tell us the area you want.",
  searchEmptyTitle: "Nothing matches that search",
  searchEmptyBody: "Try another area or a higher rent, or tell us on WhatsApp.",
  leadTitle: "Request a home in your area",
  leadBody: "Tell us the area, budget, and when you want to move. We save the request. This is not a promise of a specific home.",
  leadLocation: "Area",
  leadBudget: "Yearly budget (NGN)",
  leadBedrooms: "Bedrooms",
  leadMoveIn: "When do you want to move in?",
  leadPhone: "Phone",
  leadEmail: "Email (optional)",
  leadSubmit: "Save my request",
  leadSending: "Saving",
  leadSaved: "No matching homes yet. Your request is saved. We will notify you when a home matches. This is not a promise of a specific home.",
  leadFailed: "We could not save this request. Try again.",
  loadErrorTitle: "Homes did not load",
  loadErrorBody: "Check your connection and try again, or message us on WhatsApp.",
  retry: "Try again",
  noScore: "No Trust Score yet",
  sampleBadge: "Example, not for rent",
};

export const search = {
  title: "Find a place",
  button: "Search",
  label: "Area",
  searching: "Searching…",
  placeholder: "New Owerri, Irete, World Bank",
  startTitle: "Type an area",
  startBody: "Example: New Owerri, Irete, or World Bank.",
  noTitle: "Nothing for that search",
  noBody: "Try a different area, or see every place listed on Lodgist.",
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
    passkeys: "Sign-in",
    hnw: "Extra checks",
  },
  overview: {
    truthScore: "Trust score",
    hnwStatus: "Higher-value checks",
    accountType: "Account type",
    passkey: "Sign-in",
  },
  hnw: {
    verified: "Extra checks on",
    standard: "Standard",
    verifiedDesc: "Extra identity checks are on for this account.",
    standardDesc: "Standard account. Extra checks are not required yet.",
  },
};

export const passkeys = {
  title: "Sign-in",
  subtitle: "You sign in with the email and password on your account.",
  off: "Phone, fingerprint, and Face ID sign-in are turned off.",
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
  signIn: "Email and password",
  signInBody: "Phone, fingerprint, and Face ID sign-in are turned off.",
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

export const mission = {
  metaTitle: "What Lodgist is trying to do",
  kicker: "Aim",
  title: "What Lodgist is trying to do",
  lead: "Lodgist wants a renter in Imo to see what was checked before money leaves their account. It starts with one campus. A public home appears only after a person reviews it.",
  boardTitle: "Mission board",
  boardNote: "Each row is a product promise. None of these rows is a listing.",
  rows: [
    {
      status: "Written",
      title: "Show the checks before you pay",
      body: "The trust page says what a check covers. A Trust Score is not a promise that the house, the landlord, or the payment is safe.",
    },
    {
      status: "Not yet",
      title: "Publish a reviewed room near Nekede",
      body: "The Nekede page still says nothing to rent. An example card is not a home. A portal ad is not a Lodgist listing.",
    },
    {
      status: "In place",
      title: "Keep an ad from becoming a listing",
      body: "Submission is not publication. Payment never buys a verification badge.",
    },
    {
      status: "Written",
      title: "Take one home for review",
      body: "Advertise asks for the facts on one room. Sending those facts does not publish the room.",
    },
    {
      status: "Not yet",
      title: "Open more cities",
      body: "More cities come after homes are reviewed. Imo is the start.",
    },
  ],
  nextTitle: "What you can do now",
  readTrust: "Read how checks work",
  offerRoom: "Offer one room for review",
  seeNekede: "See the Nekede page",
  nekedeNext: "Read what Lodgist is trying to do",
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
  analytics: "We use Google Analytics to see anonymous, aggregated usage of the site.",
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

export const advertise = {
  metaTitle: "Advertise rooms in Owerri — Lodgist",
  badge: "Pilot · one campus · fee agreed upfront",
  title: "Present your rooms. Organize enquiries.",
  body: "Lodgist helps landlords and hostels present reviewed rooms, organize renter enquiries, and arrange viewings. Scope and fee are agreed before work starts. Tell us the facts for one home so a person can review it.",
  rule: "Payment never buys a verification badge. Submission is not publication. Verification stays a separate Lodgist review.",
  name: "Your name",
  phone: "WhatsApp number",
  area: "Location / area",
  areaPlaceholder: "e.g. Nekede",
  propertyCount: "How many rooms / homes? (optional)",
  notes: "Anything we should know (optional)",
  email: "Email (optional)",
  authority: "Your authority to list this home",
  authorityControls: "I control this home",
  authorityAuthorized: "I am authorized to list this home",
  photos: "Photos",
  photosYes: "Lodgist may publish photos of this home",
  photosNo: "Do not publish photos yet",
  availability: "Current availability",
  availableNow: "Available now",
  availableFrom: "Available from a date",
  notAvailable: "Not available now",
  availableFromDate: "Available from",
  rentPeriod: "Rent period",
  rentMonth: "Per month",
  rentYear: "Per year",
  rentSemester: "Per semester",
  feesTitle: "Move-in fees you already know",
  feesHint: "Choose unknown if you do not know the figure. Enter 0 when a fee does not apply. Payment never buys verification.",
  baseRent: "Base rent (NGN)",
  agency: "Agency fee (NGN)",
  legal: "Legal fee (NGN)",
  caution: "Caution fee (NGN)",
  inspection: "Inspection fee (NGN)",
  feeKnown: "I know the amount",
  feeUnknown: "Unknown",
  submit: "Submit facts for review",
  sending: "Saving…",
  saved: "Thanks. A teammate will contact you on WhatsApp to agree scope and fee. This does not verify any property. Payment never buys a verification badge. Submission is not publication.",
  failed: "We could not save that. Try again, or message us on WhatsApp.",
  waCta: "Prefer WhatsApp?",
  includedTitle: "What the paid offer covers",
  included: [
    "Help presenting rooms for Lodgist review",
    "Organizing enquiries and arranging viewings",
    "Clear scope and fee before work starts",
  ],
  excludedTitle: "What it does not include",
  excluded: [
    "A verification badge or Trust Score change. Payment never buys verification.",
    "Publication. Submission is not publication.",
    "Publishing fictional or sample homes as real stock",
  ],
};

