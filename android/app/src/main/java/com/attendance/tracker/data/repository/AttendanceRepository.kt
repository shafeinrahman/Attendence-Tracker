package com.attendance.tracker.data.repository

import android.content.Context
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.attendance.tracker.data.local.*
import com.attendance.tracker.data.remote.ApiClient
import com.attendance.tracker.data.remote.BatchAttendanceRequest
import com.attendance.tracker.data.remote.BatchRecordItem
import com.attendance.tracker.workers.SyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

class AttendanceRepository(private val context: Context) {

    private val db = AppDatabase.getDatabase(context)
    private val dao = db.attendanceDao()
    private val prefs = PreferencesManager(context)
    private val apiClient = ApiClient(context)

    suspend fun recordAttendance(
        slotId: String,
        date: String,
        status: String,
        source: String = "phone",
        isBulkSkip: Boolean = false
    ) = withContext(Dispatchers.IO) {
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        val record = AttendanceRecordEntity(
            id = UUID.randomUUID().toString(),
            classSlotId = slotId,
            date = date,
            status = status,
            countedInStats = status !in listOf("cancelled_holiday", "excused"),
            isFirstWeek = false,
            isMidtermWeek = false,
            isBulkSkip = isBulkSkip,
            loggedAt = nowIso,
            source = source
        )

        // 1. Insert into local Room cache
        dao.insertAttendanceRecord(record)

        // 2. Insert into offline sync queue
        val queueItem = SyncQueueEntity(
            classSlotId = slotId,
            date = date,
            status = status,
            source = source,
            loggedAt = nowIso,
            isBulkSkip = isBulkSkip
        )
        dao.enqueueSync(queueItem)

        // 3. Trigger immediate sync attempt if connected
        triggerImmediateSync()
    }

    suspend fun skipEntireDay(date: String) = withContext(Dispatchers.IO) {
        val targetDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(date) ?: Date()
        val calendar = Calendar.getInstance().apply { time = targetDate }
        val jsDay = calendar.get(Calendar.DAY_OF_WEEK) // 1=Sun, 2=Mon...
        val isoDay = if (jsDay == Calendar.SUNDAY) 7 else jsDay - 1

        val recurring = dao.getRecurringSlotsForDay(isoDay)
        val specific = dao.getSpecificSlotsForDate(date)
        val allSlots = (recurring + specific).distinctBy { it.id }

        for (slot in allSlots) {
            recordAttendance(
                slotId = slot.id,
                date = date,
                status = "absent",
                source = "phone",
                isBulkSkip = true
            )
        }
    }

    suspend fun sync() = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()

            // 1. Flush offline sync queue first
            val pending = dao.getPendingSyncItems()
            if (pending.isNotEmpty()) {
                val batchItems = pending.map {
                    BatchRecordItem(
                        localSyncId = it.localId,
                        classSlotId = it.classSlotId,
                        date = it.date,
                        status = it.status,
                        source = it.source,
                        loggedAt = it.loggedAt,
                        isBulkSkip = it.isBulkSkip
                    )
                }

                val pushResponse = service.postBatchAttendance(BatchAttendanceRequest(batchItems))
                if (pushResponse.isSuccessful && pushResponse.body()?.success == true) {
                    dao.removeSyncItems(pending.map { it.localId })
                }
            }

            // 2. Fetch active semester & schedule
            val syncRes = service.getSyncData()
            if (syncRes.isSuccessful) {
                val body = syncRes.body()
                if (body != null) {
                    if (!body.hasActiveSemester || body.semester == null) {
                        // Semester was purged on backend! Clear phone local cache (§4.8)
                        dao.purgeAllData()
                        return@withContext
                    }

                    val sem = body.semester
                    dao.insertSemester(
                        SemesterEntity(
                            id = sem.id,
                            name = sem.name,
                            startDate = sem.startDate,
                            endDate = sem.endDate,
                            midtermWeekStart = sem.midtermWeekStart,
                            midtermWeekEnd = sem.midtermWeekEnd,
                            purgeAt = sem.purgeAt,
                            isPurged = false
                        )
                    )

                    body.geofence?.let { g ->
                        dao.insertGeofence(
                            GeofenceEntity(
                                id = g.id,
                                semesterId = sem.id,
                                latitude = g.latitude,
                                longitude = g.longitude,
                                radiusMeters = g.radiusMeters
                            )
                        )
                    }

                    body.courses?.let { courses ->
                        dao.insertCourses(
                            courses.map {
                                CourseEntity(
                                    id = it.id,
                                    semesterId = sem.id,
                                    code = it.code,
                                    name = it.name,
                                    category = it.category,
                                    thresholdPct = it.thresholdPct
                                )
                            }
                        )
                    }

                    body.slots?.let { slots ->
                        dao.insertSlots(
                            slots.map {
                                ClassSlotEntity(
                                    id = it.id,
                                    courseId = it.courseId,
                                    courseCode = it.courseCode,
                                    courseName = it.courseName,
                                    dayOfWeek = it.dayOfWeek,
                                    startTime = it.startTime,
                                    endTime = it.endTime,
                                    roomCode = it.roomCode,
                                    recurring = it.recurring,
                                    specificDate = it.specificDate,
                                    sessionMode = it.sessionMode,
                                    makeupForRecordId = it.makeupForRecordId
                                )
                            }
                        )
                    }

                    body.holidays?.let { holidays ->
                        dao.insertHolidays(
                            holidays.map {
                                HolidayEntity(
                                    id = it.id,
                                    semesterId = it.semesterId,
                                    date = it.date,
                                    label = it.label
                                )
                            }
                        )
                    }

                    body.recentRecords?.let { records ->
                        dao.insertAttendanceRecords(
                            records.map {
                                AttendanceRecordEntity(
                                    id = it.id,
                                    classSlotId = it.classSlotId,
                                    date = it.date.slice(0..9),
                                    status = it.status,
                                    countedInStats = it.countedInStats,
                                    isFirstWeek = it.isFirstWeek,
                                    isMidtermWeek = it.isMidtermWeek,
                                    isBulkSkip = it.isBulkSkip,
                                    loggedAt = it.loggedAt,
                                    source = it.source
                                )
                            }
                        )
                    }

                    prefs.lastSyncTimestamp = System.currentTimeMillis()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun triggerImmediateSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueue(request)
    }

    suspend fun getTodaySlots(): List<ClassSlotEntity> = withContext(Dispatchers.IO) {
        val today = Calendar.getInstance()
        val jsDay = today.get(Calendar.DAY_OF_WEEK)
        val isoDay = if (jsDay == Calendar.SUNDAY) 7 else jsDay - 1
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(today.time)

        val recurring = dao.getRecurringSlotsForDay(isoDay)
        val specific = dao.getSpecificSlotsForDate(dateStr)
        (recurring + specific).distinctBy { it.id }
    }

    suspend fun getTodayHoliday(): HolidayEntity? = withContext(Dispatchers.IO) {
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        dao.getHolidayForDate(dateStr)
    }

    suspend fun dropCourse(courseId: String) = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            service.deleteCourse(courseId)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        // Remove locally as well
        dao.deleteSlotsForCourse(courseId)
        dao.deleteCourseById(courseId)
    }
}
