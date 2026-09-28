/* ======================================
   TASKY V2.1
   tasks.js - Task system + advanced editor
====================================== */

let tasks = [];
let currentSearch = "";
let currentStatus = "all";
let currentPriority = "all";
let currentSort = "newest";

function loadTasks() {
    const savedTasks = localStorage.getItem("tasks");
    if (!savedTasks) { tasks = []; return; }
    try {
        const parsed = JSON.parse(savedTasks);
        tasks = Array.isArray(parsed) ? parsed.map(normalizeTask) : [];
    } catch (error) {
        console.error("Task storage error:", error);
        tasks = [];
    }
}

function normalizeTask(task) {
    return {
        id: task.id || generateID(),
        text: String(task.text || "").trim(),
        description: String(task.description || ""),
        completed: Boolean(task.completed),
        priority: ["Low", "Medium", "High"].includes(task.priority) ? task.priority : "Medium",
        deadline: task.deadline || "",
        duration: Number(task.duration) || 60,
        category: task.category || "Personal",
        reminder: task.reminder || "none",
        recurrence: task.recurrence || "none",
        subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(normalizeSubtask) : [],
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
        completedAt: task.completedAt || null
    };
}

function normalizeSubtask(item) {
    if (typeof item === "string") return { id: generateID(), text: item, completed: false };
    return { id: item.id || generateID(), text: String(item.text || "").trim(), completed: Boolean(item.completed) };
}

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

function generateID() {
    return Date.now().toString() + Math.random().toString(16).slice(2);
}

function createTask(text, priority = "Medium", deadline = "", extra = {}) {
    return normalizeTask({
        id: generateID(), text: text.trim(), completed: false, priority, deadline,
        description: extra.description || "", duration: extra.duration || 60,
        category: extra.category || "Personal", reminder: extra.reminder || "none",
        recurrence: extra.recurrence || "none", subtasks: extra.subtasks || [],
        createdAt: new Date().toISOString(), completedAt: null
    });
}

function addTask() {
    const input = document.getElementById("taskInput");
    const priorityInput = document.getElementById("priority");
    const deadlineInput = document.getElementById("deadline");
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast("Please enter a task."); input.focus(); return; }

    const newTask = createTask(text, priorityInput?.value || "Medium", deadlineInput?.value || "");
    tasks.unshift(newTask);
    saveTasks();
    input.value = "";
    if (deadlineInput) deadlineInput.value = "";
    if (priorityInput) priorityInput.value = "Medium";
    refreshTaskViews();
    showToast("✅ Task added!");
}

