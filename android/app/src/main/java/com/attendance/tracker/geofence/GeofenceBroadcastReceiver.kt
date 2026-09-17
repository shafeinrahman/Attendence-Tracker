package com.attendance.tracker.geofence

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.attendance.tracker.data.repository.PreferencesManager
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent

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
            }
            Geofence.GEOFENCE_TRANSITION_EXIT -> {
                prefs.isInsideCampus = false
            }
        }
    }
}
