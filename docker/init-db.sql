-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('in_person', 'online');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'running_late', 'cancelled_holiday', 'absent', 'excused');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('phone', 'desktop', 'default');

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_student_id_key" ON "users"("student_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "semesters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "midterm_week_start" TIMESTAMP(3),
    "midterm_week_end" TIMESTAMP(3),
    "purge_at" TIMESTAMP(3) NOT NULL,
    "purged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "courses" (
    "id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "category_source" TEXT NOT NULL DEFAULT 'inferred',
    "threshold_pct" DOUBLE PRECISION NOT NULL DEFAULT 70.0,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "class_slots" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room_code" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "specific_date" TIMESTAMP(3),
    "session_mode" "SessionMode" NOT NULL DEFAULT 'in_person',
    "makeup_for_record_id" TEXT,

    CONSTRAINT "class_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_records" (
    "id" TEXT NOT NULL,
    "class_slot_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "counted_in_stats" BOOLEAN NOT NULL DEFAULT true,
    "is_first_week" BOOLEAN NOT NULL DEFAULT false,
    "is_midterm_week" BOOLEAN NOT NULL DEFAULT false,
    "is_bulk_skip" BOOLEAN NOT NULL DEFAULT false,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "AttendanceSource" NOT NULL DEFAULT 'phone',

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "campus_geofences" (
    "id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" DOUBLE PRECISION NOT NULL DEFAULT 300.0,

    CONSTRAINT "campus_geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "holidays" (
    "id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_class_slot_id_date_key" ON "attendance_records"("class_slot_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "campus_geofences_semester_id_key" ON "campus_geofences"("semester_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "holidays_semester_id_date_key" ON "holidays"("semester_id", "date");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'semesters_user_id_fkey') THEN
        ALTER TABLE "semesters" ADD CONSTRAINT "semesters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_semester_id_fkey') THEN
        ALTER TABLE "courses" ADD CONSTRAINT "courses_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_slots_course_id_fkey') THEN
        ALTER TABLE "class_slots" ADD CONSTRAINT "class_slots_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_slots_makeup_for_record_id_fkey') THEN
        ALTER TABLE "class_slots" ADD CONSTRAINT "class_slots_makeup_for_record_id_fkey" FOREIGN KEY ("makeup_for_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_class_slot_id_fkey') THEN
        ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_class_slot_id_fkey" FOREIGN KEY ("class_slot_id") REFERENCES "class_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campus_geofences_semester_id_fkey') THEN
        ALTER TABLE "campus_geofences" ADD CONSTRAINT "campus_geofences_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'holidays_semester_id_fkey') THEN
        ALTER TABLE "holidays" ADD CONSTRAINT "holidays_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
