package com.attendance.tracker.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.attendance.tracker.data.repository.AttendanceRepository
import com.attendance.tracker.geofence.GeofenceManager

class SyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val repository = AttendanceRepository(context)
            repository.sync()

            // After sync, schedule today's class reminders
            val todaySlots = repository.getTodaySlots()
            ScheduleManager.scheduleRemindersForSlots(context, todaySlots)

            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
