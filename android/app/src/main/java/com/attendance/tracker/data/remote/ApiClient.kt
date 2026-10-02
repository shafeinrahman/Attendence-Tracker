package com.attendance.tracker.data.remote

import android.content.Context
import com.attendance.tracker.data.repository.PreferencesManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient(private val context: Context? = null) {

    fun getService(customBaseUrl: String? = null): ApiService {
        val prefs = context?.let { PreferencesManager(it) }

        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val token = prefs?.apiToken ?: ""
            val requestBuilder = original.newBuilder()
            if (token.isNotBlank()) {
                requestBuilder.header("Authorization", "Bearer $token")
                requestBuilder.header("x-api-token", token)
            }
            requestBuilder.method(original.method, original.body)
            chain.proceed(requestBuilder.build())
        }

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        val baseUrl = customBaseUrl ?: prefs?.apiBaseUrl ?: "https://attendence-tracker-ruddy.vercel.app/"
        val normalizedUrl = normalizeBaseUrl(baseUrl)

        return Retrofit.Builder()
            .baseUrl(normalizedUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }

    companion object {
        fun normalizeBaseUrl(input: String): String {
            var trimmed = input.trim()
            if (trimmed.isEmpty()) {
                return "https://attendence-tracker-ruddy.vercel.app/"
            }

            // If no scheme is provided, determine whether to use http (local) or https (remote)
            if (!trimmed.startsWith("http://", ignoreCase = true) && !trimmed.startsWith("https://", ignoreCase = true)) {
                val hostPart = trimmed.substringBefore("/").substringBefore(":")
                val isLocal = hostPart == "10.0.2.2" || hostPart == "localhost" || hostPart == "127.0.0.1" || hostPart.startsWith("192.168.")
                trimmed = if (isLocal) "http://$trimmed" else "https://$trimmed"
            }

            // If http:// was entered for a remote host (e.g. *.vercel.app), upgrade to https://
            if (trimmed.startsWith("http://", ignoreCase = true)) {
                val withoutScheme = trimmed.substring(7)
                val hostPart = withoutScheme.substringBefore("/").substringBefore(":")
                val isLocal = hostPart == "10.0.2.2" || hostPart == "localhost" || hostPart == "127.0.0.1" || hostPart.startsWith("192.168.")
                if (!isLocal && hostPart.contains(".")) {
                    trimmed = "https://$withoutScheme"
                }
            }

            return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
        }

        fun create(baseUrl: String): ApiService {
            val normalizedUrl = normalizeBaseUrl(baseUrl)
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            val client = OkHttpClient.Builder()
                .addInterceptor(logging)
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()

            return Retrofit.Builder()
                .baseUrl(normalizedUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
        }
    }
}
