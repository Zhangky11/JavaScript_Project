const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

// In memory data model (persistence added in PPA 4)
const slots = [];
let lastId = 0;

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
}

function nextId() {
    lastId += 1;
    return lastId;
}

// Helper to format Date to "YYYY-MM-DDTHH:MM"
function toLocalIsoString(date) {
    const offset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
}

function validateSlotTimes(startTime, endTime) {
    if (typeof startTime !== "string" || startTime.trim().length === 0) {
        return { ok: false, message: "startTime is required" };
    }

    if (typeof endTime !== "string" || endTime.trim().length === 0) {
        return { ok: false, message: "endTime is required" };
    }

    // Verify endTime is after startTime
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { ok: false, message: "Time format is invalid" };
    }

    if (end <= start) {
        return { ok: false, message: "endTime must be after startTime" };
    }

    return { ok: true, message: "" };
}

function isDuplicate(startTime, endTime) {
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    for (let i = 0; i < slots.length; i++) {
        const existingStart = new Date(slots[i].startTime);
        const existingEnd = new Date(slots[i].endTime);

        // Overlap logic:
        // Two time ranges (StartA, EndA) and (StartB, EndB) overlap if:
        // StartA < EndB AND EndA > StartB
        if (newStart < existingEnd && newEnd > existingStart) {
            return true;
        }
    }
    return false;
}

const server = http.createServer(function (req, res) {
    console.log(`[DEBUG] Incoming request: ${req.method} ${req.url}`);

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    if (req.method === "GET" && pathname === "/api/slots") {
        sendJson(res, 200, slots);
        return;
    }

    if (req.method === "POST" && pathname === "/api/slots") {
        // providerName is optional for PPA 5 provider calendar (uses default)
        const providerName = query.providerNProviderame || "";
        const startTime = query.startTime;
        const endTime = query.endTime;

        console.log(`[DEBUG] Received POST /api/slots`);
        console.log(`[DEBUG] provider:  '${providerName}'`);
        console.log(`[DEBUG] startTime: '${startTime}'`);
        console.log(`[DEBUG] endTime:   '${endTime}'`);

        const result = validateSlotTimes(startTime, endTime);

        if (!result.ok) {
            sendJson(res, 400, { error: result.message });
            return;
        }

        // --- Overlap & Merge Logic ---
        const newStartObj = new Date(startTime);
        const newEndObj = new Date(endTime);
        
        let mergedStart = newStartObj;
        let mergedEnd = newEndObj;
        const indicesToRemove = [];

        // 1. Check for overlaps
        for (let i = 0; i < slots.length; i++) {
            const existingStart = new Date(slots[i].startTime);
            const existingEnd = new Date(slots[i].endTime);

            // Check if overlap exists: (StartA < EndB) and (EndA > StartB)
            if (newStartObj < existingEnd && newEndObj > existingStart) {
                
                // If overlap found, check names
                if (slots[i].providerName !== providerName) {
                    // Different person -> Conflict Error
                    sendJson(res, 409, { error: "Time slot occupied by another provider" });
                    return;
                } else {
                    // Same person -> Prepare to merge
                    indicesToRemove.push(i);

                    // Expand the merged range to include the existing slot
                    if (existingStart < mergedStart) mergedStart = existingStart;
                    if (existingEnd > mergedEnd) mergedEnd = existingEnd;
                }
            }
        }

        // 2. Remove old merged slots (iterate backwards to avoid index shifting)
        for (let i = indicesToRemove.length - 1; i >= 0; i--) {
            slots.splice(indicesToRemove[i], 1);
        }

        // 3. Create new merged slot
        // Convert Date objects back to ISO strings for storage (simple format)
        // Note: toISOString() returns UTC. If you want to keep the exact input string format
        // it's harder with merging. Here we'll use a simple approach:
        // If no merge happened, use original strings. If merge happened, use ISO string or construct it.
        // For simplicity in this assignment, let's use the Date object's string representation or just ISO.
        // Actually, to keep it consistent with input "YYYY-MM-DDTHH:MM", let's format it simply:
        
        // Helper to format date back to "YYYY-MM-DDTHH:MM" local time roughly
        // Or just use the ISO string slice for simplicity
        const finalStartTime = indicesToRemove.length > 0 ? toLocalIsoString(mergedStart) : startTime;
        const finalEndTime = indicesToRemove.length > 0 ? toLocalIsoString(mergedEnd) : endTime;

        const slot = {
            id: nextId(),
            providerName: providerName,
            startTime: finalStartTime,
            endTime: finalEndTime,
            status: "available"
        };

        slots.push(slot);

        sendJson(res, 201, slot);
        return;
    }

    // Serve static files from public directory
    if (req.method === "GET") {
        let filePath = "";
        
        if (pathname === "/") {
            filePath = "./public/index.html";
        } else {
            // Prevent directory traversal attacks
            const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
            filePath = "./public" + safePath;
        }

        // Map file extensions to content types
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
                    sendJson(res, 404, { error: "Not found" });
                } else {
                    sendJson(res, 500, { error: "Internal server error" });
                }
                return;
            }

            res.writeHead(200, { "Content-Type": contentType });
            res.end(data);
        });
        return;
    }

    sendJson(res, 404, { error: "Not found" });
});

server.listen(3000, function () {
    console.log("Server running at http://localhost:3000");
});
