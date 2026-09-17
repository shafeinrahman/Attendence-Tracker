package com.attendance.tracker.data.remote

import android.content.Context
import com.attendance.tracker.data.repository.PreferencesManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient(private val context: Context) {

    private val prefs = PreferencesManager(context)

    fun getService(): ApiService {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val token = prefs.apiToken
            val requestBuilder = original.newBuilder()
                .header("Authorization", "Bearer $token")
                .header("x-api-token", token)
                .method(original.method, original.body)

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

        val baseUrl = prefs.apiBaseUrl

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
