import { InstituteModel } from "../models/Institute";
import { slugify } from "../lib/validation";
import { runtimeConfig } from "../config/runtime";

const DEFAULT_INSTITUTES = [
  { name: "Indian Institute of Technology Hyderabad", shortCode: "IITH" },
  { name: "Jawaharlal Nehru Technological University Hyderabad", shortCode: "JNTUH" },
  { name: "Osmania University", shortCode: "OU" },
  { name: "Birla Institute of Technology and Science Pilani", shortCode: "BITS" },
  { name: "National Institute of Technology Warangal", shortCode: "NITW" },
];

export async function seedDefaultInstitutes() {
  if (!runtimeConfig.seedDefaultInstitutes) {
    return;
  }

  const instituteCount = await InstituteModel.countDocuments();

  if (instituteCount > 0) {
    return;
  }

  await InstituteModel.insertMany(
    DEFAULT_INSTITUTES.map((institute) => ({
      ...institute,
      slug: slugify(institute.name),
      isActive: true,
      verifierAddresses: runtimeConfig.bootstrapVerifierAddresses,
    }))
  );

  console.log("Seeded default institutes");
}
