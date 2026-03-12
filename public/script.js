// public/script.js
// Provider calendar UI
let currentMonth = 3; // 1 to 12
let currentYear = 2026;

// Run once when the page loads
refreshCalendar();

// Show a user facing message
function showMessage(text, kind) {
    const el = document.getElementById("message");
    el.textContent = text;
    el.className = kind;
}

// GET all appointments then re-render the month view
function refreshCalendar() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/appointments");
    xhr.onload = function () {
        if (xhr.status === 200) {
            const rawSlots = JSON.parse(xhr.responseText);
            renderCalendar(rawSlots);
        } else {
            showMessage("GET failed " + String(xhr.status), "error");
        }
    };
    xhr.send();
}

// Render the month grid, then insert slot items into each day cell
function renderCalendar(rawSlots) {
    setMonthTitle(currentMonth, currentYear);
    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";

    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const startWeekday = firstDay.getDay(); // 0 Sunday to 6 Saturday
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Pretend today's date is March 1, 2026
    const todayDate = 1;
    const todayMonth = 3;
    const todayYear = 2026;

    for (let i = 0; i < 42; i += 1) {
        const dayNumber = i - startWeekday + 1;
        const cell = document.createElement("div");
        cell.className = "dayCell";

        if (dayNumber >= 1 && dayNumber <= daysInMonth) {
            // Highlight today's cell
            if (dayNumber === todayDate && currentMonth === todayMonth && currentYear === todayYear) {
                cell.classList.add("today");
            }

            // Day label at the top of the cell
            const label = document.createElement("div");
            label.className = "dayNumber";
            label.textContent = String(dayNumber);
            cell.appendChild(label);

            // Check each appointment to see if this day falls within its date range
            let slotCount = 0;
            var dayOfWeek = i % 7; // 0=Sun, 6=Sat

            for (let j = 0; j < rawSlots.length; j += 1) {
                const slot = rawSlots[j];

                // Extract date-only strings for start and end
                const startDateStr = slot.startTime.split("T")[0];
                const endDateStr = slot.endTime.split("T")[0];
                var currentDateStr = currentYear + "-" +
                    String(currentMonth).padStart(2, "0") + "-" +
                    String(dayNumber).padStart(2, "0");

                // Check if this day falls within the appointment range (inclusive)
                if (currentDateStr >= startDateStr && currentDateStr <= endDateStr) {
                    slotCount += 1;

                    var isFirstDay = (currentDateStr === startDateStr);
                    var isLastDay = (currentDateStr === endDateStr);
                    var isSingleDay = isFirstDay && isLastDay;

                    // Determine rounding based on position and week boundaries
                    var leftRound = isFirstDay || (dayOfWeek === 0);
                    var rightRound = isLastDay || (dayOfWeek === 6);

                    const item = document.createElement("div");
                    item.className = "slotItem";

                    if (slot.status === "booked") {
                        item.classList.add("booked");
                    } else {
                        item.classList.add("available");
                    }

                    // Position class for connected multi-day look
                    if (!isSingleDay) {
                        if (leftRound && !rightRound) {
                            item.classList.add("slotStart");
                        } else if (!leftRound && rightRound) {
                            item.classList.add("slotEnd");
                        } else if (!leftRound && !rightRound) {
                            item.classList.add("slotMiddle");
                        }
                    }

                    // Text label depends on position
                    const text = document.createElement("span");
                    if (isSingleDay) {
                        var startClock = slot.startTime.split("T")[1];
                        var endClock = slot.endTime.split("T")[1];
                        text.textContent = startClock + " to " + endClock;
                    } else if (isFirstDay) {
                        text.textContent = slot.startTime.split("T")[1];
                    } else if (isLastDay) {
                        text.textContent = slot.endTime.split("T")[1];
                    } else {
                        text.innerHTML = "&nbsp;";
                    }
                    item.appendChild(text);

                    // Delete button on end day for multi-day, or on single-day
                    if (isSingleDay || isLastDay) {
                        const del = document.createElement("button");
                        del.className = "deleteBtn";
                        del.textContent = "\u00d7";
                        del.onclick = function () {
                            deleteAppointment(j);
                        };
                        item.appendChild(del);
                    }

                    cell.appendChild(item);
                }
            }

        } else {
            // Cells outside the current month remain empty
            cell.className += " empty";
        }
        grid.appendChild(cell);
    }
}

// DELETE an appointment by its array index, then refresh
function deleteAppointment(index) {
    const xhr = new XMLHttpRequest();
    xhr.open("DELETE", "/appointments/" + index);
    xhr.onload = function () {
        if (xhr.status === 200) {
            showMessage("Appointment deleted", "ok");
            refreshCalendar();
        } else {
            showMessage("Delete failed: " + xhr.responseText, "error");
        }
    };
    xhr.send();
}

// Send POST with JSON body, then refresh the calendar on success
function sendCreateSlot(startTime, endTime) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/appointments");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () {
        if (xhr.status === 200) {
            showMessage("Slot created", "ok");
            refreshCalendar();
        } else {
            showMessage(xhr.responseText || "Create failed", "error");
        }
    };
    const body = JSON.stringify({
        startTime: startTime,
        endTime: endTime,
        status: "available"
    });
    xhr.send(body);
}

// Update the month title header
function setMonthTitle(month, year) {
    const names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    document.getElementById("monthTitle").textContent =
        names[month - 1] + " " + String(year);
}

// Button click creates a slot
document.getElementById("createSlotButton").addEventListener("click", function () {
    const startTime = document.getElementById("startTimeInput").value;
    const endTime = document.getElementById("endTimeInput").value;

    if (!startTime || !endTime) {
        showMessage("Please enter both start time and end time", "error");
        return;
    }

    sendCreateSlot(startTime, endTime);
});
