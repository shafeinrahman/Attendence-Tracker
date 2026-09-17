package com.attendance.tracker

import android.app.Application
import com.attendance.tracker.data.local.AppDatabase
import com.attendance.tracker.notifications.NotificationHelper

class AttendanceApp : Application() {

    val database: AppDatabase by lazy {
        AppDatabase.getDatabase(this)
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        // Initialize notification channels
        NotificationHelper.createNotificationChannels(this)
    }

    companion object {
        lateinit var instance: AttendanceApp
            private set
    }
}
