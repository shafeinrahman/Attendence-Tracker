package com.attendance.tracker.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "semesters")
data class SemesterEntity(
    @PrimaryKey val id: String,
    val name: String,
    val startDate: String,
    val endDate: String,
    val midtermWeekStart: String?,
    val midtermWeekEnd: String?,
    val purgeAt: String,
    val isPurged: Boolean = false
)

@Entity(tableName = "courses")
data class CourseEntity(
    @PrimaryKey val id: String,
    val semesterId: String,
    val code: String,
    val name: String,
    val category: String, // "theory" | "lab"
    val thresholdPct: Float
)

@Entity(tableName = "class_slots")
data class ClassSlotEntity(
    @PrimaryKey val id: String,
    val courseId: String,
    val courseCode: String,
    val courseName: String,
    val dayOfWeek: Int, // 1 (Mon) - 7 (Sun)
    val startTime: String, // "09:30"
    val endTime: String,   // "11:00"
    val roomCode: String,  // "402C"
    val recurring: Boolean,
    val specificDate: String?,
    val sessionMode: String, // "in_person" | "online"
    val makeupForRecordId: String?
)

@Entity(tableName = "attendance_records")
data class AttendanceRecordEntity(
    @PrimaryKey val id: String,
    val classSlotId: String,
    val date: String, // YYYY-MM-DD
    val status: String, // "present" | "running_late" | "cancelled_holiday" | "absent" | "excused"
    val countedInStats: Boolean,
    val isFirstWeek: Boolean,
    val isMidtermWeek: Boolean,
    val isBulkSkip: Boolean,
    val loggedAt: String,
    val source: String
)

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val classSlotId: String,
    val date: String,
    val status: String,
    val source: String = "phone",
    val loggedAt: String,
    val isBulkSkip: Boolean = false,
    val attempts: Int = 0
)

@Entity(tableName = "holidays")
data class HolidayEntity(
    @PrimaryKey val id: String,
    val semesterId: String,
    val date: String, // YYYY-MM-DD
    val label: String?
)

@Entity(tableName = "geofence")
data class GeofenceEntity(
    @PrimaryKey val id: String,
    val semesterId: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Float
)
