package com.attendance.tracker.data.repository

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class PreferencesManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = try {
        EncryptedSharedPreferences.create(
            context,
            "secure_attendance_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback for non-GCM hardware or test environments
        context.getSharedPreferences("attendance_prefs_fallback", Context.MODE_PRIVATE)
    }

    var apiBaseUrl: String
        get() = sharedPreferences.getString(KEY_BASE_URL, "http://10.0.2.2:3000/") ?: "http://10.0.2.2:3000/"
        set(value) {
            val normalized = if (value.endsWith("/")) value else "$value/"
            sharedPreferences.edit().putString(KEY_BASE_URL, normalized).apply()
        }

    var apiToken: String
        get() = sharedPreferences.getString(KEY_API_TOKEN, "attendance-secret-token-12345") ?: "attendance-secret-token-12345"
        set(value) = sharedPreferences.edit().putString(KEY_API_TOKEN, value.trim()).apply()

    var isInsideCampus: Boolean
        get() = sharedPreferences.getBoolean(KEY_INSIDE_CAMPUS, false)
        set(value) = sharedPreferences.edit().putBoolean(KEY_INSIDE_CAMPUS, value).apply()

    var lastSyncTimestamp: Long
        get() = sharedPreferences.getLong(KEY_LAST_SYNC, 0L)
        set(value) = sharedPreferences.edit().putLong(KEY_LAST_SYNC, value).apply()

    companion object {
        private const val KEY_BASE_URL = "api_base_url"
        private const val KEY_API_TOKEN = "api_token"
        private const val KEY_INSIDE_CAMPUS = "is_inside_campus"
        private const val KEY_LAST_SYNC = "last_sync_timestamp"
    }
}
