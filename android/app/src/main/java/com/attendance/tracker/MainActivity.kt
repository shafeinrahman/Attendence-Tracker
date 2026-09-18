package com.attendance.tracker

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.attendance.tracker.data.local.ClassSlotEntity
import com.attendance.tracker.data.repository.AttendanceRepository
import com.attendance.tracker.data.repository.PreferencesManager
import com.attendance.tracker.ui.screens.CoursesScreen
import com.attendance.tracker.ui.screens.HomeScreen
import com.attendance.tracker.ui.screens.LoginScreen
import com.attendance.tracker.ui.screens.SettingsScreen
import com.attendance.tracker.ui.theme.AttendanceTrackerTheme
import com.attendance.tracker.ui.theme.Slate900
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {

    private lateinit var repository: AttendanceRepository
    private lateinit var prefs: PreferencesManager

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Permissions granted callback
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = AttendanceRepository(this)
        prefs = PreferencesManager(this)

        requestRequiredPermissions()

        // Trigger background sync only if logged in
        if (prefs.isLoggedIn) {
            lifecycleScope.launch {
                repository.sync()
            }
        }

        setContent {
            AttendanceTrackerTheme {
                MainAppContent()
            }
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    @Composable
    fun MainAppContent() {
        var isLoggedIn by remember { mutableStateOf(prefs.isLoggedIn) }

        if (!isLoggedIn) {
            LoginScreen(
                prefs = prefs,
                onLoginSuccess = {
                    isLoggedIn = true
                    lifecycleScope.launch {
                        repository.sync()
                    }
                }
            )
            return
        }

        var selectedTab by remember { mutableStateOf(0) }
        val isInsideCampus by remember { mutableStateOf(prefs.isInsideCampus) }
        var todaySlotsWithStatus by remember { mutableStateOf<List<Pair<ClassSlotEntity, String?>>>(emptyList()) }
        var isHoliday by remember { mutableStateOf(false) }
        var holidayLabel by remember { mutableStateOf<String?>(null) }
        var isSyncing by remember { mutableStateOf(false) }

        val db = AttendanceApp.instance.database
        val courses by db.attendanceDao().getAllCoursesFlow().collectAsState(initial = emptyList())

        fun refreshTodayData() {
            lifecycleScope.launch {
                val slots = repository.getTodaySlots()
                val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                val records = db.attendanceDao().getRecordsForDate(todayStr)
                val recordMap = records.associateBy { it.classSlotId }

                todaySlotsWithStatus = slots.map { slot ->
                    slot to recordMap[slot.id]?.status
                }

                val hol = repository.getTodayHoliday()
                isHoliday = hol != null
                holidayLabel = hol?.label
            }
        }

        LaunchedEffect(isLoggedIn) {
            if (isLoggedIn) {
                refreshTodayData()
            }
        }

        Scaffold(
            bottomBar = {
                NavigationBar(containerColor = Slate900) {
                    NavigationBarItem(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        icon = { Icon(Icons.Default.CalendarToday, contentDescription = null) },
                        label = { Text("Today") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        icon = { Icon(Icons.Default.Book, contentDescription = null) },
                        label = { Text("Courses") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                        label = { Text("Settings") }
                    )
                }
            }
        ) { padding ->
            androidx.compose.foundation.layout.Box(modifier = Modifier.padding(padding)) {
                when (selectedTab) {
                    0 -> HomeScreen(
                        isInsideCampus = isInsideCampus,
                        todaySlots = todaySlotsWithStatus,
                        isHoliday = isHoliday,
                        holidayLabel = holidayLabel,
                        onRecordStatus = { slotId, status ->
                            lifecycleScope.launch {
                                val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                                repository.recordAttendance(slotId, todayStr, status)
                                refreshTodayData()
                            }
                        },
                        onSkipToday = {
                            lifecycleScope.launch {
                                val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                                repository.skipEntireDay(todayStr)
                                refreshTodayData()
                            }
                        }
                    )
                    1 -> CoursesScreen(courses = courses)
                    2 -> SettingsScreen(
                        currentBaseUrl = prefs.apiBaseUrl,
                        currentToken = prefs.apiToken,
                        userEmail = prefs.userEmail,
                        isSyncing = isSyncing,
                        onSaveSettings = { url, token ->
                            prefs.apiBaseUrl = url
                            prefs.apiToken = token
                        },
                        onManualSync = {
                            isSyncing = true
                            lifecycleScope.launch {
                                repository.sync()
                                refreshTodayData()
                                isSyncing = false
                            }
                        },
                        onLogout = {
                            prefs.logout()
                            isLoggedIn = false
                        }
                    )
                }
            }
        }
    }
}
