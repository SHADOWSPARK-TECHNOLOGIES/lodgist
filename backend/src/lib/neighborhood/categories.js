// N1: Lodgist neighborhood categories mapped to Google Places (New) Table A types.
// Only stable Table A types are used; an unknown type makes searchNearby fail.
const CATEGORY_TYPES = Object.freeze({
  groceries: ["supermarket", "grocery_store", "convenience_store", "market"],
  healthcare: ["hospital", "doctor", "dental_clinic", "medical_lab"],
  pharmacy: ["pharmacy", "drugstore"],
  education: ["school", "primary_school", "secondary_school", "preschool", "university"],
  banking: ["bank", "atm"],
  restaurants: ["restaurant", "fast_food_restaurant", "cafe"],
  shopping: ["shopping_mall", "department_store", "clothing_store", "electronics_store"],
  fuel: ["gas_station"],
  fitness: ["gym", "fitness_center"],
});

const CATEGORIES = Object.freeze(Object.keys(CATEGORY_TYPES));

function isCategory(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CATEGORY_TYPES, value);
}

// Google types to send for one category, or for all of them.
function typesFor(category) {
  if (category) return [...CATEGORY_TYPES[category]];
  return [...new Set(CATEGORIES.flatMap((c) => CATEGORY_TYPES[c]))];
}

// Map a Google place back to a Lodgist category: primary type first, then the other types.
function categoryForTypes(primaryType, types = []) {
  const candidates = [primaryType, ...(Array.isArray(types) ? types : [])].filter(Boolean);
  for (const t of candidates) {
    for (const c of CATEGORIES) if (CATEGORY_TYPES[c].includes(t)) return c;
  }
  return null;
}

module.exports = { CATEGORY_TYPES, CATEGORIES, isCategory, typesFor, categoryForTypes };
