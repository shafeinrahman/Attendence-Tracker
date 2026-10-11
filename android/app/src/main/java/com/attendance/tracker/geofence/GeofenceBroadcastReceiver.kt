package com.attendance.tracker.geofence

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.attendance.tracker.data.local.AppDatabase
import com.attendance.tracker.data.repository.AttendanceRepository
import com.attendance.tracker.data.repository.PreferencesManager
import com.attendance.tracker.notifications.NotificationHelper
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class GeofenceBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return

        val geofencingEvent = GeofencingEvent.fromIntent(intent) ?: return
        if (geofencingEvent.hasError()) {
            return
        }

        val prefs = PreferencesManager(context)
        val transition = geofencingEvent.geofenceTransition

        when (transition) {
            Geofence.GEOFENCE_TRANSITION_ENTER,
            Geofence.GEOFENCE_TRANSITION_DWELL -> {
                prefs.isInsideCampus = true
                checkAndAutoMarkOngoingClasses(context)
            }
            Geofence.GEOFENCE_TRANSITION_EXIT -> {
                prefs.isInsideCampus = false
            }
        }
    }

    private fun checkAndAutoMarkOngoingClasses(context: Context) {
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val db = AppDatabase.getDatabase(context)
                val dao = db.attendanceDao()
                val repository = AttendanceRepository(context)

                val todayDateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                if (dao.getHolidayForDate(todayDateStr) != null) return@launch

                val todaySlots = repository.getTodaySlots()
                val now = Calendar.getInstance()

                for (slot in todaySlots) {
                    if (slot.sessionMode == "online") continue

                    val startParts = slot.startTime.split(":")
                    if (startParts.size != 2) continue
                    val startHour = startParts[0].toIntOrNull() ?: continue
                    val startMinute = startParts[1].toIntOrNull() ?: continue

                    val endParts = slot.endTime.split(":")
                    val endHour = if (endParts.size == 2) endParts[0].toIntOrNull() ?: (startHour + 1) else (startHour + 1)
                    val endMinute = if (endParts.size == 2) endParts[1].toIntOrNull() ?: startMinute else startMinute

                    val startCal = Calendar.getInstance().apply {
                        set(Calendar.HOUR_OF_DAY, startHour)
                        set(Calendar.MINUTE, startMinute)
                        set(Calendar.SECOND, 0)
                        set(Calendar.MILLISECOND, 0)
                    }
                    val endCal = Calendar.getInstance().apply {
                        set(Calendar.HOUR_OF_DAY, endHour)
                        set(Calendar.MINUTE, endMinute)
                        set(Calendar.SECOND, 0)
                        set(Calendar.MILLISECOND, 0)
                    }

                    // Check if current time is within [start, end]
                    if (now.timeInMillis in startCal.timeInMillis..endCal.timeInMillis) {
                        val existing = dao.getRecordForSlotAndDate(slot.id, todayDateStr)
                        if (existing == null || existing.status == "running_late") {
                            // User entered campus during this class: auto-mark present
                            repository.recordAttendance(slot.id, todayDateStr, "present", "phone")

                            val notificationId = slot.id.hashCode()
                            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                            notificationManager.cancel(notificationId)

                            NotificationHelper.showAutoAttendanceNotification(
                                context,
                                notificationId + 100,
                                slot.courseCode,
                                slot.roomCode
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                pendingResult.finish()
            }
        }
    }
}
