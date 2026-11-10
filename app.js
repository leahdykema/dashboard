// Import Firebase SDKs directly from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    collectionGroup,
    addDoc,
    doc,
    setDoc,
    updateDoc,
    arrayUnion,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const firebaseConfig = {
    apiKey: window.FIREBASE_API_KEY || "AIzaSyCWQ6_na40q8O-D1APRjEiWUMw6_tLqvjI",
    authDomain: "dashboard-868f7.firebaseapp.com",
    projectId: "dashboard-868f7",
    storageBucket: "dashboard-868f7.firebasestorage.app",
    messagingSenderId: "162599019312",
    appId: "1:162599019312:web:a77c23eb85390993135ef5",
    measurementId: "G-QPM1NJ1693"
};
// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// DOM Elements
const loginView = document.getElementById("login-view");
const timerView = document.getElementById("timer-view");
const logsView = document.getElementById("logs-view");
const dashboardView = document.getElementById("dashboard-view");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authError = document.getElementById("auth-error");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const logsBtn = document.getElementById("logs-btn");
const backBtn = document.getElementById("back-btn");
const clientInput = document.getElementById("client");
const taskInput = document.getElementById("task");
const logsList = document.getElementById("logs-list");
const clientSelect = document.getElementById("client-select");
const taskSelect = document.getElementById("task-select");
const logsDisplayContainer = document.getElementById("logs-display-container");
const exportPdfSetupBtn = document.getElementById("export-btn");
const pdfConfigPanel = document.getElementById("config-pdf");
const generatePdfBtn = document.getElementById("generate-pdf-btn");
const cancelPdfBtn = document.getElementById("cancel-export-btn");
const pdfStartDateInput = document.getElementById("start-date");
const pdfEndDateInput = document.getElementById("end-date");
const pdfRateTypeSelect = document.getElementById("rate");
const pdfRateAmountInput = document.getElementById("amount");

let startTime = null;
let cachedClientsData = {};

stopBtn.style.opacity = "0.5";

// Listen for login/logout state changes automatically
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Logged in: Hide login form, show dashboard
        if (loginView) loginView.style.display = "none";
        if (dashboardView) dashboardView.style.display = "block";
        if (dashboardView) stopBtn.classList.add("hidden");
        if (authError) authError.textContent = "";
    } else {
        // Logged out: Show login form, hide dashboard
        if (loginView) loginView.style.display = "block";
        if (dashboardView) dashboardView.style.display = "none";
    }
});

// Handle login submission
if (loginView) {
    loginView.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (authError) authError.textContent = "";
        try {
            await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        } catch (error) {
            if (authError) {
                authError.textContent = "Invalid email or password.";
            }
            console.error("Login failed:", error.message);
        }
    });
}

// Handle sign out
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).catch((error) => console.error("Sign out error:", error));
    });
}

// Start Timer
startBtn.addEventListener("click", () => {
    startTime = new Date();
    startBtn.disabled = true;
    startBtn.style.opacity = "0.5";
    stopBtn.style.opacity = "1";
    alert("Timer started!");
    stopBtn.classList.remove("hidden");
});

// Stop Timer & Save to Firestore
stopBtn.addEventListener("click", async () => {
    stopBtn.classList.add("hidden");
    if (!startTime) {
        alert("You need to start the timer first!");
        return;
    }
    const user = auth.currentUser;
    if (!user) {
        alert("You must be signed in to save a log");
        return;
    }
    const endTime = new Date();
    const durationMinutes = Math.round((endTime - startTime) / 60000);
    const client = clientInput.value.trim() || "Client";
    const task = taskInput.value.trim() || "Consulting Work";
    const logId = startTime.toISOString().replace(/[:.]/g, "-");
    try {
        await setDoc(doc(db, "users", user.uid, "clients", client), {}, { merge: true });
        const taskRef = doc(db, "users", user.uid, "clients", client, "task", task);
        await setDoc(taskRef, {
            clientName: client,
            taskName: task,
            lastUpdated: serverTimestamp(),
            entries: arrayUnion({
                id: logId,
                startTime: startTime,
                endTime: endTime,
                durationMinutes: durationMinutes
            })
        }, { merge: true });
        // Reset UI
        startTime = null;
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        stopBtn.style.opacity = "0.5";
        clientInput.value = "";
        taskInput.value = "";
        alert(`Saved! Logged ${durationMinutes} minutes for ${client} (${task}).`);
        stopBtn.classList.add("hidden");
    } catch (error) {
        console.error("Error saving log:", error);
        alert("Failed to save log to database: " + error.message);
    }
});

