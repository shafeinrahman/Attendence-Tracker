package com.attendance.tracker.data.remote

import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @POST("api/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<AuthResponse>

    @POST("api/auth/signup")
    suspend fun signup(
        @Body request: SignupRequest
    ): Response<AuthResponse>

    @GET("api/auth/me")
    suspend fun getMe(): Response<MeResponse>

    @GET("api/sync")
    suspend fun getSyncData(): Response<SyncResponse>

    @POST("api/sync/attendance")
    suspend fun postBatchAttendance(
        @Body request: BatchAttendanceRequest
    ): Response<BatchAttendanceResponse>

    @POST("api/attendance")
    suspend fun postAttendance(
        @Body request: AttendanceLogRequest
    ): Response<AttendanceLogResponse>

    @PATCH("api/attendance")
    suspend fun patchAttendance(
        @Body request: ExcuseRequest
    ): Response<AttendanceLogResponse>

    @DELETE("api/courses/{id}")
    suspend fun deleteCourse(
        @Path("id") courseId: String
    ): Response<Unit>
}

data class SyncResponse(
    val hasActiveSemester: Boolean,
    val semester: SemesterDto?,
    val geofence: GeofenceDto?,
    val courses: List<CourseDto>?,
    val slots: List<SlotDto>?,
    val holidays: List<HolidayDto>?,
    val recentRecords: List<AttendanceRecordDto>?
)

data class SemesterDto(
    val id: String,
    val name: String,
    val startDate: String,
    val endDate: String,
    val midtermWeekStart: String?,
    val midtermWeekEnd: String?,
    val purgeAt: String
)

data class GeofenceDto(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Float
)

data class CourseDto(
    val id: String,
    val code: String,
    val name: String,
    val category: String,
    val thresholdPct: Float
)

data class SlotDto(
    val id: String,
    val courseId: String,
    val courseCode: String,
    val courseName: String,
    val dayOfWeek: Int,
    val startTime: String,
    val endTime: String,
    val roomCode: String,
    val recurring: Boolean,
    val specificDate: String?,
    val sessionMode: String,
    val makeupForRecordId: String?
)

data class HolidayDto(
    val id: String,
    val semesterId: String,
    val date: String,
    val label: String?
)

data class AttendanceRecordDto(
    val id: String,
    val classSlotId: String,
    val date: String,
    val status: String,
    val countedInStats: Boolean,
    val isFirstWeek: Boolean,
    val isMidtermWeek: Boolean,
    val isBulkSkip: Boolean,
    val loggedAt: String,
    val source: String
)

data class BatchAttendanceRequest(
    val records: List<BatchRecordItem>
)

data class BatchRecordItem(
    val localSyncId: Long,
    val classSlotId: String,
    val date: String,
    val status: String,
    val source: String = "phone",
    val loggedAt: String,
    val isBulkSkip: Boolean = false
)

data class BatchAttendanceResponse(
    val success: Boolean,
    val acknowledgedCount: Int,
    val acknowledgedIds: List<Any>
)

data class AttendanceLogRequest(
    val classSlotId: String? = null,
    val date: String,
    val status: String? = null,
    val source: String = "phone",
    val isBulkSkip: Boolean = false
)

data class AttendanceLogResponse(
    val message: String?,
    val record: AttendanceRecordDto?
)

data class ExcuseRequest(
    val id: String,
    val status: String
)

data class LoginRequest(
    @SerializedName("studentId")
    val studentId: String,
    val password: String
)

data class SignupRequest(
    @SerializedName("studentId")
    val studentId: String,
    val password: String
)

data class UserDto(
    val id: String,
    @SerializedName(value = "studentId", alternate = ["username", "email"])
    val studentId: String
)

data class AuthResponse(
    val message: String?,
    val token: String,
    val user: UserDto
)

data class MeResponse(
    val user: UserDto
)

