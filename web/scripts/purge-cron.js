const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function runPurgeCheck() {
  console.log(`[Purge Cron] Checking for semesters due for purge at ${new Date().toISOString()}`);
  try {
    const now = new Date();

    // Find all semesters where now >= purgeAt and purged is false
    const dueSemesters = await prisma.semester.findMany({
      where: {
        purgeAt: { lte: now },
        purged: false,
      },
    });

    if (dueSemesters.length === 0) {
      console.log("[Purge Cron] No semesters due for purge.");
      return;
    }

    for (const semester of dueSemesters) {
      console.log(`[Purge Cron] Purging semester: ${semester.name} (id: ${semester.id}, purgeAt: ${semester.purgeAt.toISOString()})`);

      // 1. Delete associated data (cascade will handle child models if set up, or explicit delete)
      await prisma.holiday.deleteMany({ where: { semesterId: semester.id } });
      await prisma.campusGeofence.deleteMany({ where: { semesterId: semester.id } });

      const courses = await prisma.course.findMany({ where: { semesterId: semester.id }, select: { id: true } });
      const courseIds = courses.map((c) => c.id);

      if (courseIds.length > 0) {
        const slots = await prisma.classSlot.findMany({ where: { courseId: { in: courseIds } }, select: { id: true } });
        const slotIds = slots.map((s) => s.id);

        if (slotIds.length > 0) {
          await prisma.attendanceRecord.deleteMany({ where: { classSlotId: { in: slotIds } } });
          await prisma.classSlot.deleteMany({ where: { id: { in: slotIds } } });
        }
        await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
      }

      // Mark semester as purged
      await prisma.semester.update({
        where: { id: semester.id },
        data: { purged: true },
      });

      console.log(`[Purge Cron] Successfully purged semester ${semester.id}`);
    }
  } catch (error) {
    console.error("[Purge Cron] Error during purge execution:", error);
  }
}

// If executed directly, run once and schedule every 24 hours (or 1 hour check loop)
async function main() {
  await runPurgeCheck();

  // Run every 1 hour when run as a background service
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(async () => {
    await runPurgeCheck();
  }, ONE_HOUR);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[Purge Cron Fatal Error]", err);
    process.exit(1);
  });
}

module.exports = { runPurgeCheck };
