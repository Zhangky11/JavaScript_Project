// Get references to DOM elements
const providerNameInput = document.getElementById("providerName");
const startTimeInput = document.getElementById("startTime");
const endTimeInput = document.getElementById("endTime");
const btnValidate = document.getElementById("btnValidate");
const btnCheckFilled = document.getElementById("btnCheckFilled");
const output = document.getElementById("output");
const slotTableBody = document.getElementById("slotTableBody");

// Helper function to safely parse JSON
function parseJsonSafely(text) {
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch (err) {
        return { ok: false, value: null };
    }
}

// Function to add a single row to the table
function addSlotRow(slot) {
    const tr = document.createElement("tr");
    const tdId = document.createElement("td");
    const tdName = document.createElement("td");
    const tdStart = document.createElement("td");
    const tdEnd = document.createElement("td");
    const tdStatus = document.createElement("td");

    tdId.textContent = slot.id;
    tdName.textContent = slot.providerName || "Unknown"; // Handle missing names for old slots
    tdStart.textContent = slot.startTime;
    tdEnd.textContent = slot.endTime;
    tdStatus.textContent = slot.status;

    tr.appendChild(tdId);
    tr.appendChild(tdName);
    tr.appendChild(tdStart);
    tr.appendChild(tdEnd);
    tr.appendChild(tdStatus);

    slotTableBody.appendChild(tr);
}

// Function to load all slots from server (GET)
function loadSlots() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/slots");
    xhr.onload = function() {
        if (xhr.status === 200) {
            const parsed = parseJsonSafely(xhr.responseText);
            if (parsed.ok) {
                // Clear existing rows
                slotTableBody.innerHTML = "";
                // Add rows for each slot
                const slots = parsed.value;
                for (let i = 0; i < slots.length; i++) {
                    addSlotRow(slots[i]);
                }
            }
        }
    };
    xhr.send();
}

// Function to submit a new slot to server (POST)
function submitNewSlot(providerName, startTime, endTime) {
    const xhr = new XMLHttpRequest();
    // Add providerName to the query string
    const requestUrl = "/api/slots?providerName=" + encodeURIComponent(providerName) +
                       "&startTime=" + encodeURIComponent(startTime) + 
                       "&endTime=" + encodeURIComponent(endTime);
    
    xhr.open("POST", requestUrl);
    xhr.onload = function() {
        const parsed = parseJsonSafely(xhr.responseText);
        
        if (xhr.status === 201) {
            if (parsed.ok) {
                // IMPORTANT: Reload ALL slots from server instead of just appending the new one
                // This ensures the UI reflects the server's state (where merges might have happened)
                loadSlots();
                
                output.innerText = "Success: Slot created and saved!";
                output.style.color = "#28a745";
                
                // Clear inputs
                providerNameInput.value = "";
                startTimeInput.value = "";
                endTimeInput.value = "";
                
                // Reset focus
                providerNameInput.focus();
            }
        } else if (xhr.status === 400 || xhr.status === 409) {
            // Use the error message from server if available
            const errorMsg = parsed.ok && parsed.value.error ? parsed.value.error : "Error creating slot";
            output.innerText = "Server Error: " + errorMsg;
            output.style.color = "#dc3545";
        } else {
            output.innerText = "Unexpected server error.";
            output.style.color = "#dc3545";
        }
    };
    xhr.send();
}

// Button 1: Validate & Create
// Demonstrates nested conditionals to ensure data integrity
btnValidate.onclick = function() {
    const name = providerNameInput.value;
    const start = startTimeInput.value;
    const end = endTimeInput.value;

    // Level 1: Check Provider Name
    if (name === "") {
        output.innerText = "Error: Provider Name is required.";
        output.style.color = "#dc3545"; // Red
    } else {
        // Level 2: Check Start Time
        if (start === "") {
            output.innerText = "Error: Start Time is required.";
            output.style.color = "#dc3545";
        } else {
            // Level 3: Check End Time
            if (end === "") {
                output.innerText = "Error: End Time is required.";
                output.style.color = "#dc3545";
            } else {
                // Level 4: Logical validation (End > Start)
                if (end <= start) {
                    output.innerText = "Error: End Time must be after Start Time.";
                    output.style.color = "#dc3545";
                } else {
                    // All client-side validation passed!
                    // Now send to server
                    output.innerText = "Sending to server...";
                    output.style.color = "#007bff"; // Blue
                    submitNewSlot(name, start, end);
                }
            }
        }
    }
};

// Button 2: Check Completeness
// Demonstrates logical OR operator
btnCheckFilled.onclick = function() {
    const name = providerNameInput.value;
    const start = startTimeInput.value;
    const end = endTimeInput.value;

    if (name === "" || start === "" || end === "") {
        output.innerText = "Error: All fields must be filled!";
        output.style.color = "#dc3545"; // Red
    } else {
        output.innerText = "Success: All fields have values.";
        output.style.color = "#28a745"; // Green
    }
};

// Load existing slots when page starts
loadSlots();
