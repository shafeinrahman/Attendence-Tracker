package com.attendance.tracker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.attendance.tracker.data.local.ClassSlotEntity
import com.attendance.tracker.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    isInsideCampus: Boolean,
    todaySlots: List<Pair<ClassSlotEntity, String?>>, // Slot and current status
    isHoliday: Boolean,
    holidayLabel: String?,
    onRecordStatus: (slotId: String, status: String) -> Unit,
    onSkipToday: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Today's Attendance",
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(if (isInsideCampus) Emerald500 else Amber500)
                            )
                            Text(
                                text = if (isInsideCampus) "On Campus (Inside Geofence)" else "Off Campus",
                                fontSize = 12.sp,
                                color = if (isInsideCampus) Emerald500 else Amber500
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Slate900,
                    titleContentColor = Color.White
                )
            )
        },
        containerColor = Slate950
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
                // Holiday Banner
                if (isHoliday) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Slate900),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.EventBusy,
                                contentDescription = null,
                                tint = Indigo400
                            )
                            Column {
                                Text(
                                    text = "Campus Holiday",
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                                Text(
                                    text = holidayLabel ?: "Classes are cancelled and notifications suppressed.",
                                    color = Color.LightGray,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                } else if (todaySlots.isNotEmpty()) {
                    // Quick Action: Skip Today (§4.11)
                    Button(
                        onClick = onSkipToday,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Rose500.copy(alpha = 0.2f),
                            contentColor = Rose500
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Default.FastForward,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Skip Today (Mark All as Absent)",
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            if (todaySlots.isEmpty() && !isHoliday) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No classes scheduled for today.",
                            color = Color.Gray,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            items(todaySlots) { (slot, currentStatus) ->
                ClassSlotCard(
                    slot = slot,
                    currentStatus = currentStatus,
                    onRecordStatus = onRecordStatus
                )
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun ClassSlotCard(
    slot: ClassSlotEntity,
    currentStatus: String?,
    onRecordStatus: (slotId: String, status: String) -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Slate900),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = slot.courseCode,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        Text(
                            text = if (slot.sessionMode == "online") "ONLINE" else slot.roomCode,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (slot.sessionMode == "online") Indigo400 else Color.LightGray,
                            modifier = Modifier
                                .background(Slate800, RoundedCornerShape(6.dp))
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                    Text(
                        text = slot.courseName,
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }

                Text(
                    text = "${slot.startTime} - ${slot.endTime}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }

            // Status display
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Status: ${currentStatus?.replace("_", " ")?.capitalize() ?: "Not Logged"}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = when (currentStatus) {
                        "present" -> Emerald500
                        "running_late" -> Amber500
                        "absent" -> Rose500
                        "cancelled_holiday" -> Color.Gray
                        "excused" -> Indigo400
                        else -> Color.Gray
                    }
                )
            }

            // Quick Status Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onRecordStatus(slot.id, "present") },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (currentStatus == "present") Emerald500 else Slate800,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(text = "Present", fontSize = 11.sp)
                }

                Button(
                    onClick = { onRecordStatus(slot.id, "running_late") },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (currentStatus == "running_late") Amber500 else Slate800,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(text = "Late", fontSize = 11.sp)
                }

                Button(
                    onClick = { onRecordStatus(slot.id, "absent") },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (currentStatus == "absent") Rose500 else Slate800,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(text = "Absent", fontSize = 11.sp)
                }
            }
        }
    }
}
