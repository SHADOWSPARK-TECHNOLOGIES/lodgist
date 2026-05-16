import * as z from "zod";

// ─── Nigerian States & LGAs ───────────────────────────────────────
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna",
  "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

export const PROPERTY_TYPES = [
  "apartment",
  "house",
  "land",
  "commercial",
] as const;

export const AMENITIES = [
  "Parking",
  "Generator",
  "Water Tank",
  "CCTV",
  "Security Guard",
  "Internet",
  "Swimming Pool",
  "Gym",
  "Playground",
  "Balcony",
  "AC",
  "Furnished",
  "Wardrobe",
  "Kitchen Cabinet",
  "Tiled Floor",
  "POP Ceiling",
] as const;

// ─── File validation helper ────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
];

// ─── Schemas ───────────────────────────────────────────────────────

export const propertyCreateSchema = z.object({
  // Location
  address: z.string({ message: "Address is required." }).min(1, "Address is required."),
  city: z.string({ message: "City is required." }).min(1, "City is required."),
  state: z.enum(NIGERIAN_STATES, { message: "Please select a valid Nigerian state." }),
  lga: z.string({ message: "LGA is required." }).min(1, "LGA is required."),

  // Property details
  title: z
    .string({ message: "Title is required." })
    .min(3, "Title must be at least 3 characters."),
  description: z
    .string({ message: "Description is required." })
    .min(10, "Description must be at least 10 characters.")
    .max(5000, "Description must not exceed 5,000 characters."),
  propertyType: z.enum(PROPERTY_TYPES, { message: "Please select a property type." }),
  price: z.coerce
    .number({ message: "Price must be a number." })
    .positive("Price must be a positive number."),

  // Residential fields (optional for land/commercial)
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),

  // Amenities
  amenities: z.array(z.enum(AMENITIES)).optional(),

  // Images
  images: z
    .array(
      z
        .instanceof(File)
        .refine((f) => f.size <= MAX_FILE_SIZE, "Max file size is 10 MB.")
        .refine(
          (f) => ACCEPTED_IMAGE_TYPES.includes(f.type),
          "Only .jpg, .jpeg, .png, .webp, .avif formats are supported."
        )
    )
    .max(10, "Maximum 10 images allowed.")
    .optional(),

  // Owner (set server-side from session — not required from client)
  ownerId: z.number().int().positive().optional(),
});

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;

export const propertyUpdateSchema = propertyCreateSchema.partial();
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;
