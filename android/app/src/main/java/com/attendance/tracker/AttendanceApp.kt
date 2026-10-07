package com.attendance.tracker

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.work.*
import com.attendance.tracker.data.local.AppDatabase
import com.attendance.tracker.data.repository.PreferencesManager
import com.attendance.tracker.notifications.NotificationHelper
import com.attendance.tracker.workers.SyncWorker
import java.util.concurrent.TimeUnit

class AttendanceApp : Application() {

    val database: AppDatabase by lazy {
        AppDatabase.getDatabase(this)
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize notification channels
        NotificationHelper.createNotificationChannels(this)

        // Setup automatic sync on network connection
        setupNetworkAutoSync()
    }

    private fun setupNetworkAutoSync() {
        try {
            val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val networkRequest = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            connectivityManager.registerNetworkCallback(networkRequest, object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    val prefs = PreferencesManager(applicationContext)
                    if (prefs.isLoggedIn) {
                        val constraints = Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED)
                            .build()

                        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                            .setConstraints(constraints)
                            .build()

                        WorkManager.getInstance(applicationContext).enqueueUniqueWork(
                            "network_available_auto_sync",
                            ExistingWorkPolicy.REPLACE,
                            syncRequest
                        )
                    }
                }
            })

            // Schedule periodic background sync with network constraint
            val periodicSync = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()

            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "periodic_network_sync",
                ExistingPeriodicWorkPolicy.KEEP,
                periodicSync
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    companion object {
        lateinit var instance: AttendanceApp
            private set
    }
}
