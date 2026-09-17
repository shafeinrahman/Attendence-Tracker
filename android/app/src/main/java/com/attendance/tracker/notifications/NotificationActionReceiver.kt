package com.attendance.tracker.notifications

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.attendance.tracker.data.repository.AttendanceRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null || intent.action != ACTION_RECORD_STATUS) return

        val slotId = intent.getStringExtra(EXTRA_SLOT_ID) ?: return
        val status = intent.getStringExtra(EXTRA_STATUS) ?: return
        val date = intent.getStringExtra(EXTRA_DATE) ?: return
        val notifId = intent.getIntExtra(EXTRA_NOTIF_ID, 0)

        // Dismiss the notification
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(notifId)

        // Record status asynchronously in Room & enqueue to sync
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repository = AttendanceRepository(context)
                repository.recordAttendance(
                    slotId = slotId,
                    date = date,
                    status = status,
                    source = "phone"
                )
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val ACTION_RECORD_STATUS = "com.attendance.tracker.ACTION_RECORD_STATUS"
        const val EXTRA_SLOT_ID = "extra_slot_id"
        const val EXTRA_STATUS = "extra_status"
        const val EXTRA_DATE = "extra_date"
        const val EXTRA_NOTIF_ID = "extra_notif_id"
    }
}
