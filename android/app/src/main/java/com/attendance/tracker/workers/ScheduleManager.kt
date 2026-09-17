package com.attendance.tracker.workers

import android.content.Context
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.attendance.tracker.data.local.ClassSlotEntity
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

object ScheduleManager {

    fun scheduleRemindersForSlots(context: Context, slots: List<ClassSlotEntity>) {
        val workManager = WorkManager.getInstance(context)
        val now = Calendar.getInstance()
        val todayDateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now.time)

        for (slot in slots) {
            val parts = slot.startTime.split(":")
            if (parts.size != 2) continue

            val hour = parts[0].toIntOrNull() ?: continue
            val minute = parts[1].toIntOrNull() ?: continue

            val triggerCalendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                add(Calendar.MINUTE, -10) // 10 minutes before class (§4.4)
            }

            val delayMillis = triggerCalendar.timeInMillis - now.timeInMillis
            // Only schedule if class reminder is in the future
            if (delayMillis > 0) {
                val inputData = Data.Builder()
                    .putString(ClassReminderWorker.KEY_SLOT_ID, slot.id)
                    .putString(ClassReminderWorker.KEY_DATE, todayDateStr)
                    .build()

                val workRequest = OneTimeWorkRequestBuilder<ClassReminderWorker>()
                    .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
                    .setInputData(inputData)
                    .build()

                val uniqueWorkName = "reminder_${slot.id}_$todayDateStr"
                workManager.enqueueUniqueWork(
                    uniqueWorkName,
                    ExistingWorkPolicy.REPLACE,
                    workRequest
                )
            }
        }
    }
}
