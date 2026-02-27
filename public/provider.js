// public/provider.js
// Provider calendar UI for PPA 5
// GET and POST only
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

// GET all slots then re-render the month view
function refreshCalendar() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/slots");
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
            // Bonus: highlight today's cell
            if (dayNumber === todayDate && currentMonth === todayMonth && currentYear === todayYear) {
                cell.classList.add("today");
            }

            // Day label at the top of the cell
            const label = document.createElement("div");
            label.className = "dayNumber";
            label.textContent = String(dayNumber);
            cell.appendChild(label);

            // Count and insert all slots that match this exact day, month, and year
            let slotCount = 0;
            for (let j = 0; j < rawSlots.length; j += 1) {
                const slot = rawSlots[j];
                // Split "2026-03-01T09:00" into date and time parts
                const datePart = slot.startTime.split("T")[0];
                const datePieces = datePart.split("-");
                const slotYear  = Number(datePieces[0]);
                const slotMonth = Number(datePieces[1]);
                const slotDay   = Number(datePieces[2]);

                // Only show slots that belong to the current month and year
                if (slotYear === currentYear && slotMonth === currentMonth && slotDay === dayNumber) {
                    slotCount += 1;
                    const item = document.createElement("div");
                    item.className = "slotItem";
                    // Add available or booked class for color coding
                    if (slot.status === "booked") {
                        item.classList.add("booked");
                    } else {
                        item.classList.add("available");
                    }
                    // Show only the clock portion (e.g. "09:00 to 09:30")
                    const startClock = slot.startTime.split("T")[1];
                    const endClock = slot.endTime.split("T")[1];
                    const text = document.createElement("span");
                    text.textContent = startClock + " to " + endClock;
                    item.appendChild(text);
                    cell.appendChild(item);
                }
            }

            // Bonus: show a slot count badge when there is at least one slot
            if (slotCount > 0) {
                const badge = document.createElement("div");
                badge.className = "slotCount";
                badge.textContent = slotCount + (slotCount === 1 ? " slot" : " slots");
                label.appendChild(badge);
            }
        } else {
            // Cells outside the current month remain empty
            cell.className += " empty";
        }
        grid.appendChild(cell);
    }
}

// Send POST then refresh the calendar on success
function sendCreateSlot(startTime, endTime) {
    const xhr = new XMLHttpRequest();
    const path =
        "/api/slots?startTime=" + encodeURIComponent(startTime) +
        "&endTime=" + encodeURIComponent(endTime);
    xhr.open("POST", path);
    xhr.onload = function () {
        if (xhr.status === 201) {
            showMessage("Slot created", "ok");
            refreshCalendar();
        } else {
            const data = JSON.parse(xhr.responseText || "{}");
            showMessage(data.error || "Create failed", "error");
        }
    };
    xhr.send();
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

    // Bonus: friendly message when inputs are missing
    if (!startTime || !endTime) {
        showMessage("Please enter both start time and end time", "error");
        return;
    }

    sendCreateSlot(startTime, endTime);
});
