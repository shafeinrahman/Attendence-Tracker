package com.attendance.tracker.workers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.attendance.tracker.data.local.AppDatabase
import com.attendance.tracker.geofence.GeofenceManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val db = AppDatabase.getDatabase(context)
                    val dao = db.attendanceDao()

                    // Re-register geofence if present
                    val geofence = dao.getGeofence()
                    if (geofence != null) {
                        val manager = GeofenceManager(context)
                        manager.registerCampusGeofence(
                            geofence.latitude,
                            geofence.longitude,
                            geofence.radiusMeters
                        )
                    }

                    // Enqueue sync worker to refresh schedule and reminders
                    val request = OneTimeWorkRequestBuilder<SyncWorker>().build()
                    WorkManager.getInstance(context).enqueue(request)
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }
}
