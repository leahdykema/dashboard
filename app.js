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

const savedStartTime = localStorage.getItem("active_timer_start");
const savedClient = localStorage.getItem("active_timer_client");
const savedTask = localStorage.getItem("active_timer_task");

if (savedStartTime) {
    startTime = new Date(savedStartTime);
    startBtn.disabled = true;
    startBtn.style.opacity = "0.5";
    stopBtn.style.opacity = "1";
    stopBtn.classList.remove("hidden");
    if (clientInput && savedClient) clientInput.value = savedClient;
    if (taskInput && savedTask) taskInput.value = savedTask;
}

// Listen for login/logout state changes automatically
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (loginView) loginView.style.display = "none";
        if (dashboardView) dashboardView.style.display = "block";
        if (logsView) logsView.classList.add("hidden");
        if (pdfConfigPanel) pdfConfigPanel.classList.add("hidden");
        if (authError) authError.textContent = "";
        if (startTime) {
            stopBtn.classList.remove("hidden");
        } else {
            stopBtn.classList.add("hidden");
        }
    } else {
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
        signOut(auth).then(() => {
            window.location.reload();
        }).catch((error) => console.error("Sign out error:", error));
    });
}

// Start Timer
startBtn.addEventListener("click", () => {
    startTime = new Date();
    const clientVal = clientInput.value.trim();
    const taskVal = taskInput.value.trim();
    localStorage.setItem("active_timer_start", startTime.toISOString());
    localStorage.setItem("active_timer_client", clientVal);
    localStorage.setItem("active_timer_task", taskVal);
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
        stopBtn.classList.remove("hidden");
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
        localStorage.removeItem("active_timer_start");
        localStorage.removeItem("active_timer_client");
        localStorage.removeItem("active_timer_task");
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
        stopBtn.classList.remove("hidden");
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
        if (rateAmount <= 0) {
            alert("Please enter a rate amount.");
            return;
        }
        const taskData = cachedClientsData[selectedClient]?.[selectedTask];
        const entries = taskData?.entries || [];
        if (entries.length === 0) {
            alert("No entries to export.");
            return;
        }
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("PDF library is still loading. Please wait a moment and try again.");
            return;
        }
        // Total minutes, the same numbers shown in the table
        let totalMinutes = 0;
        entries.forEach((entry) => {
            totalMinutes += Number(entry.durationMinutes) || 0;
        });
        const totalHours = totalMinutes / 60;
        const timeText = `${Math.floor(totalMinutes / 60)} hr ${totalMinutes % 60} min`;

        let grandTotal = 0;
        let pricingSummaryText = "";
        if (rateType === "set") {
            grandTotal = rateAmount;
            pricingSummaryText = `Set Rate: $${rateAmount.toFixed(2)}`;
        } else {
            grandTotal = totalHours * rateAmount;
            pricingSummaryText = `Hourly Rate: $${rateAmount.toFixed(2)}/hr | Total Time: ${timeText}`;
        }
        const clean = (s) => String(s).replace(/[\u202f\u00a0]/g, " ");
        const fmt = (v) => {
            const d = v?.seconds ? new Date(v.seconds * 1000) : new Date(v);
            return isNaN(d.getTime()) ? "N/A" : clean(d.toLocaleString());
        };
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: "pt", format: "letter" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 54;
        const colStart = margin;
        const colEnd = margin + 200;
        const colDur = pageW - margin;
        const rowH = 24;
        let y = margin;
        pdf.setTextColor(17, 17, 17);
        // Title block
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(22);
        pdf.text(clean(selectedClient), pageW / 2, y + 16, { align: "center", maxWidth: pageW - margin * 2 });
        y += 38;
        pdf.setFontSize(13);
        pdf.text(clean(selectedTask), pageW / 2, y, { align: "center", maxWidth: pageW - margin * 2 });
        y += 14;
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, y, pageW - margin, y);
        y += 24;
        // Details
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Project Start Date:", margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(clean(startDate), margin + 118, y);
        y += 20;
        pdf.setFont("helvetica", "bold");
        pdf.text("Project End Date:", margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(clean(endDate), margin + 118, y);
        y += 20;
        pdf.setFont("helvetica", "bold");
        const summaryLines = pdf.splitTextToSize(clean(pricingSummaryText), pageW - margin * 2);
        pdf.text(summaryLines, margin, y);
        y += summaryLines.length * 16 + 14;
        const drawHeader = () => {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            pdf.text("Start Time", colStart, y);
            pdf.text("End Time", colEnd, y);
            pdf.text("Duration", colDur, y, { align: "right" });
            pdf.setDrawColor(150, 150, 150);
            pdf.line(margin, y + 6, pageW - margin, y + 6);
            y += rowH;
            pdf.setFont("helvetica", "normal");
        };
        drawHeader();
        entries.forEach((entry) => {
            if (y > pageH - margin - 50) {
                pdf.addPage();
                y = margin;
                drawHeader();
            }
            pdf.setFontSize(11);
            pdf.text(fmt(entry.startTime), colStart, y);
            pdf.text(fmt(entry.endTime), colEnd, y);
            pdf.text(`${entry.durationMinutes} mins`, colDur, y, { align: "right" });
            pdf.setDrawColor(225, 225, 225);
            pdf.line(margin, y + 7, pageW - margin, y + 7);
            y += rowH;
        });
        if (y > pageH - margin - 40) {
            pdf.addPage();
            y = margin;
        }
        y += 14;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text(`Total: $${grandTotal.toFixed(2)}`, pageW - margin, y, { align: "right" });
        pdf.save(`${selectedClient}_${selectedTask}_Report.pdf`.replace(/\s+/g, "_"));
        // Close the export panel and bring the buttons back
        if (pdfConfigPanel) pdfConfigPanel.classList.add("hidden");
        exportPdfSetupBtn.classList.remove("hidden");
        backBtn.classList.remove("hidden");
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
                    <td>${start.toLocaleString()}</td>
                    <td>${end.toLocaleString()}</td>
                </tr>
            `;
        });
        tableHtml += `</tbody></table>`;
        logsDisplayContainer.innerHTML = tableHtml;
    });
}
