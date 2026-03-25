"use strict";
/* PPA7: Full CRUD (GET, POST, PUT, PATCH, DELETE), validation, recurring + conflict rules (bonus). */

/*
 * PPA7 — function types in server.js (mostly [function declaration] + return values):
 *   loadAppointments, saveAppointments, getStatus, timesOverlap, validateAppointment,
 *   updateAppointmentFull, updateAppointmentPartial, deleteAppointment, sendJson, sendText, etc.
 * [anonymous function] + [callback]: http.createServer(function (request, response) { ... });
 *   and request.on("data", function (chunk) { ... }), request.on("end", function () { ... })
 */

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

const DATA_FILE = "appointments.json";
let appointments = [];

function loadAppointments() {
    try {
        const text = fs.readFileSync(DATA_FILE, "utf8");
        appointments = JSON.parse(text);
        if (!Array.isArray(appointments)) {
            appointments = [];
            saveAppointments();
        }
    } catch (error) {
        appointments = [];
        saveAppointments();
    }
}

function saveAppointments() {
    try {
        const text = JSON.stringify(appointments, null, 2);
        fs.writeFileSync(DATA_FILE, text, "utf8");
    } catch (error) {
        console.log("Failed to save appointments: " + error.message);
    }
}

function getStatus(appointment) {
    return appointment.status || "available";
}

// PPA7 §9: two "available" may overlap; booked/ooo otherwise cause conflicts when times overlap.
function timesOverlap(startMs, endMs, existStartMs, existEndMs) {
    return startMs < existEndMs && endMs > existStartMs;
}

function appointmentTimesOverlap(a, b) {
    const start = new Date(a.startTime).getTime();
    const end = new Date(a.endTime).getTime();
    const es = new Date(b.startTime).getTime();
    const ee = new Date(b.endTime).getTime();
    return timesOverlap(start, end, es, ee);
}

function appointmentsConflict(a, b) {
    if (!appointmentTimesOverlap(a, b)) return false;
    if (getStatus(a) === "available" && getStatus(b) === "available") return false;
    return true;
}

// Validate full appointment (title, start, end, improved overlap rules). excludeId = index to skip.
function validateAppointment(appointment, excludeId) {
    if (!appointment.title || typeof appointment.title !== "string" || appointment.title.trim() === "") {
        return { ok: false, message: "title is required" };
    }
    if (!appointment.startTime || !appointment.endTime) {
        return { ok: false, message: "startTime and endTime are required" };
    }
    const start = new Date(appointment.startTime);
    const end = new Date(appointment.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { ok: false, message: "Invalid date format" };
    }
    if (end <= start) {
        return { ok: false, message: "endTime must be after startTime" };
    }
    for (let i = 0; i < appointments.length; i++) {
        if (i === excludeId) continue;
        if (appointmentsConflict(appointment, appointments[i])) {
            const other = appointments[i];
            const t = other.title && other.title.trim() ? other.title : "Untitled";
            const st = getStatus(other);
            return {
                ok: false,
                message: "Time conflicts with \"" + t + "\" (" + st + ")",
                conflict: true
            };
        }
    }
    return { ok: true };
}

function toLocalDateTimeString(d) {
    const pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" +
        pad(d.getHours()) + ":" + pad(d.getMinutes());
}

// Build extra occurrences for recurring create (weekly / monthly). First slot is the base times in body.
function buildRecurringInstances(baseAppointment, recurring, count) {
    const recurringType = recurring || "none";
    const n = Math.min(Math.max(Number(count) || 1, 1), 12);
    const list = [];
    const start0 = new Date(baseAppointment.startTime);
    const end0 = new Date(baseAppointment.endTime);
    const durationMs = end0.getTime() - start0.getTime();
    if (recurringType === "none" || n === 1) {
        list.push({
            title: baseAppointment.title,
            startTime: baseAppointment.startTime,
            endTime: baseAppointment.endTime,
            status: baseAppointment.status,
            description: baseAppointment.description,
            attendees: baseAppointment.attendees != null ? String(baseAppointment.attendees) : ""
        });
        return list;
    }
    for (let i = 0; i < n; i += 1) {
        const s = new Date(start0.getTime());
        const e = new Date(start0.getTime() + durationMs);
        if (recurringType === "weekly") {
            s.setDate(s.getDate() + i * 7);
            e.setTime(s.getTime() + durationMs);
        } else if (recurringType === "monthly") {
            s.setMonth(s.getMonth() + i);
            e.setTime(s.getTime() + durationMs);
        } else {
            if (i === 0) {
                list.push({
                    title: baseAppointment.title,
                    startTime: baseAppointment.startTime,
                    endTime: baseAppointment.endTime,
                    status: baseAppointment.status,
                    description: baseAppointment.description,
                    attendees: baseAppointment.attendees != null ? String(baseAppointment.attendees) : ""
                });
            }
            break;
        }
        list.push({
            title: baseAppointment.title,
            startTime: toLocalDateTimeString(s),
            endTime: toLocalDateTimeString(e),
            status: baseAppointment.status,
            description: baseAppointment.description,
            attendees: baseAppointment.attendees != null ? String(baseAppointment.attendees) : ""
        });
    }
    return list;
}

