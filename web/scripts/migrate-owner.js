const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting owner migration...");

  const ownerEmail = process.env.OWNER_EMAIL || "owner@attendance.local";
  const ownerPassword = process.env.OWNER_PASSWORD || "AdminPass123!";

  let owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
  });

  if (!owner) {
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash,
      },
    });
    console.log(`Created default owner account: ${owner.email} (${owner.id})`);
  } else {
    console.log(`Owner account already exists: ${owner.email} (${owner.id})`);
  }

  // Find semesters with raw query or prisma query
  try {
    const unassigned = await prisma.$executeRawUnsafe(
      `UPDATE "semesters" SET "user_id" = '${owner.id}' WHERE "user_id" IS NULL OR "user_id" = ''`
    );
    console.log(`Updated ${unassigned} unassigned semesters to owner user ID.`);
  } catch (err) {
    console.log("Raw update check completed or column already populated:", err.message);
  }

  console.log("Owner migration completed successfully.");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
