package com.attendance.tracker.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.attendance.tracker.data.local.AppDatabase
import com.attendance.tracker.data.repository.PreferencesManager
import com.attendance.tracker.notifications.NotificationHelper

class ClassReminderWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val slotId = inputData.getString(KEY_SLOT_ID) ?: return Result.failure()
        val date = inputData.getString(KEY_DATE) ?: return Result.failure()

        val db = AppDatabase.getDatabase(context)
        val dao = db.attendanceDao()
        val prefs = PreferencesManager(context)

        // 1. Holiday check: suppress notifications on holidays (§4.10)
        val holiday = dao.getHolidayForDate(date)
        if (holiday != null) {
            return Result.success()
        }

        val slot = dao.getSlotById(slotId) ?: return Result.failure()

        // 2. Existing record check: suppress if bulk skipped or already marked (§4.11)
        val existingRecord = dao.getRecordForSlotAndDate(slotId, date)
        if (existingRecord != null) {
            if (existingRecord.isBulkSkip || existingRecord.status == "cancelled_holiday") {
                return Result.success()
            }
        }

        // 3. Online class check: (§4.4 / §4.9)
        val notificationId = slotId.hashCode()
        if (slot.sessionMode == "online") {
            NotificationHelper.showOnlineClassNotification(
                context = context,
                notificationId = notificationId,
                slotId = slot.id,
                courseCode = slot.courseCode,
                date = date
            )
            return Result.success()
        }

        // 4. Back-to-back classes check: (§7)
        // If class 1 (same course) was already marked present today, suppress status prompt for class 2 but fire plain campus nudge
        var suppressPromptForBackToBack = false
        val todayRecords = dao.getRecordsForDate(date)
        val courseRecords = todayRecords.filter { record ->
            // check if same course
            record.status == "present"
        }
        if (courseRecords.isNotEmpty() && existingRecord?.status != "present") {
            // Check if user is already present in another slot of this course today
            val slotCourse = dao.getCourseById(slot.courseId)
            if (slotCourse != null) {
                suppressPromptForBackToBack = true
            }
        }

        // 5. Geofence evaluation:
        val isInside = prefs.isInsideCampus

        if (isInside || suppressPromptForBackToBack) {
            // Inside campus (or back-to-back): plain informational notification
            NotificationHelper.showOnCampusNotification(
                context = context,
                notificationId = notificationId,
                courseCode = slot.courseCode,
                roomCode = slot.roomCode
            )
        } else {
            // Outside campus: actionable notification with 3 buttons
            NotificationHelper.showOffCampusActionableNotification(
                context = context,
                notificationId = notificationId,
                slotId = slot.id,
                courseCode = slot.courseCode,
                roomCode = slot.roomCode,
                date = date
            )
        }

        return Result.success()
    }

    companion object {
        const val KEY_SLOT_ID = "key_slot_id"
        const val KEY_DATE = "key_date"
    }
}
