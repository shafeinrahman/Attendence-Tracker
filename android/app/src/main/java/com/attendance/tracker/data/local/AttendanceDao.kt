package com.attendance.tracker.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceDao {

    // Semester
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSemester(semester: SemesterEntity)

    @Query("SELECT * FROM semesters WHERE isPurged = 0 LIMIT 1")
    suspend fun getActiveSemester(): SemesterEntity?

    @Query("SELECT * FROM semesters WHERE isPurged = 0 LIMIT 1")
    fun getActiveSemesterFlow(): Flow<SemesterEntity?>

    @Query("DELETE FROM semesters")
    suspend fun clearSemesters()

    // Courses
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCourses(courses: List<CourseEntity>)

    @Query("SELECT * FROM courses ORDER BY code ASC")
    fun getAllCoursesFlow(): Flow<List<CourseEntity>>

    @Query("SELECT * FROM courses WHERE id = :courseId")
    suspend fun getCourseById(courseId: String): CourseEntity?

    @Query("DELETE FROM courses WHERE id = :courseId")
    suspend fun deleteCourseById(courseId: String)

    @Query("DELETE FROM class_slots WHERE courseId = :courseId")
    suspend fun deleteSlotsForCourse(courseId: String)

    @Query("SELECT * FROM class_slots WHERE courseId = :courseId")
    suspend fun getSlotsForCourse(courseId: String): List<ClassSlotEntity>

    // Class Slots
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSlots(slots: List<ClassSlotEntity>)

    @Query("SELECT * FROM class_slots WHERE dayOfWeek = :dayOfWeek AND recurring = 1 ORDER BY startTime ASC")
    suspend fun getRecurringSlotsForDay(dayOfWeek: Int): List<ClassSlotEntity>

    @Query("SELECT * FROM class_slots WHERE specificDate = :date ORDER BY startTime ASC")
    suspend fun getSpecificSlotsForDate(date: String): List<ClassSlotEntity>

    @Query("SELECT * FROM class_slots WHERE id = :slotId")
    suspend fun getSlotById(slotId: String): ClassSlotEntity?

    @Query("SELECT * FROM class_slots")
    suspend fun getAllSlots(): List<ClassSlotEntity>

    // Attendance Records
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendanceRecord(record: AttendanceRecordEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendanceRecords(records: List<AttendanceRecordEntity>)

    @Query("SELECT * FROM attendance_records WHERE date = :date")
    suspend fun getRecordsForDate(date: String): List<AttendanceRecordEntity>

    @Query("SELECT * FROM attendance_records WHERE date = :date")
    fun getRecordsForDateFlow(date: String): Flow<List<AttendanceRecordEntity>>

    @Query("SELECT * FROM attendance_records WHERE classSlotId = :slotId AND date = :date LIMIT 1")
    suspend fun getRecordForSlotAndDate(slotId: String, date: String): AttendanceRecordEntity?

    @Query("SELECT * FROM attendance_records WHERE classSlotId IN (SELECT id FROM class_slots WHERE courseId = :courseId)")
    suspend fun getRecordsForCourse(courseId: String): List<AttendanceRecordEntity>

    // Holidays
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHolidays(holidays: List<HolidayEntity>)

    @Query("SELECT * FROM holidays WHERE date = :date LIMIT 1")
    suspend fun getHolidayForDate(date: String): HolidayEntity?

    // Geofence
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGeofence(geofence: GeofenceEntity)

    @Query("SELECT * FROM geofence LIMIT 1")
    suspend fun getGeofence(): GeofenceEntity?

    // Offline Sync Queue
    @Insert
    suspend fun enqueueSync(item: SyncQueueEntity): Long

    @Query("SELECT * FROM sync_queue ORDER BY localId ASC")
    suspend fun getPendingSyncItems(): List<SyncQueueEntity>

    @Query("DELETE FROM sync_queue WHERE localId IN (:localIds)")
    suspend fun removeSyncItems(localIds: List<Long>)

    // Complete local purge (§4.8)
    @Transaction
    suspend fun purgeAllData() {
        clearSemesters()
        clearCourses()
        clearSlots()
        clearAttendance()
        clearHolidays()
        clearGeofence()
        clearSyncQueue()
    }

    @Query("DELETE FROM courses")
    suspend fun clearCourses()

    @Query("DELETE FROM class_slots")
    suspend fun clearSlots()

    @Query("DELETE FROM attendance_records")
    suspend fun clearAttendance()

    @Query("DELETE FROM holidays")
    suspend fun clearHolidays()

    @Query("DELETE FROM geofence")
    suspend fun clearGeofence()

    @Query("DELETE FROM sync_queue")
    suspend fun clearSyncQueue()
}
