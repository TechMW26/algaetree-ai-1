/* eslint-disable no-console */
import { connectToDatabase } from "../src/lib/db/mongoose";
import { User } from "../src/lib/models/User";
import { AdminScope } from "../src/lib/models/AdminScope";
import { AlgaeTree } from "../src/lib/models/AlgaeTree";
import { hashPassword } from "../src/lib/auth/password";
import { ROLES, ACCESS_TYPES } from "../src/lib/constants";

// Seed coordinates mirror the existing hardcoded pods in NetworkMap.tsx so the
// map dropdown (Phase 5) has canonical data to center/zoom on.
const SEED_TREES = [
  {
    treeId: "AT00A0001",
    name: "AlgaeTree 1",
    location: "Roshanpura Square, Bhopal",
    lat: 23.2376013,
    lng: 77.4010502,
  },
  {
    treeId: "AT00A0002",
    name: "AlgaeTree 2",
    location: "Swami Vivekananda Theme Park",
    lat: 23.25869,
    lng: 77.43116,
  },
];

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD must be set in the environment",
    );
  }

  await connectToDatabase();

  // 1. Super Admin
  let superAdmin = await User.findOne({ email });
  if (superAdmin) {
    console.log(`Super Admin already exists: ${email}`);
  } else {
    superAdmin = await User.create({
      email,
      passwordHash: await hashPassword(password),
      role: ROLES.SUPER_ADMIN,
      createdBy: null,
      isActive: true,
    });
    console.log(`Created Super Admin: ${email}`);
  }

  // Super Admin implicitly has ALL access.
  await AdminScope.updateOne(
    { adminId: superAdmin._id },
    { $set: { accessType: ACCESS_TYPES.ALL } },
    { upsert: true },
  );

  // 2. AlgaeTree registry
  for (const tree of SEED_TREES) {
    await AlgaeTree.updateOne(
      { treeId: tree.treeId },
      { $set: tree },
      { upsert: true },
    );
    console.log(`Upserted AlgaeTree: ${tree.treeId}`);
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