// Switch between Dashboard and Logs View
logsBtn.addEventListener("click", async () => {
    timerView.classList.add("hidden");
    logsView.classList.remove("hidden");
    await fetchAndPopulateClients();
});

backBtn.addEventListener("click", () => {
    logsView.classList.add("hidden");
    timerView.classList.remove("hidden");
});


if (exportPdfSetupBtn) {
    exportPdfSetupBtn.addEventListener("click", () => {
        if (pdfConfigPanel) pdfConfigPanel.classList.remove("hidden");
        exportPdfSetupBtn.classList.add("hidden");
        backBtn.classList.add("hidden");
    });
}

if (cancelPdfBtn) {
    cancelPdfBtn.addEventListener("click", () => {
        if (pdfConfigPanel) pdfConfigPanel.classList.add("hidden");
        exportPdfSetupBtn.classList.remove("hidden");
        backBtn.classList.remove("hidden");
    });
}

// Generate PDF Report
if (generatePdfBtn) {
    generatePdfBtn.addEventListener("click", () => {
        const selectedClient = clientSelect.value;
        const selectedTask = taskSelect.value;
        if (!selectedClient || !selectedTask) {
            alert("Please select a client and task first.");
            return;
        }
        const startDate = pdfStartDateInput?.value || "N/A";
        const endDate = pdfEndDateInput?.value || "N/A";
        const rateType = pdfRateTypeSelect?.value || "hourly";
        const rateAmount = parseFloat(pdfRateAmountInput?.value) || 0;
        const taskData = cachedClientsData[selectedClient]?.[selectedTask];
        const entries = taskData?.entries || [];
        if (entries.length === 0) {
            alert("No entries to export.");
            return;
        }
        if (typeof html2pdf === "undefined") {
            alert("PDF library is still loading. Please wait a moment and try again.");
            return;
        }
        // Calculate total minutes and total cost safely
        let totalMinutes = 0;
        entries.forEach(entry => {
            totalMinutes += Number(entry.durationMinutes) || 0;
        });
        const totalHours = totalMinutes / 60;
        let grandTotal = 0;
        let pricingSummaryText = "";
        if (rateType === "hourly") {
            grandTotal = totalHours * rateAmount;
            pricingSummaryText = `Hourly Rate: $${rateAmount.toFixed(2)}/hr | Total Time: ${totalHours.toFixed(2)} hrs`;
        } else {
            grandTotal = rateAmount;
            pricingSummaryText = `Fixed Rate $${grandTotal.toFixed(2)}`;
        }
        // Build HTML layout for the PDF (Excluding Log IDs)
        const printableDiv = document.createElement("div");
        printableDiv.style.padding = "20px";
        printableDiv.style.fontFamily = "Arial, sans-serif";
        printableDiv.style.color = "#111";
        printableDiv.style.background = "#ffffff";
        printableDiv.style.width = "700px";
        let pdfHtml = `
            <h1 style="margin-bottom: 5px; background-color: #fff; color: #111;">${selectedClient}</h1>
            <h3 style="margin-top: 0; background-color: #fff; color: #111;">Task: ${selectedTask}</h3>
            <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0;">
            <p style="background-color: #fff; color: #111;"><strong style="background-color: #fff; color: #111;">Project Start Date:</strong> ${startDate}</p>
            <p style="background-color: #fff; color: #111;"><strong style="background-color: #fff; color: #111;">Project End Date:</strong> ${endDate}</p>
            <p style="background-color: #fff; color: #111;"><strong style="background-color: #fff; color: #111;">${pricingSummaryText}</strong></p>
            <br>
            <table cellpadding="8" cellspacing="0" style="background-color: #fff; color: #111; width: 100%; border: 1; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background-color: #eee; color: #111;">
                        <th style="background-color: #fff; color: #111;">Start Time</th>
                        <th style="background-color: #fff; color: #111;">End Time</th>
                        <th style="background-color: #fff; color: #111;">Duration</th>
                    </tr>
                </thead>
                <tbody style="background-color: #fff; color: #111;">
        `;
        entries.forEach((entry) => {
            const start = entry.startTime?.seconds ? new Date(entry.startTime.seconds * 1000) : new Date(entry.startTime);
            const end = entry.endTime?.seconds ? new Date(entry.endTime.seconds * 1000) : new Date(entry.endTime);
            pdfHtml += `
                    <tr style="background-color: #fff; color: #111;">
                        <td style="background-color: #fff; color: #111;">${isNaN(start.getTime()) ? "N/A" : start.toLocaleString()}</td>
                        <td style="background-color: #fff; color: #111;">${isNaN(end.getTime()) ? "N/A" : end.toLocaleString()}</td>
                        <td style="background-color: #fff; color: #111;">${entry.durationMinutes} mins</td>
                    </tr>
            `;
        });
        pdfHtml += `
                </tbody>
            </table>
            <br>
            <div style="background-color: #fff; color: #111; text-align: right; font-size: 16px; margin-top: 20px;">
                <strong style="background-color: #fff; color: #111;">Total: $${grandTotal.toFixed(2)}</strong>
            </div>
        `;
        printableDiv.innerHTML = pdfHtml;
        // Temporarily attach to document body so html2canvas can measure/render it properly
        document.body.appendChild(printableDiv);
        // Trigger PDF generation and download
        const opt = {
            margin: 0.5,
            filename: `${selectedClient}_${selectedTask}_Report.pdf`.replace(/\s+/g, "_"),
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().from(printableDiv).set(opt).save().then(() => {
            // Clean up the temporary element
            document.body.removeChild(printableDiv);
            if (pdfConfigPanel) pdfConfigPanel.classList.add("hidden");
        }).catch((err) => {
            document.body.removeChild(printableDiv);
            alert("Error generating PDF: " + err);
        });
    });
}

// Fetch all clients and tasks from Firestore
async function fetchAndPopulateClients() {
    clientSelect.innerHTML = '<option value="">-- Choose a Client --</option>';
    taskSelect.innerHTML = '<option value="">-- Choose a Task --</option>';
    taskSelect.disabled = true;
    logsDisplayContainer.innerHTML = '<p style="color: blue;">Loading clients from database...</p>';
    cachedClientsData = {};
    const user = auth.currentUser;
    if (!user) {
        logsDisplayContainer.innerHTML = '<p style="color: red;">Not logged in.</p>';
        return;
    }
    try {
        // Directly query the user's clients subcollection
        const clientsRef = collection(db, "users", user.uid, "clients");
        const clientsSnapshot = await getDocs(clientsRef);
        if (clientsSnapshot.empty) {
            logsDisplayContainer.innerHTML = '<p style="color: red;">0 task logs found for your account.</p>';
            return;
        }
        // Loop through each client document found under this user
        for (const clientDoc of clientsSnapshot.docs) {
            const clientName = clientDoc.id;
            const tasksRef = collection(db, "users", user.uid, "clients", clientName, "task");
            const tasksSnapshot = await getDocs(tasksRef);
            tasksSnapshot.forEach((taskDoc) => {
                const taskName = taskDoc.id;
                const taskData = taskDoc.data();
                if (!cachedClientsData[clientName]) {
                    cachedClientsData[clientName] = {};
                }
                cachedClientsData[clientName][taskName] = taskData;
            });
        }
        const clientNames = Object.keys(cachedClientsData);
        if (clientNames.length === 0) {
            logsDisplayContainer.innerHTML = '<p style="color: red;">0 task logs found for your account.</p>';
            return;
        }
        // Populate the Client dropdown
        clientNames.forEach((clientName) => {
            const option = document.createElement("option");
            option.value = clientName;
            option.textContent = clientName;
            clientSelect.appendChild(option);
        });
        logsDisplayContainer.innerHTML = '<p>Select a client and task to view time entries.</p>';
    } catch (error) {
        logsDisplayContainer.innerHTML = `<p style="color: red;">Failed to load data: ${error.message}</p>`;
        console.error("Fetch error:", error);
    }
}

// Handle Client Dropdown Selection
clientSelect.addEventListener("change", (e) => {
    const selectedClient = e.target.value;
    taskSelect.innerHTML = '<option value="">-- Choose a Task --</option>';
    logsDisplayContainer.innerHTML = '<p>Select a task to view time entries.</p>';
    if (exportPdfSetupBtn) exportPdfSetupBtn.classList.add("hidden");
    if (pdfConfigPanel) pdfConfigPanel.classList.add("hidden");
    if (!selectedClient || !cachedClientsData[selectedClient]) {
        taskSelect.disabled = true;
        return;
    }
    // Populate Tasks Dropdown for the chosen client
    const tasks = cachedClientsData[selectedClient];
    Object.keys(tasks).forEach((taskName) => {
        const option = document.createElement("option");
        option.value = taskName;
        option.textContent = taskName;
        taskSelect.appendChild(option);
    });
    taskSelect.disabled = false;
});
// Handle Task Dropdown Selection & Render Entry Cards
if (taskSelect) {
    taskSelect.addEventListener("change", (e) => {
        const selectedClient = clientSelect.value;
        const selectedTask = e.target.value;
        if (!selectedTask || !logsDisplayContainer) {
            if (logsDisplayContainer) logsDisplayContainer.innerHTML = '<p>Select a task to view time entries.</p>';
            if (exportPdfSetupBtn) exportPdfSetupBtn.classList.add("hidden");
            if (pdfConfigPanel) pdfConfigPanel.classList.add("hidden");
            return;
        }
        const taskData = cachedClientsData[selectedClient]?.[selectedTask];
        const entries = taskData?.entries || [];
        if (entries.length === 0) {
            logsDisplayContainer.innerHTML = `<p>No log entries found for <strong>${selectedTask}</strong>.</p>`;
            if (exportPdfSetupBtn) exportPdfSetupBtn.classList.add("hidden");
            return;
        }
        // Show PDF export button
        if (exportPdfSetupBtn) exportPdfSetupBtn.classList.remove("hidden");
        // Safe sort handling both Firestore timestamps and string/Date objects
        entries.sort((a, b) => {
            const timeA = a.startTime?.seconds ? a.startTime.seconds * 1000 : new Date(a.startTime).getTime();
            const timeB = b.startTime?.seconds ? b.startTime.seconds * 1000 : new Date(b.startTime).getTime();
            return timeB - timeA;
        });
        // Render standard log view table
        let tableHtml = `
            <h3>Logs for ${selectedClient} &mdash; ${selectedTask}</h3>
            <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr>
                        <th>Log ID</th>
                        <th>Duration</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                    </tr>
                </thead>
                <tbody>
        `;
        entries.forEach((entry) => {
            const start = entry.startTime?.seconds ? new Date(entry.startTime.seconds * 1000) : new Date(entry.startTime);
            const end = entry.endTime?.seconds ? new Date(entry.endTime.seconds * 1000) : new Date(entry.endTime);
            tableHtml += `
                <tr>
                    <td>${entry.id}</td>
                    <td><strong>${entry.durationMinutes} mins</strong></td>
                    <td>${isNaN(start.getTime()) ? "N/A" : start.toLocaleString()}</td>
                    <td>${isNaN(end.getTime()) ? "N/A" : end.toLocaleString()}</td>
                </tr>
            `;
        });
        tableHtml += `</tbody></table>`;
        logsDisplayContainer.innerHTML = tableHtml;
    });
}
