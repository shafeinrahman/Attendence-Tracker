package com.attendance.tracker.workers

import android.app.NotificationManager
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.attendance.tracker.data.local.AppDatabase
import com.attendance.tracker.data.repository.AttendanceRepository
import com.attendance.tracker.data.repository.PreferencesManager
import com.attendance.tracker.notifications.NotificationHelper

class ClassStartAttendanceWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val slotId = inputData.getString(KEY_SLOT_ID) ?: return Result.failure()
        val date = inputData.getString(KEY_DATE) ?: return Result.failure()

        val db = AppDatabase.getDatabase(context)
        val dao = db.attendanceDao()
        val prefs = PreferencesManager(context)
        val repository = AttendanceRepository(context)

        // 1. Holiday check: suppress auto-marking on campus holidays
        val holiday = dao.getHolidayForDate(date)
        if (holiday != null) {
            return Result.success()
        }

        val slot = dao.getSlotById(slotId) ?: return Result.failure()

        // 2. Online class check: online sessions skip geofencing entirely (§4.4)
        if (slot.sessionMode == "online") {
            return Result.success()
        }

        // 3. Existing record check: do not overwrite if user already marked an explicit status
        val existingRecord = dao.getRecordForSlotAndDate(slotId, date)
        if (existingRecord != null) {
            if (existingRecord.status == "present" ||
                existingRecord.status == "cancelled_holiday" ||
                existingRecord.status == "excused" ||
                existingRecord.status == "absent" ||
                existingRecord.isBulkSkip) {
                return Result.success()
            }
        }

        // 4. Geofence evaluation at start of class:
        val isInside = prefs.isInsideCampus

        if (isInside) {
            // Auto assign attendance to present
            repository.recordAttendance(
                slotId = slot.id,
                date = date,
                status = "present",
                source = "phone"
            )

            val notificationId = slotId.hashCode()

            // Dismiss any lingering pre-class actionable notification
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(notificationId)

            // Notify user of successful automatic check-in
            NotificationHelper.showAutoAttendanceNotification(
                context = context,
                notificationId = notificationId + 100,
                courseCode = slot.courseCode,
                roomCode = slot.roomCode
            )
        }

        return Result.success()
    }

    companion object {
        const val KEY_SLOT_ID = "key_slot_id"
        const val KEY_DATE = "key_date"
    }
}