function validateNewAppointmentsBatch(list) {
    let k = 0;
    for (k = 0; k < list.length; k += 1) {
        const one = list[k];
        if (!one.title || String(one.title).trim() === "") {
            return { ok: false, message: "title is required" };
        }
        const start = new Date(one.startTime);
        const end = new Date(one.endTime);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { ok: false, message: "Invalid date format" };
        }
        if (end <= start) {
            return { ok: false, message: "endTime must be after startTime" };
        }
    }
    for (k = 0; k < list.length; k += 1) {
        const r = validateAppointment(list[k], -1);
        if (!r.ok) return r;
    }
    let i = 0;
    let j = 0;
    for (i = 0; i < list.length; i += 1) {
        for (j = i + 1; j < list.length; j += 1) {
            if (appointmentsConflict(list[i], list[j])) {
                return { ok: false, message: "Recurring times overlap each other", conflict: true };
            }
        }
    }
    return { ok: true };
}

// --- PPA7 server skeleton (id = array index in URL) ---
// PUT: replace entire appointment - [function declaration]
function updateAppointmentFull(id, updatedAppointment) {
    const idx = Number(id);
    if (Number.isNaN(idx) || idx < 0 || idx >= appointments.length) {
        return { ok: false, message: "Invalid appointment index" };
    }
    const result = validateAppointment(updatedAppointment, idx);
    if (!result.ok) return result;
    appointments[idx] = {
        title: String(updatedAppointment.title).trim(),
        startTime: updatedAppointment.startTime,
        endTime: updatedAppointment.endTime,
        status: updatedAppointment.status || "available",
        description: updatedAppointment.description != null ? String(updatedAppointment.description) : "",
        attendees: updatedAppointment.attendees != null ? String(updatedAppointment.attendees) : ""
    };
    saveAppointments();
    return { ok: true };
}

// PATCH: merge only provided fields, then validate - [function declaration]
function updateAppointmentPartial(id, changes) {
    const idx = Number(id);
    if (Number.isNaN(idx) || idx < 0 || idx >= appointments.length) {
        return { ok: false, message: "Invalid appointment index" };
    }
    
    const existing = appointments[idx];

    const merged = {
        title: existing.title,
        startTime: existing.startTime,
        endTime: existing.endTime,
        status: existing.status,
        description: existing.description,
        attendees: existing.attendees != null ? existing.attendees : ""
    };

    if (changes.title !== undefined) merged.title = changes.title;
    if (changes.startTime !== undefined) merged.startTime = changes.startTime;
    if (changes.endTime !== undefined) merged.endTime = changes.endTime;
    if (changes.status !== undefined) merged.status = changes.status;
    if (changes.description !== undefined) merged.description = changes.description;
    if (changes.attendees !== undefined) merged.attendees = changes.attendees;

    if (!merged.title || String(merged.title).trim() === "") merged.title = "Untitled";

    const result = validateAppointment(merged, idx);
    if (!result.ok) return result;
    appointments[idx] = merged;
    saveAppointments();
    return { ok: true };
}

// DELETE: remove appointment by id (index) - [function declaration]
function deleteAppointment(id) {
    const idx = Number(id);
    if (Number.isNaN(idx) || idx < 0 || idx >= appointments.length) {
        return { ok: false, message: "Invalid appointment index" };
    }
    appointments.splice(idx, 1);
    saveAppointments();
    return { ok: true };
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(data));
}

function sendText(response, statusCode, message) {
    response.writeHead(statusCode, { "Content-Type": "text/plain" });
    response.end(message);
}

loadAppointments();