function quickAddTask() {
    const input = document.getElementById("quickTaskInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast("Enter a task first."); input.focus(); return; }
    tasks.unshift(createTask(text));
    saveTasks();
    input.value = "";
    refreshTaskViews();
    showToast("✅ Task added!");
}

function refreshTaskViews() {
    renderTasks();
    if (typeof updateDashboard === "function") updateDashboard();
    if (typeof updateAnalytics === "function") updateAnalytics();
    if (typeof buildCalendar === "function") buildCalendar();
}

function getFilteredTasks() {
    let filtered = [...tasks];
    if (currentSearch.trim()) {
        const search = currentSearch.trim().toLowerCase();
        filtered = filtered.filter(task =>
            task.text.toLowerCase().includes(search) ||
            task.description.toLowerCase().includes(search) ||
            task.category.toLowerCase().includes(search)
        );
    }
    if (currentStatus === "active") filtered = filtered.filter(task => !task.completed);
    if (currentStatus === "completed") filtered = filtered.filter(task => task.completed);
    if (currentPriority !== "all") filtered = filtered.filter(task => task.priority.toLowerCase() === currentPriority);

    if (currentSort === "newest") filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (currentSort === "oldest") filtered.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (currentSort === "deadline") filtered.sort((a,b) => {
        if (!a.deadline) return 1; if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
    });
    if (currentSort === "priority") {
        const order = { high: 3, medium: 2, low: 1 };
        filtered.sort((a,b) => (order[b.priority.toLowerCase()] || 0) - (order[a.priority.toLowerCase()] || 0));
    }
    return filtered;
}

function renderTasks() {
    const taskList = document.getElementById("taskList");
    if (!taskList) return;
    taskList.innerHTML = "";
    const visibleTasks = getFilteredTasks();
    if (!visibleTasks.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = tasks.length === 0 ? "No tasks yet. Add your first task! 🎯" : "🔍 No tasks match your search or filters.";
        taskList.appendChild(empty);
        return;
    }

    visibleTasks.forEach(task => {
        const li = document.createElement("li");
        li.className = "task-card";
        const deadlineText = task.deadline ? formatTaskDate(task.deadline) : "";
        const doneSubtasks = task.subtasks.filter(item => item.completed).length;
        const subtaskHtml = task.subtasks.length ? `
            <div class="task-subtasks">
                ${task.subtasks.slice(0, 3).map(item => `
                    <div class="task-subtask ${item.completed ? "done" : ""}">
                        ${item.completed ? "✓" : "○"} ${escapeHTML(item.text)}
                    </div>`).join("")}
                ${task.subtasks.length > 3 ? `<div class="task-chip">+${task.subtasks.length - 3} more subtasks</div>` : ""}
            </div>` : "";

        li.innerHTML = `
            <div class="task-info">
                <div class="task-title ${task.completed ? "completed" : ""}">${escapeHTML(task.text)}</div>
                ${task.description ? `<div class="task-description">${escapeHTML(task.description)}</div>` : ""}
                <div class="task-meta">
                    <span class="priority ${task.priority.toLowerCase()}">${escapeHTML(task.priority)}</span>
                    ${deadlineText ? `<span class="deadline">📅 ${deadlineText}</span>` : ""}
                </div>
                <div class="task-extra-meta">
                    <span class="task-chip">⏱️ ${formatDuration(task.duration)}</span>
                    <span class="task-chip">🏷️ ${escapeHTML(task.category)}</span>
                    ${task.reminder !== "none" ? `<span class="task-chip">🔔 Reminder</span>` : ""}
                    ${task.recurrence !== "none" ? `<span class="task-chip">🔁 ${escapeHTML(formatRecurrence(task.recurrence))}</span>` : ""}
                    ${task.subtasks.length ? `<span class="task-chip">☑️ ${doneSubtasks}/${task.subtasks.length}</span>` : ""}
                </div>
                ${subtaskHtml}
            </div>
            <div class="task-buttons">
                <button class="complete-btn" type="button" data-id="${task.id}" title="${task.completed ? "Reopen task" : "Complete task"}">${task.completed ? "↩" : "✓"}</button>
                <button class="edit-btn" type="button" data-id="${task.id}" title="Edit task">✏</button>
                <button class="delete-btn" type="button" data-id="${task.id}" title="Delete task">🗑</button>
            </div>`;
        taskList.appendChild(li);
    });
    setupTaskButtons();
}

function setupTaskButtons() {
    document.querySelectorAll(".complete-btn").forEach(button => button.onclick = () => completeTask(button.dataset.id));
    document.querySelectorAll(".edit-btn").forEach(button => button.onclick = () => openTaskEditor(button.dataset.id));
    document.querySelectorAll(".delete-btn").forEach(button => button.onclick = () => deleteTask(button.dataset.id));
}

function completeTask(id) {
    const task = tasks.find(item => String(item.id) === String(id));
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();
    saveTasks();
    refreshTaskViews();
    showToast(task.completed ? "🎉 Task completed!" : "Task reopened.");
}

function deleteTask(id) {
    const task = tasks.find(item => String(item.id) === String(id));
    if (!task) return;
    if (!confirm(`Delete “${task.text}”?`)) return;
    tasks = tasks.filter(item => String(item.id) !== String(id));
    saveTasks();
    refreshTaskViews();
    showToast("🗑️ Task deleted.");
}

function openTaskEditor(id = null) {
    const modal = document.getElementById("taskEditorModal");
    if (!modal) return;
    const task = id ? tasks.find(item => String(item.id) === String(id)) : null;
    document.getElementById("taskEditorTitle").textContent = task ? "Edit Task" : "Create Task";
    document.getElementById("taskEditorSubtitle").textContent = task ? "Update the details Tasky uses to organize this task." : "Give your task the details Tasky needs to plan it properly.";
    document.getElementById("saveTaskEditorBtn").textContent = task ? "Save Changes" : "Create Task";
    document.getElementById("editorTaskId").value = task?.id || "";
    document.getElementById("editorTaskText").value = task?.text || "";
    document.getElementById("editorDescription").value = task?.description || "";
    document.getElementById("editorPriority").value = task?.priority || "Medium";
    document.getElementById("editorDeadline").value = task?.deadline || "";
    document.getElementById("editorDuration").value = String(task?.duration || 60);
    document.getElementById("editorCategory").value = task?.category || "Personal";
    document.getElementById("editorReminder").value = task?.reminder || "none";
    document.getElementById("editorRecurrence").value = task?.recurrence || "none";
    document.getElementById("editorSubtasks").value = task?.subtasks.map(item => item.text).join("\n") || "";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(() => document.getElementById("editorTaskText")?.focus(), 50);
}

function closeTaskEditor() {
    const modal = document.getElementById("taskEditorModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function saveTaskFromEditor(event) {
    event.preventDefault();
    const text = document.getElementById("editorTaskText").value.trim();
    if (!text) { showToast("Task name cannot be empty."); return; }
    const id = document.getElementById("editorTaskId").value;
    const subtasks = document.getElementById("editorSubtasks").value.split("\n").map(item => item.trim()).filter(Boolean);
    const data = {
        text,
        description: document.getElementById("editorDescription").value.trim(),
        priority: document.getElementById("editorPriority").value,
        deadline: document.getElementById("editorDeadline").value,
        duration: Number(document.getElementById("editorDuration").value) || 60,
        category: document.getElementById("editorCategory").value,
        reminder: document.getElementById("editorReminder").value,
        recurrence: document.getElementById("editorRecurrence").value,
        subtasks
    };

    if (id) {
        const task = tasks.find(item => String(item.id) === String(id));
        if (!task) return;
        const oldSubtasks = task.subtasks || [];
        task.text = data.text;
        task.description = data.description;
        task.priority = data.priority;
        task.deadline = data.deadline;
        task.duration = data.duration;
        task.category = data.category;
        task.reminder = data.reminder;
        task.recurrence = data.recurrence;
        task.subtasks = data.subtasks.map(text => {
            const existing = oldSubtasks.find(item => item.text === text);
            return existing || { id: generateID(), text, completed: false };
        });
        task.updatedAt = new Date().toISOString();
        saveTasks();
        closeTaskEditor();
        refreshTaskViews();
        showToast("✏️ Task updated!");
    } else {
        tasks.unshift(createTask(data.text, data.priority, data.deadline, data));
        saveTasks();
        closeTaskEditor();
        refreshTaskViews();
        showToast("✨ Task created!");
    }
}

function editTask(id) { openTaskEditor(id); }

function formatTaskDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(minutes) {
    const value = Number(minutes) || 60;
    if (value < 60) return `${value} min`;
    if (value % 60 === 0) return `${value / 60}h`;
    return `${Math.floor(value / 60)}h ${value % 60}m`;
}

function formatRecurrence(value) {
    return { daily: "Daily", weekdays: "Weekdays", weekly: "Weekly" }[value] || "Repeat";
}

function escapeHTML(text) {
    const element = document.createElement("div");
    element.textContent = text;
    return element.innerHTML;
}

function updateDashboard() {
    const today = new Date().toISOString().split("T")[0];
    const todayTasks = tasks.filter(task => task.deadline === today || (task.completedAt && task.completedAt.startsWith(today)));
    const completedToday = todayTasks.filter(task => task.completed && task.completedAt?.startsWith(today)).length;
    const remainingToday = todayTasks.filter(task => !task.completed).length;
    const totalToday = todayTasks.length;
    const percent = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;

    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("completedCount", completedToday); set("remainingCount", remainingToday); set("todayPercent", `${percent}%`);
    const bar = document.getElementById("progressBar"); if (bar) bar.style.width = `${percent}%`;

    const focusList = document.getElementById("focusList");
    if (focusList) {
        focusList.innerHTML = "";
        const focusTasks = tasks.filter(task => !task.completed).sort((a,b) => {
            const p = { High: 3, Medium: 2, Low: 1 };
            const priorityDiff = (p[b.priority] || 0) - (p[a.priority] || 0);
            if (priorityDiff) return priorityDiff;
            if (!a.deadline) return 1; if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        }).slice(0, 3);
        if (!focusTasks.length) { focusList.innerHTML = "<li>Nothing planned yet. 🎯</li>"; }
        else focusTasks.forEach(task => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>${escapeHTML(task.text)}</strong><span class="dashboard-deadline">${task.deadline ? formatTaskDate(task.deadline) : "No deadline"}</span>`;
            li.classList.add(`priority-${task.priority.toLowerCase()}`);
            focusList.appendChild(li);
        });
    }

    const upcomingList = document.getElementById("upcomingList");
    if (upcomingList) {
        upcomingList.innerHTML = "";
        const upcomingTasks = tasks.filter(task => !task.completed && task.deadline && task.deadline >= today).sort((a,b) => new Date(a.deadline) - new Date(b.deadline)).slice(0,5);
        if (!upcomingTasks.length) upcomingList.innerHTML = "<li>No upcoming deadlines.</li>";
        else upcomingTasks.forEach(task => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>${escapeHTML(task.text)}</strong><span class="dashboard-deadline">${formatTaskDate(task.deadline)}</span>`;
            li.classList.add(`priority-${task.priority.toLowerCase()}`);
            upcomingList.appendChild(li);
        });
    }
}

function setupTasks() {
    loadTasks();
    renderTasks();
    updateDashboard();
    if (typeof updateAnalytics === "function") updateAnalytics();

    document.getElementById("addTaskBtn")?.addEventListener("click", addTask);
    document.getElementById("quickAddBtn")?.addEventListener("click", quickAddTask);
    document.getElementById("openTaskEditorBtn")?.addEventListener("click", () => openTaskEditor());
    document.getElementById("taskEditorForm")?.addEventListener("submit", saveTaskFromEditor);
    document.querySelectorAll("[data-close-task-editor]").forEach(el => el.addEventListener("click", closeTaskEditor));
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeTaskEditor(); });

    document.getElementById("searchInput")?.addEventListener("input", event => { currentSearch = event.target.value; renderTasks(); });
    document.getElementById("statusFilter")?.addEventListener("change", event => { currentStatus = event.target.value; renderTasks(); });
    document.getElementById("priorityFilter")?.addEventListener("change", event => { currentPriority = event.target.value; renderTasks(); });
    document.getElementById("sortTasks")?.addEventListener("change", event => { currentSort = event.target.value; renderTasks(); });
    document.getElementById("taskInput")?.addEventListener("keydown", event => { if (event.key === "Enter") addTask(); });
    document.getElementById("quickTaskInput")?.addEventListener("keydown", event => { if (event.key === "Enter") quickAddTask(); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupTasks);
else setupTasks();
