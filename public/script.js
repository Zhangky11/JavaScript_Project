// public/script.js
// PPA7: month nav, modal edit, datetime-local, function types + client skeleton (openAppointmentModal, saveAppointmentChanges, deleteButtonHandler).
// Bonus: status colors, conflict messages, search/filter, recurring (server).


const today = new Date();
const todayDate = today.getDate();
const todayMonth = today.getMonth() + 1;
const todayYear = today.getFullYear();
let currentMonth = todayMonth; // current month
let currentYear = todayYear;

// Run once when the page loads
refreshCalendar();

// [function declaration] + [parameters: text, kind]
function showMessage(text, kind) {
    const el = document.getElementById("message");
    el.textContent = text;
    el.className = kind;
}

// [function declaration]
// GET /appointments (server reads appointments.json into memory, returns JSON) then draw the month
function refreshCalendar() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/appointments");
    // [anonymous function]
    xhr.onload = function () {
        if (xhr.status === 200) {
            const rows = JSON.parse(xhr.responseText);
            renderCalendar(rows);
        } else {
            showMessage("GET failed " + String(xhr.status), "error");
        }
    };
    xhr.send();
}

// [function declaration] + [parameter rawSlots] + [return value: array out]
function buildFilteredSlots(rawSlots) {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const statusFilter = document.getElementById("statusFilterInput").value;
    const out = [];
    let j = 0;
    for (j = 0; j < rawSlots.length; j += 1) {
        const slot = rawSlots[j];
        const st = slot.status || "available";
        if (statusFilter !== "all" && st !== statusFilter) continue;
        if (q) {
            const title = (slot.title || "").toLowerCase();
            const desc = (slot.description || "").toLowerCase();
            const att = (slot.attendees || "").toLowerCase();
            if (title.indexOf(q) === -1 && desc.indexOf(q) === -1 && att.indexOf(q) === -1) continue;
        }
        out.push({ slot: slot, index: j });
    }
    return out;
}

// [function declaration] + [return value: CSS class name string]
function slotStatusClass(slot) {
    const st = slot.status || "available";
    if (st === "booked") return "booked";
    if (st === "ooo") return "ooo";
    return "available";
}

function shortTitleForSlot(slot) {
    const t = slot.title && slot.title.trim() ? slot.title.trim() : "Untitled";
    return t.length > 14 ? t.slice(0, 12) + "…" : t;
}

// [function declaration] — large UI builder (no return value)
function renderCalendar(rawSlots) {
    setMonthTitle(currentMonth, currentYear);
    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";

    const filtered = buildFilteredSlots(rawSlots);

    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const startWeekday = firstDay.getDay(); // 0 Sunday to 6 Saturday
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();


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

            let fi = 0;
            for (fi = 0; fi < filtered.length; fi += 1) {
                const j = filtered[fi].index;
                const slot = filtered[fi].slot;

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
                    item.className = "slotItem " + slotStatusClass(slot);

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
                        text.textContent = shortTitleForSlot(slot) + " · " + startClock + "–" + endClock;
                    } else if (isFirstDay) {
                        text.textContent = shortTitleForSlot(slot) + " · " + slot.startTime.split("T")[1];
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
                        // [anonymous function] + [callback]
                        del.onclick = function (e) {
                            e.stopPropagation();
                            deleteAppointmentAtIndex(j);
                        };
                        item.appendChild(del);
                    }

                    // Click slot to open edit modal (except when clicking delete)
                    // Outer: IIFE (runs once). Inner: [anonymous function] + [callback] for click
                    (function (idx, appt) {
                        item.addEventListener("click", function (e) {
                            if (e.target.classList.contains("deleteBtn")) return;
                            openAppointmentModal(appt, idx);
                        });
                    })(j, slot);

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

// DELETE over HTTP (array index in URL). Name avoids clashing with server deleteAppointment().
function deleteAppointmentAtIndex(index) {
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
function sendCreateSlot(title, startTime, endTime, description, attendees, status, recurring, recurringCount) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/appointments");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () {
        if (xhr.status === 200) {
            showMessage(xhr.responseText || "Slot created", "ok");
            refreshCalendar();
        } else {
            showMessage(xhr.responseText || "Create failed", "error");
        }
    };
    const body = JSON.stringify({
        title: title || "Untitled",
        startTime: startTime,
        endTime: endTime,
        status: status || "available",
        description: description || "",
        attendees: attendees || "",
        recurring: recurring || "none",
        recurringCount: recurringCount
    });
    xhr.send(body);
}

// [function declaration] + [parameters: month, year] — no return (side effect: updates DOM)
function setMonthTitle(month, year) {
    const names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    document.getElementById("monthTitle").textContent =
        names[month - 1] + " " + String(year);
}

// --- Modal: view and edit appointment ---
let editingIndex = -1;

