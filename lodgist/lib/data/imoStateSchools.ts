export interface School {
  id: string;
  name: string;
  shortName: string;
  location: string;
  lga: string;
  coordinates: { lat: number; lng: number };
  studentPopulation: number;
  housingDemand: "extreme" | "high" | "medium" | "lower";
  description: string;
}

export const IMO_STATE_SCHOOLS: School[] = [
  {
    id: "nekede",
    name: "Federal Polytechnic Nekede",
    shortName: "Poly Nekede",
    location: "Nekede, Owerri West",
    lga: "Owerri West",
    coordinates: { lat: 5.4833, lng: 7.0167 },
    studentPopulation: 15000,
    housingDemand: "extreme",
    description:
      "One of the largest polytechnics in South-East Nigeria. High demand for self-contain and shared apartments within 1–3km radius.",
  },
  {
    id: "futo",
    name: "Federal University of Technology Owerri",
    shortName: "FUTO",
    location: "Ihiagwa, Owerri",
    lga: "Owerri West",
    coordinates: { lat: 5.3837, lng: 7.0 },
    studentPopulation: 30000,
    housingDemand: "extreme",
    description:
      "Largest university in Imo State. Massive off-campus housing demand. Highest fraud concentration in the Owerri housing market.",
  },
  {
    id: "imsu",
    name: "Imo State University",
    shortName: "IMSU",
    location: "Owerri, Imo State",
    lga: "Owerri Municipal",
    coordinates: { lat: 5.485, lng: 7.035 },
    studentPopulation: 25000,
    housingDemand: "extreme",
    description:
      "State-owned university in central Owerri. Students compete heavily for affordable housing near campus.",
  },
  {
    id: "alvan",
    name: "Alvan Ikoku Federal College of Education",
    shortName: "Alvan Ikoku",
    location: "Owerri, Imo State",
    lga: "Owerri Municipal",
    coordinates: { lat: 5.48, lng: 7.033 },
    studentPopulation: 8000,
    housingDemand: "high",
    description:
      "Federal college of education. Shares the Owerri housing market with IMSU. Many students look for housing jointly.",
  },
  {
    id: "imopoly",
    name: "Imo State Polytechnic",
    shortName: "Imo Poly",
    location: "Umuagwo, Ohaji/Egbema",
    lga: "Ohaji/Egbema",
    coordinates: { lat: 5.2833, lng: 6.95 },
    studentPopulation: 6000,
    housingDemand: "high",
    description:
      "Growing polytechnic in Ohaji/Egbema. Underserved housing market — opportunity for verified listings.",
  },
  {
    id: "eastern-palm",
    name: "Eastern Palm University",
    shortName: "Eastern Palm",
    location: "Ogboko, Ideato South",
    lga: "Ideato South",
    coordinates: { lat: 5.7, lng: 7.2 },
    studentPopulation: 3000,
    housingDemand: "medium",
    description:
      "Private university in Ideato South. Smaller housing market but growing enrollment.",
  },
  {
    id: "hope",
    name: "Hope University",
    shortName: "Hope Uni",
    location: "Owerri, Imo State",
    lga: "Owerri Municipal",
    coordinates: { lat: 5.49, lng: 7.04 },
    studentPopulation: 2000,
    housingDemand: "medium",
    description:
      "Private university in Owerri. Shares the Owerri housing market. Students prefer areas near IMSU belt.",
  },
  {
    id: "seat-of-wisdom",
    name: "Seat of Wisdom Seminary College",
    shortName: "Seat of Wisdom",
    location: "Owerri, Imo State",
    lga: "Owerri Municipal",
    coordinates: { lat: 5.482, lng: 7.031 },
    studentPopulation: 1500,
    housingDemand: "lower",
    description:
      "Catholic seminary college. Smaller student body, mostly residential within campus.",
  },
];

export const SCHOOL_IDS = IMO_STATE_SCHOOLS.map((s) => s.id);

export function getSchoolById(id: string): School | undefined {
  return IMO_STATE_SCHOOLS.find((s) => s.id === id);
}

export function getSchoolsByLga(lga: string): School[] {
  return IMO_STATE_SCHOOLS.filter((s) => s.lga === lga);
}

export const OWERRI_SCHOOLS = IMO_STATE_SCHOOLS.filter(
  (s) => s.lga === "Owerri Municipal" || s.lga === "Owerri West",
);

const DEMAND_COLORS: Record<School["housingDemand"], string> = {
  extreme: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-[#1ABC9C]/10 text-[#0F9D7E]",
  lower: "bg-gray-100 text-gray-500",
};

export function demandBadgeClass(demand: School["housingDemand"]): string {
  return DEMAND_COLORS[demand];
}
