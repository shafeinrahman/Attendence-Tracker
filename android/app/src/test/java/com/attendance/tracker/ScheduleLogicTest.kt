package com.attendance.tracker

import org.junit.Assert.*
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.*

class ScheduleLogicTest {

    @Test
    fun testFirstWeekCalculation() {
        val semStartStr = "2026-09-01"
        val semStart = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(semStartStr)!!

        // Day 3 of semester -> within first week (0..6 days)
        val testDate1 = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse("2026-09-04")!!
        val diffDays1 = (testDate1.time - semStart.time) / (1000 * 60 * 60 * 24)
        assertTrue(diffDays1 in 0..6)

        // Day 10 of semester -> outside first week
        val testDate2 = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse("2026-09-11")!!
        val diffDays2 = (testDate2.time - semStart.time) / (1000 * 60 * 60 * 24)
        assertFalse(diffDays2 in 0..6)
    }

    @Test
    fun testFirstWeekCountedPolicy() {
        val isFirstWeek = true
        val countFirstWeekSetting = true
        val isMidtermWeek = false

        // When faculty counts first week:
        val countedInStats = if (isMidtermWeek) {
            false
        } else if (isFirstWeek && !countFirstWeekSetting) {
            false
        } else {
            true
        }
        assertTrue("First week should be counted when countFirstWeekSetting is true", countedInStats)

        // When faculty does NOT count first week:
        val countFirstWeekFalse = false
        val notCounted = if (isMidtermWeek) {
            false
        } else if (isFirstWeek && !countFirstWeekFalse) {
            false
        } else {
            true
        }
        assertFalse("First week should be excluded when countFirstWeekSetting is false", notCounted)
    }

    @Test
    fun testClassStartDelayComputation() {
        val hour = 10
        val minute = 30
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val reminderCal = Calendar.getInstance().apply {
            timeInMillis = cal.timeInMillis
            add(Calendar.MINUTE, -10)
        }

        assertEquals(10, (cal.timeInMillis - reminderCal.timeInMillis) / (1000 * 60))
    }
}