// [function declaration]
function openAppointmentModal(appointment, id) {
    editingIndex = id;
    document.getElementById("modalTitleInput").value = appointment.title || "Untitled";
    document.getElementById("modalStartTime").value = (appointment.startTime || "").slice(0, 16);
    document.getElementById("modalEndTime").value = (appointment.endTime || "").slice(0, 16);
    document.getElementById("modalStatus").value = appointment.status || "available";
    document.getElementById("modalDescription").value = appointment.description || "";
    document.getElementById("modalAttendeesInput").value = appointment.attendees || "";
    document.getElementById("appointmentModal").classList.add("isOpen");
}

function closeAppointmentModal() {
    document.getElementById("appointmentModal").classList.remove("isOpen");
    editingIndex = -1;
}

// [function declaration] (PPA7: read form, PUT full object to server)
function saveAppointmentChanges() {
    if (editingIndex < 0) return;
    const title = document.getElementById("modalTitleInput").value.trim();
    const startTime = document.getElementById("modalStartTime").value;
    const endTime = document.getElementById("modalEndTime").value;
    const status = document.getElementById("modalStatus").value;
    const description = document.getElementById("modalDescription").value;
    const attendees = document.getElementById("modalAttendeesInput").value;
    if (!title) {
        showMessage("Please enter a title", "error");
        return;
    }
    if (!startTime || !endTime) {
        showMessage("Please enter start and end time", "error");
        return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/appointments/" + editingIndex);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () {
        if (xhr.status === 200) {
            showMessage("Appointment updated", "ok");
            closeAppointmentModal();
            refreshCalendar();
        } else {
            showMessage(xhr.responseText || "Update failed", "error");
        }
    };
    xhr.send(JSON.stringify({
        title: title,
        startTime: startTime,
        endTime: endTime,
        status: status,
        description: description || "",
        attendees: attendees || ""
    }));
}

// [arrow function] (PPA7 skeleton) — DELETE then refresh; also a [callback] when wired to the button
const deleteButtonHandler = () => {
    if (editingIndex < 0) return;
    const xhr = new XMLHttpRequest();
    xhr.open("DELETE", "/appointments/" + editingIndex);
    xhr.onload = function () {
        if (xhr.status === 200) {
            showMessage("Appointment deleted", "ok");
            closeAppointmentModal();
            refreshCalendar();
        } else {
            showMessage(xhr.responseText || "Delete failed", "error");
        }
    };
    xhr.send();
};

// [callback] closeAppointmentModal is a [function declaration] passed by name (not anonymous)
document.getElementById("modalClose").addEventListener("click", closeAppointmentModal);
document.getElementById("modalBackdrop").addEventListener("click", closeAppointmentModal);
document.getElementById("modalCancel").addEventListener("click", closeAppointmentModal);
document.getElementById("modalSave").addEventListener("click", saveAppointmentChanges);
document.getElementById("modalDelete").addEventListener("click", deleteButtonHandler);

// [anonymous function] + [callback] — create slot button
document.getElementById("createSlotButton").addEventListener("click", function () {
    const title = document.getElementById("titleInput").value;
    const startTime = document.getElementById("startTimeInput").value;
    const endTime = document.getElementById("endTimeInput").value;
    const description = document.getElementById("descriptionInput").value;
    const attendees = document.getElementById("attendeesInput").value;
    const status = document.getElementById("createStatusInput").value;
    const recurring = document.getElementById("recurringInput").value;
    const recurringCount = document.getElementById("recurringCountInput").value;

    if (!title || !title.trim()) {
        showMessage("Please enter a title", "error");
        return;
    }
    if (!startTime || !endTime) {
        showMessage("Please enter both start time and end time", "error");
        return;
    }

    sendCreateSlot(title.trim(), startTime, endTime, description, attendees, status, recurring, recurringCount);
});

// [anonymous function] + [callback]
document.getElementById("searchInput").addEventListener("input", function () {
    refreshCalendar();
});

document.getElementById("statusFilterInput").addEventListener("change", function () {
    refreshCalendar();
});


// [function declaration]
function goToPreviousMonth() {
    currentMonth -= 1;
    if (currentMonth === 0) {
        currentMonth = 12;
        currentYear -= 1;
    }
    refreshCalendar();
}

// [arrow function]
const goToNextMonth = () => {
    currentMonth += 1;
    if (currentMonth === 13) {
        currentMonth = 1;
        currentYear += 1;
    }
    refreshCalendar();
}


// [anonymous function] + [callback] — calls a [function declaration]
document.getElementById("prevMonthBtn").addEventListener("click", function () {
    goToPreviousMonth();
});

// [anonymous function] + [callback] — calls an [arrow function]
document.getElementById("nextMonthBtn").addEventListener("click", function () {
    goToNextMonth();
});