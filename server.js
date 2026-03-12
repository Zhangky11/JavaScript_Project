"use strict";

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

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(data));
}

function sendText(response, statusCode, message) {
    response.writeHead(statusCode, { "Content-Type": "text/plain" });
    response.end(message);
}

loadAppointments();

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

                if (!newAppointment.startTime || !newAppointment.endTime) {
                    sendText(response, 400, "startTime and endTime are required");
                    return;
                }

                const start = new Date(newAppointment.startTime);
                const end = new Date(newAppointment.endTime);

                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    sendText(response, 400, "Invalid date format");
                    return;
                }

                if (end <= start) {
                    sendText(response, 400, "endTime must be after startTime");
                    return;
                }

                for (let i = 0; i < appointments.length; i++) {
                    const existStart = new Date(appointments[i].startTime);
                    const existEnd = new Date(appointments[i].endTime);
                    if (start < existEnd && end > existStart) {
                        sendText(response, 409, "Time slot overlaps with an existing appointment");
                        return;
                    }
                }

                appointments.push(newAppointment);
                saveAppointments();
                sendText(response, 200, "Appointment created successfully");
            } catch (err) {
                sendText(response, 400, "Invalid JSON body");
            }
        });
    }

    // DELETE /appointments/:index — remove one appointment by index, then save
    else if (request.method === "DELETE" && parsedUrl.pathname.startsWith("/appointments/")) {
        const parts = parsedUrl.pathname.split("/");
        const index = Number(parts[2]);

        if (!Number.isNaN(index) && index >= 0 && index < appointments.length) {
            appointments.splice(index, 1);
            saveAppointments();
            sendText(response, 200, "Appointment deleted successfully");
        } else {
            sendText(response, 400, "Invalid appointment index");
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
