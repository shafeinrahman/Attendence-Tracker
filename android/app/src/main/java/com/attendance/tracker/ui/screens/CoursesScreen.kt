package com.attendance.tracker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.attendance.tracker.data.local.CourseEntity
import com.attendance.tracker.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CoursesScreen(
    courses: List<CourseEntity>,
    courseRooms: Map<String, List<String>> = emptyMap(),
    onDropCourse: ((courseId: String) -> Unit)? = null
) {
    var courseToDrop by remember { mutableStateOf<CourseEntity?>(null) }

    if (courseToDrop != null) {
        val course = courseToDrop!!
        AlertDialog(
            onDismissRequest = { courseToDrop = null },
            title = {
                Text(
                    text = "Drop Course: ${course.code}",
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            },
            text = {
                Text(
                    text = "Are you sure you want to drop ${course.code} (${course.name})? All associated class slots and attendance records will be permanently removed.",
                    color = Color.LightGray,
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val id = course.id
                        courseToDrop = null
                        onDropCourse?.invoke(id)
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Rose500,
                        contentColor = Color.White
                    )
                ) {
                    Text("Drop Course")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { courseToDrop = null }
                ) {
                    Text("Cancel", color = Color.Gray)
                }
            },
            containerColor = Slate900
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Enrolled Courses",
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
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
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Thresholds: 70% Theory, 90% Lab",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }

            if (courses.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No courses cached. Tap 'Sync Now' in Settings.",
                            color = Color.Gray,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            items(courses) { course ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Slate900),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = course.code,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = Color.White
                            )

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "${course.category.uppercase()} (${course.thresholdPct.toInt()}%)",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (course.category == "lab") Indigo400 else Emerald500,
                                    modifier = Modifier
                                        .background(Slate800, RoundedCornerShape(6.dp))
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                )

                                if (onDropCourse != null) {
                                    IconButton(
                                        onClick = { courseToDrop = course },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "Drop Course",
                                            tint = Rose500.copy(alpha = 0.8f),
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            }
                        }

                        Text(
                            text = course.name,
                            fontSize = 13.sp,
                            color = Color.LightGray
                        )

                        val rooms = courseRooms[course.id] ?: emptyList()
                        if (rooms.isNotEmpty()) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier.padding(top = 2.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Place,
                                    contentDescription = null,
                                    tint = Indigo400,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = "Room: ${rooms.joinToString(", ")}",
                                    fontSize = 12.sp,
                                    color = Indigo400,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}
