package com.attendance.tracker.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.attendance.tracker.MainActivity

object NotificationHelper {

    const val CHANNEL_ID = "attendance_reminders_channel"
    const val CHANNEL_NAME = "Class Reminders & Geofencing"

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Reminders 10 minutes before class and geofence-based status actions"
                enableVibration(true)
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * Informational notification (§4.4):
     * Inside geofence -> plain informational notification: "Go to class: CSE331, Room 402C". Nothing to tap.
     */
    fun showOnCampusNotification(
        context: Context,
        notificationId: Int,
        courseCode: String,
        roomCode: String
    ) {
        val openAppIntent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Go to class: $courseCode (Room: $roomCode)")
            .setContentText("Room: $roomCode — Starting in 10 minutes")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }

    /**
     * Actionable notification (§4.4):
     * Outside geofence -> actionable notification with three buttons:
     * - "Running Late" -> status = "running_late"
     * - "Cancelled / Holiday" -> status = "cancelled_holiday"
     * - "I'm Skipping" -> status = "absent"
     */
    fun showOffCampusActionableNotification(
        context: Context,
        notificationId: Int,
        slotId: String,
        courseCode: String,
        roomCode: String,
        date: String
    ) {
        // Tapping body opens app
        val openAppIntent = Intent(context, MainActivity::class.java)
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 1: Running Late
        val lateIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_RECORD_STATUS
            putExtra(NotificationActionReceiver.EXTRA_SLOT_ID, slotId)
            putExtra(NotificationActionReceiver.EXTRA_STATUS, "running_late")
            putExtra(NotificationActionReceiver.EXTRA_DATE, date)
            putExtra(NotificationActionReceiver.EXTRA_NOTIF_ID, notificationId)
        }
        val latePending = PendingIntent.getBroadcast(
            context,
            notificationId * 10 + 1,
            lateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 2: Cancelled / Holiday
        val cancelIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_RECORD_STATUS
            putExtra(NotificationActionReceiver.EXTRA_SLOT_ID, slotId)
            putExtra(NotificationActionReceiver.EXTRA_STATUS, "cancelled_holiday")
            putExtra(NotificationActionReceiver.EXTRA_DATE, date)
            putExtra(NotificationActionReceiver.EXTRA_NOTIF_ID, notificationId)
        }
        val cancelPending = PendingIntent.getBroadcast(
            context,
            notificationId * 10 + 2,
            cancelIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 3: I'm Skipping (logs as absent immediately)
        val skipIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_RECORD_STATUS
            putExtra(NotificationActionReceiver.EXTRA_SLOT_ID, slotId)
            putExtra(NotificationActionReceiver.EXTRA_STATUS, "absent")
            putExtra(NotificationActionReceiver.EXTRA_DATE, date)
            putExtra(NotificationActionReceiver.EXTRA_NOTIF_ID, notificationId)
        }
        val skipPending = PendingIntent.getBroadcast(
            context,
            notificationId * 10 + 3,
            skipIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Off Campus: $courseCode (Room: $roomCode)")
            .setContentText("Room $roomCode — Class begins in 10 minutes. Confirm your attendance status:")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setContentIntent(contentPendingIntent)
            .setAutoCancel(true)
            .addAction(android.R.drawable.ic_menu_recent_history, "Running Late", latePending)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancelled / Holiday", cancelPending)
            .addAction(android.R.drawable.ic_delete, "I'm Skipping", skipPending)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }

    /**
     * Online class reminder (§4.4 / §4.9):
     * Skips geofencing. Fires plain reminder and status options.
     */
    fun showOnlineClassNotification(
        context: Context,
        notificationId: Int,
        slotId: String,
        courseCode: String,
        date: String
    ) {
        val openAppIntent = Intent(context, MainActivity::class.java)
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val presentIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_RECORD_STATUS
            putExtra(NotificationActionReceiver.EXTRA_SLOT_ID, slotId)
            putExtra(NotificationActionReceiver.EXTRA_STATUS, "present")
            putExtra(NotificationActionReceiver.EXTRA_DATE, date)
            putExtra(NotificationActionReceiver.EXTRA_NOTIF_ID, notificationId)
        }
        val presentPending = PendingIntent.getBroadcast(
            context,
            notificationId * 10 + 4,
            presentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val skipIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_RECORD_STATUS
            putExtra(NotificationActionReceiver.EXTRA_SLOT_ID, slotId)
            putExtra(NotificationActionReceiver.EXTRA_STATUS, "absent")
            putExtra(NotificationActionReceiver.EXTRA_DATE, date)
            putExtra(NotificationActionReceiver.EXTRA_NOTIF_ID, notificationId)
        }
        val skipPending = PendingIntent.getBroadcast(
            context,
            notificationId * 10 + 5,
            skipIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Online Class: $courseCode — Join Now")
            .setContentText("Remote class starts in 10 minutes.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(contentPendingIntent)
            .setAutoCancel(true)
            .addAction(android.R.drawable.ic_input_add, "Present", presentPending)
            .addAction(android.R.drawable.ic_delete, "Skipping", skipPending)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }
}
