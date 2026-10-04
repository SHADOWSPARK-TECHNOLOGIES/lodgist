/**
 * Honest copy for the Owerri campus pilot.
 * This module is not a listing, not a seed, and not an intake form.
 * It exports no home, price, landlord, photo, or source.
 */

const ADVERTISE_HREF = "/advertise";
const ARTICLE_HREF = "/nekede/supply";

/** Public rows introduced by this content. Stays empty. */
const PUBLIC_LISTING_ROWS = [];

const nekedePage = {
  metaTitle: "Nekede — nothing to rent yet",
  metaDescription:
    "This page is not a listing. Lodgist is running one Owerri campus pilot. Live public listings are empty until a real home is approved.",
  kicker: "Nekede · not a listing",
  title: "Nothing to rent here yet.",
  intro:
    "This page is not a listing. Lodgist is running one Owerri campus pilot, near Federal Polytechnic Nekede. Nothing on this page is available to rent.",
  todayTitle: "What Lodgist is running today",
  today: [
    "The public list is only for Lodgist-reviewed homes that are not samples.",
    "Live public listings are empty until a real home is approved.",
    "Review for display is not verification.",
    "Payment does not buy a badge.",
    "Viewing stays verified-only. A viewing request opens only when the home status is verified.",
  ],
  sourceRule:
    "Any future seed row or public listing row must name its source. Lodgist will not publish scraped or invented data.",
  adsRule:
    "Google ads are not running. They are a later way to earn, once there is real content and real traffic.",
  articleLink: "Who can supply a home",
  advertiseLink: "Send facts for review",
  localNote:
    "The note below stays on this phone. It does not publish a home, and it does not make a room available.",
  example: {
    aria: "Example only",
    label: "Example only · not a home · not available",
    title: "Example Lodge",
    landlord: "Not a real landlord. No WhatsApp number.",
    fees: [
      ["Rent", "Example figure, not a bill"],
      ["Agency", "Example figure, not a bill"],
      ["Legal", "Example figure, not a bill"],
      ["Caution", "Example figure, not a bill"],
    ],
    body: "This block shows the note layout only. It is not a home, and it is not available.",
    footer: "Not a verified badge. Not a Trust Score. Students cannot enquire about this example.",
  },
};

const supplyArticle = {
  metaTitle: "Who can supply a home — Owerri pilot",
  metaDescription:
    "Lodgist needs a person who controls a house or is allowed to manage it. This article does not publish a home.",
  kicker: "Owerri campus pilot · not a form",
  title: "Who can supply a home",
  standfirst:
    "This article is not a form, and it does not publish a home. English is the rule. Nigerian Pidgin beside it says the same rule again.",
  publishesHome: false,
  advertiseHref: ADVERTISE_HREF,
  advertiseLabel: "Send facts on the advertise page",
  sections: [
    {
      id: "who",
      heading: "Who Lodgist can hear from",
      english:
        "Lodgist needs a person who actually controls a house, or a person who is allowed to manage that house. An agent can help only when the agent has that authority. An agent who does not control the house, and who has not been allowed to manage it, cannot put the house forward.",
      pidgin:
        "Lodgist need person wey really control the house, or person wey dem allow to manage that same house. Agent fit help only when the agent get that authority. If the agent no control the house, and the person wey control the house never allow the agent to manage am, the agent no fit bring the house come.",
    },
    {
      id: "facts",
      heading: "How a person supplies the publish facts",
      english:
        "A person supplies the publish facts in the list below. The advertise page is the existing intake. It collects the facts that form already asks for. This article is not that form. Sending facts does not publish a home. A person at Lodgist approves display only after the facts are supplied. Until that approval, the home stays off the public list.",
      pidgin:
        "Person go supply the publish facts for the list below. The advertise page na the intake wey already dey. E collect the facts wey that form already ask. This article no be that form. If person send facts, that one no publish house. Person for Lodgist go approve display only after the facts don dey. Before that approval, the house no dey for public list.",
    },
    {
      id: "source",
      heading: "Source of any future row",
      english:
        "Any future seed row or public listing row must name its source. Lodgist will not publish scraped or invented data. That includes homes, prices, landlords, photos, and sources.",
      pidgin:
        "Any seed row or public listing row wey go come later must name the source. Lodgist no go publish data wey dem scrape, and Lodgist no go publish data wey dem invent. That one include house, price, landlord, photo, and source.",
    },
    {
      id: "ads",
      heading: "Google ads",
      english:
        "Google ads are not running. Google ads are only a later way to earn, once there is real content and real traffic. They are not part of this pilot today.",
      pidgin:
        "Google ads no dey run now. Google ads na only later way to earn money, after real content dey and real people dey visit the site. E no be part of this pilot today.",
    },
    {
      id: "limits",
      heading: "What approval does not do",
      english:
        "Review for display is not verification. Payment does not buy a badge. Viewing stays verified-only. A viewing request opens only when the home status is verified.",
      pidgin:
        "Review for display no be verification. Payment no dey buy badge. Viewing stay verified-only. Person fit request viewing only when the home status be verified.",
    },
  ],
  factsHeading: "Publish facts, in order",
  factsIntro: {
    english:
      "These are the facts a person supplies. Authority is CONTROLS or AUTHORIZED. The address is in Owerri, Imo, and names the LGA. The last step is a person approving display. This list is not a form.",
    pidgin:
      "Na these facts person go supply. Authority na CONTROLS or AUTHORIZED. The address dey for Owerri, Imo, and e name the LGA. The last step na when one person approve display. This list no be form.",
  },
  facts: [
    { id: "landlord-name", english: "Landlord name", pidgin: "Landlord name" },
    { id: "email", english: "Email", pidgin: "Email" },
    { id: "phone", english: "Phone", pidgin: "Phone" },
    {
      id: "authority",
      english: "Authority: CONTROLS or AUTHORIZED",
      pidgin: "Authority: CONTROLS or AUTHORIZED. CONTROLS mean you control the house. AUTHORIZED mean the controller allow you to manage am.",
    },
    {
      id: "photos",
      english: "Photo permission",
      pidgin: "Photo permission: whether Lodgist fit publish photos of that house.",
    },
    {
      id: "availability",
      english: "Availability",
      pidgin: "Availability: if the house dey free now, from one date, or e no free.",
    },
    {
      id: "address",
      english: "Address in Owerri, Imo, and the LGA",
      pidgin: "Address for Owerri, Imo, and the LGA.",
    },
    {
      id: "rent-period",
      english: "Rent period",
      pidgin: "Rent period: month, year, or semester.",
    },
    { id: "rent-amount", english: "Rent amount", pidgin: "Rent amount." },
    { id: "move-in", english: "Move-in fees", pidgin: "Move-in fees." },
    { id: "title", english: "Title", pidgin: "Title of the home." },
    { id: "description", english: "Description", pidgin: "Description of the home." },
    {
      id: "approval",
      english: "Then a person approves display",
      pidgin: "After that, one person approve display. Before that approval, the house no dey for the public list.",
    },
  ],
  afterLink: {
    english:
      "The advertise page saves a request for a person to review. It does not publish a home. Payment does not buy a badge.",
    pidgin:
      "The advertise page go save the request so person fit review am. E no dey publish house. Payment no dey buy badge.",
  },
};

function publicListingRows() {
  return PUBLIC_LISTING_ROWS.slice();
}

module.exports = {
  ADVERTISE_HREF,
  ARTICLE_HREF,
  PUBLIC_LISTING_ROWS,
  nekedePage,
  supplyArticle,
  publicListingRows,
};
