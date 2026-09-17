const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with sample active semester and courses...");

  // Clean existing non-purged semesters if any
  await prisma.holiday.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.classSlot.deleteMany();
  await prisma.course.deleteMany();
  await prisma.campusGeofence.deleteMany();
  await prisma.semester.deleteMany();

  const startDate = new Date("2026-09-01T00:00:00Z");
  const endDate = new Date("2026-12-20T00:00:00Z");
  const purgeAt = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const semester = await prisma.semester.create({
    data: {
      name: "Fall 2026",
      startDate,
      endDate,
      midtermWeekStart: new Date("2026-10-25T00:00:00Z"),
      midtermWeekEnd: new Date("2026-10-31T23:59:59Z"),
      purgeAt,
      purged: false,
    },
  });

  console.log(`Created Semester: ${semester.name} (${semester.id})`);

  // Campus geofence
  const geofence = await prisma.campusGeofence.create({
    data: {
      semesterId: semester.id,
      latitude: 23.777176,
      longitude: 90.399452,
      radiusMeters: 300,
    },
  });
  console.log("Created Campus Geofence at lat/lon 23.777, 90.399");

  // Courses
  const algo = await prisma.course.create({
    data: {
      semesterId: semester.id,
      code: "CSE331",
      name: "Algorithms",
      category: "theory",
      categorySource: "inferred",
      thresholdPct: 70.0,
    },
  });

  const algoLab = await prisma.course.create({
    data: {
      semesterId: semester.id,
      code: "CSE331L",
      name: "Algorithms Lab",
      category: "lab",
      categorySource: "inferred",
      thresholdPct: 90.0,
    },
  });

  const math = await prisma.course.create({
    data: {
      semesterId: semester.id,
      code: "MAT201",
      name: "Linear Algebra",
      category: "theory",
      categorySource: "inferred",
      thresholdPct: 70.0,
    },
  });

  // Class Slots (1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat, 7 = Sun)
  // CSE331: Monday & Wednesday 09:30-11:00 Room 402C
  const slot1 = await prisma.classSlot.create({
    data: {
      courseId: algo.id,
      dayOfWeek: 1, // Monday
      startTime: "09:30",
      endTime: "11:00",
      roomCode: "402C",
      sessionMode: "in_person",
    },
  });

  const slot2 = await prisma.classSlot.create({
    data: {
      courseId: algo.id,
      dayOfWeek: 3, // Wednesday
      startTime: "09:30",
      endTime: "11:00",
      roomCode: "402C",
      sessionMode: "in_person",
    },
  });

  // CSE331L: Thursday 14:00-17:00 Room L-201L
  const slot3 = await prisma.classSlot.create({
    data: {
      courseId: algoLab.id,
      dayOfWeek: 4, // Thursday
      startTime: "14:00",
      endTime: "17:00",
      roomCode: "L-201L",
      sessionMode: "in_person",
    },
  });

  // MAT201: Tuesday & Thursday 11:30-13:00 Room 501C
  const slot4 = await prisma.classSlot.create({
    data: {
      courseId: math.id,
      dayOfWeek: 2, // Tuesday
      startTime: "11:30",
      endTime: "13:00",
      roomCode: "501C",
      sessionMode: "in_person",
    },
  });

  const slot5 = await prisma.classSlot.create({
    data: {
      courseId: math.id,
      dayOfWeek: 4, // Thursday
      startTime: "11:30",
      endTime: "13:00",
      roomCode: "501C",
      sessionMode: "in_person",
    },
  });

  console.log("Created 5 class slots");

  // Holiday: 2026-10-15
  await prisma.holiday.create({
    data: {
      semesterId: semester.id,
      date: new Date("2026-10-15T00:00:00Z"),
      label: "University Foundation Day",
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