// [anonymous function] — passed to createServer; Node calls it for each HTTP request
const server = http.createServer(function (request, response) {
    const parsedUrl = url.parse(request.url, true);

    // GET /appointments — return the full appointments array
    if (request.method === "GET" && parsedUrl.pathname === "/appointments") {
        sendJson(response, 200, appointments);
    }

    // POST /appointments — add a new appointment, then save to file
    else if (request.method === "POST" && parsedUrl.pathname === "/appointments") {
        let body = "";

        request.on("data", function (chunk) {
            body += chunk;
        });

        request.on("end", function () {
            try {
                const newAppointment = JSON.parse(body);
                newAppointment.title = newAppointment.title != null ? String(newAppointment.title).trim() : "";
                newAppointment.status = newAppointment.status || "available";
                newAppointment.description = newAppointment.description != null ? String(newAppointment.description) : "";
                newAppointment.attendees = newAppointment.attendees != null ? String(newAppointment.attendees) : "";
                const recurring = newAppointment.recurring;
                const recurringCount = newAppointment.recurringCount;
                const template = {
                    title: newAppointment.title,
                    startTime: newAppointment.startTime,
                    endTime: newAppointment.endTime,
                    status: newAppointment.status,
                    description: newAppointment.description,
                    attendees: newAppointment.attendees
                };
                const list = buildRecurringInstances(template, recurring, recurringCount);
                const batchResult = validateNewAppointmentsBatch(list);
                if (!batchResult.ok) {
                    const code = batchResult.conflict ? 409 : 400;
                    sendText(response, code, batchResult.message);
                    return;
                }
                let i = 0;
                for (i = 0; i < list.length; i += 1) {
                    appointments.push(list[i]);
                }
                saveAppointments();
                sendText(response, 200, list.length > 1
                    ? "Created " + String(list.length) + " appointments"
                    : "Appointment created successfully");
            } catch (err) {
                sendText(response, 400, "Invalid JSON body");
            }
        });
    }

    // PUT /appointments/:id — replace entire appointment
    else if (request.method === "PUT" && parsedUrl.pathname.startsWith("/appointments/")) {
        const parts = parsedUrl.pathname.split("/");
        const id = parts[2];
        let body = "";
        request.on("data", function (chunk) { body += chunk; });
        request.on("end", function () {
            try {
                const updated = JSON.parse(body);
                const result = updateAppointmentFull(id, updated);
                if (result.ok) {
                    sendJson(response, 200, { ok: true });
                } else {
                    sendText(response, result.conflict ? 409 : 400, result.message);
                }
            } catch (err) {
                sendText(response, 400, "Invalid JSON body");
            }
        });
    }

    // PATCH /appointments/:id — update only provided fields
    else if (request.method === "PATCH" && parsedUrl.pathname.startsWith("/appointments/")) {
        const parts = parsedUrl.pathname.split("/");
        const id = parts[2];
        let body = "";
        request.on("data", function (chunk) { body += chunk; });
        request.on("end", function () {
            try {
                const changes = JSON.parse(body);
                const result = updateAppointmentPartial(id, changes);
                if (result.ok) {
                    sendJson(response, 200, { ok: true });
                } else {
                    sendText(response, result.conflict ? 409 : 400, result.message);
                }
            } catch (err) {
                sendText(response, 400, "Invalid JSON body");
            }
        });
    }

    // DELETE /appointments/:id — remove one appointment by index
    else if (request.method === "DELETE" && parsedUrl.pathname.startsWith("/appointments/")) {
        const parts = parsedUrl.pathname.split("/");
        const id = parts[2];
        const result = deleteAppointment(id);
        if (result.ok) {
            sendText(response, 200, "Appointment deleted successfully");
        } else {
            sendText(response, 400, result.message);
        }
    }

    // Serve static files from public directory
    else if (request.method === "GET") {
        const pathname = parsedUrl.pathname;
        let filePath = "";

        if (pathname === "/") {
            filePath = "./public/index.html";
        } else {
            const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
            filePath = "./public" + safePath;
        }

        const extname = path.extname(filePath);
        let contentType = "text/html";
        switch (extname) {
            case ".js":
                contentType = "text/javascript";
                break;
            case ".css":
                contentType = "text/css";
                break;
            case ".json":
                contentType = "application/json";
                break;
            case ".png":
                contentType = "image/png";
                break;
            case ".jpg":
                contentType = "image/jpg";
                break;
        }

        fs.readFile(filePath, function (err, data) {
            if (err) {
                if (err.code === "ENOENT") {
                    sendText(response, 404, "Not found");
                } else {
                    sendText(response, 500, "Internal server error");
                }
                return;
            }
            response.writeHead(200, { "Content-Type": contentType });
            response.end(data);
        });
    }

    else {
        sendText(response, 404, "Not found");
    }
});

server.listen(3000);
console.log("Server running at http://localhost:3000");
