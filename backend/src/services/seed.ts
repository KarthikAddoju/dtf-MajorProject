import { InstituteModel } from "../models/Institute";
import { slugify } from "../lib/validation";
import { runtimeConfig } from "../config/runtime";

const DEFAULT_INSTITUTES = [
  { name: "Indian Institute of Technology Hyderabad", shortCode: "IITH" },
  { name: "Jawaharlal Nehru Technological University Hyderabad", shortCode: "JNTUH" },
  { name: "Osmania University", shortCode: "OU" },
  { name: "Birla Institute of Technology and Science Pilani", shortCode: "BITS" },
  { name: "National Institute of Technology Warangal", shortCode: "NITW" },
  { name: "Indian Institute of Technology Bombay", shortCode: "IITB" },
  { name: "Indian Institute of Technology Delhi", shortCode: "IITD" },
  { name: "Indian Institute of Technology Madras", shortCode: "IITM" },
  { name: "Indian Institute of Technology Kanpur", shortCode: "IITK" },
  { name: "Indian Institute of Technology Kharagpur", shortCode: "IITKG" },
  { name: "Indian Institute of Technology Roorkee", shortCode: "IITR" },
  { name: "Indian Institute of Technology Guwahati", shortCode: "IITG" },
  { name: "Indian Institute of Technology (BHU) Varanasi", shortCode: "IITBHU" },
  { name: "Indian Institute of Technology Indore", shortCode: "IITI" },
  { name: "Indian Institute of Technology Gandhinagar", shortCode: "IITGN" },
  { name: "Indian Institute of Technology Ropar", shortCode: "IITRPR" },
  { name: "Indian Institute of Technology Patna", shortCode: "IITP" },
  { name: "Indian Institute of Technology Mandi", shortCode: "IITMD" },
  { name: "Indian Institute of Technology Jodhpur", shortCode: "IITJ" },
  { name: "Indian Institute of Technology Bhubaneswar", shortCode: "IITBBS" },
  { name: "Indian Institute of Technology Tirupati", shortCode: "IITT" },
  { name: "Indian Institute of Technology Palakkad", shortCode: "IITPKD" },
  { name: "Indian Institute of Technology Jammu", shortCode: "IITJMU" },
  { name: "Indian Institute of Technology Dharwad", shortCode: "IITDH" },
  { name: "Indian Institute of Technology (ISM) Dhanbad", shortCode: "IITISM" },
  { name: "National Institute of Technology Tiruchirappalli", shortCode: "NITT" },
  { name: "National Institute of Technology Karnataka, Surathkal", shortCode: "NITK" },
  { name: "National Institute of Technology Calicut", shortCode: "NITC" },
  { name: "National Institute of Technology Rourkela", shortCode: "NITR" },
  { name: "National Institute of Technology Durgapur", shortCode: "NITDGP" },
  { name: "National Institute of Technology Silchar", shortCode: "NITS" },
  { name: "National Institute of Technology Kurukshetra", shortCode: "NITKTR" },
  { name: "National Institute of Technology Patna", shortCode: "NITPNA" },
  { name: "Malaviya National Institute of Technology Jaipur", shortCode: "MNITJ" },
  { name: "Maulana Azad National Institute of Technology Bhopal", shortCode: "MANIT" },
  { name: "Motilal Nehru National Institute of Technology Allahabad", shortCode: "MNNITA" },
  { name: "National Institute of Technology Goa", shortCode: "NITGOA" },
  { name: "National Institute of Technology Agartala", shortCode: "NITA" },
  { name: "National Institute of Technology Hamirpur", shortCode: "NITH" },
  { name: "National Institute of Technology Jamshedpur", shortCode: "NITJSR" },
  { name: "International Institute of Information Technology Hyderabad", shortCode: "IIITH" },
  { name: "International Institute of Information Technology Bangalore", shortCode: "IIITB" },
  { name: "Indraprastha Institute of Information Technology Delhi", shortCode: "IIITD" },
  { name: "Indian Institute of Information Technology Allahabad", shortCode: "IIITA" },
  { name: "Indian Institute of Information Technology, Design and Manufacturing Gwalior", shortCode: "IIITGWL" },
  { name: "Delhi Technological University", shortCode: "DTU" },
  { name: "Netaji Subhas University of Technology", shortCode: "NSUT" },
  { name: "Vellore Institute of Technology", shortCode: "VIT" },
  { name: "Manipal Institute of Technology", shortCode: "MIT" },
  { name: "Anna University", shortCode: "ANNAU" },
];

export async function seedDefaultInstitutes() {
  if (!runtimeConfig.seedDefaultInstitutes) {
    return;
  }

  const desiredInstitutes = DEFAULT_INSTITUTES.map((institute) => ({
    ...institute,
    slug: slugify(institute.name),
  }));
  const desiredNames = desiredInstitutes.map((institute) => institute.name);
  const desiredSlugs = desiredInstitutes.map((institute) => institute.slug);
  const desiredShortCodes = desiredInstitutes.map(
    (institute) => institute.shortCode
  );
  const existingInstitutes = await InstituteModel.find({
    $or: [
      { name: { $in: desiredNames } },
      { slug: { $in: desiredSlugs } },
      { shortCode: { $in: desiredShortCodes } },
    ],
  })
    .select("name slug shortCode")
    .lean();
  const existingNames = new Set(existingInstitutes.map((institute) => institute.name));
  const existingSlugs = new Set(existingInstitutes.map((institute) => institute.slug));
  const existingShortCodes = new Set(
    existingInstitutes.map((institute) => institute.shortCode)
  );
  const missingInstitutes = desiredInstitutes.filter(
    (institute) =>
      !existingNames.has(institute.name) &&
      !existingSlugs.has(institute.slug) &&
      !existingShortCodes.has(institute.shortCode)
  );

  if (missingInstitutes.length === 0) {
    return;
  }

  await InstituteModel.insertMany(
    missingInstitutes.map((institute) => ({
      ...institute,
      isActive: true,
      verifierAddresses: runtimeConfig.bootstrapVerifierAddresses,
    }))
  );

  console.log(`Seeded default institutes: ${missingInstitutes.length}`);
}
