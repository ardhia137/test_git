
const API_URL = 'http://localhost:8080/tasks/approved';
const TOKEN_KEY = localStorage.getItem('authToken') ? 'authToken' : 'token';

document.addEventListener('DOMContentLoaded', () => {
    fetchApprovedTasks();
    document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('userRole');
        window.location.href = '../index.html';
    });
});

async function fetchApprovedTasks() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        console.error('Token tidak ditemukan. Mengarahkan ke login...');
        window.location.href = '../index.html';
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401 || response.status === 403) {
            console.error('Token tidak valid atau kedaluwarsa. Mengarahkan ke login...');
            localStorage.removeItem(TOKEN_KEY);
            window.location.href = '../index.html';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        const tasks = data.tasks || []; 
        renderDashboard(tasks);
    } catch (error) {
        console.error('Gagal mengambil data:', error);
        document.getElementById('kpi-container').innerHTML = `<div class="col-12"><p class="text-center text-danger">Gagal memuat data: ${error.message}</p></div>`;
    }
}

function renderDashboard(tasks) {
    renderKpi(tasks);
    renderTaskTable(tasks);
    renderTaskModals(tasks);
}

function renderKpi(tasks) {
    const totalTasks = tasks.length;
    const inProgressTasks = tasks.filter(t => t.status.toLowerCase() === 'in progress').length;
    const activeTasks = tasks.filter(t => t.status.toLowerCase() !== 'completed');
    const totalProgress = activeTasks.reduce((sum, t) => sum + t.progress, 0);
    const avgProgress = activeTasks.length > 0
        ? (totalProgress / activeTasks.length).toFixed(0)
        : 0;

    const upcomingDeadlines = tasks.filter(t =>
        new Date(t.deadline) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
        t.status.toLowerCase() !== 'completed'
    ).length;

    document.getElementById('kpi-total').innerText = totalTasks;
    document.getElementById('kpi-progress').innerText = inProgressTasks;
    document.getElementById('kpi-avg-percent').innerText = `${avgProgress}%`;
    document.getElementById('kpi-avg-bar').style.width = `${avgProgress}%`;
    document.getElementById('kpi-deadline').innerText = upcomingDeadlines;
}

function renderTaskTable(tasks) {
    const tableBody = document.getElementById('task-table-body');
    tableBody.innerHTML = '';

    if (tasks.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center">Tidak ada tugas.</td></tr>`;
        return;
    }

    tasks.forEach(task => {
        const deadline = new Date(task.deadline).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        });

        const statusBadge = getStatusBadge(task.status);

        const rowHtml = `
                    <tr>
                        <td><div class="fw-bold">${task.title} (ID: ${task.id})</div></td>
                        <td>${task.assigned_leader.username}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <div class="progress-bar-container d-flex align-items-center">
                                <span class="fw-bold me-2">${task.progress}%</span>
                                <div class="progress flex-grow-1" style="height: 10px;">
                                    <div class="progress-bar" role="progressbar" style="width: ${task.progress}%;" aria-valuenow="${task.progress}"></div>
                                </div>
                            </div>
                        </td>
                        <td>${deadline}</td>
                        <td>
                            <button type="button" class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#taskDetailModal${task.id}">
                                Lihat Detail
                            </button>
                        </td>
                    </tr>
                `;
        tableBody.innerHTML += rowHtml;
    });
}

function renderTaskModals(tasks) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = '';

    tasks.forEach(task => {
        let historyHtml = '';
        if (task.histories && task.histories.length > 0) {
            task.histories.forEach(history => {
                const historyDate = new Date(history.created_at).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                const historyBadge = getHistoryBadge(history.action);
                const noteHtml = history.note ? `<p class="mb-1">"${history.note}"</p>` : '';

                historyHtml += `
                            <div class="history-item ${history.action}">
                                ${historyBadge}
                                <strong>(oleh: ${history.action_by.username})</strong>
                                ${noteHtml}
                                <p class="mb-0 small text-muted">${historyDate}</p>
                            </div>
                        `;
            });
        } else {
            historyHtml = '<p>Belum ada histori.</p>';
        }

        const deadline = new Date(task.deadline).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const statusBadge = getStatusBadge(task.status);

        const modalHtml = `
                    <div class="modal fade" id="taskDetailModal${task.id}" tabindex="-1" aria-labelledby="taskDetailModalLabel${task.id}" aria-hidden="true">
                        <div class="modal-dialog modal-lg modal-dialog-centered">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="taskDetailModalLabel${task.id}">Detail Tugas: ${task.title} (ID: ${task.id})</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="row">
                                        <div class="col-md-7">
                                            <strong>Deskripsi:</strong>
                                            <p>${task.description}</p>
                                        </div>
                                        <div class="col-md-5">
                                            <ul class="list-unstyled">
                                                <li><strong>Leader:</strong> ${task.assigned_leader.username}</li>
                                                <li><strong>Status:</strong> ${statusBadge}</li>
                                                <li><strong>Dibuat oleh:</strong> ${task.created_by.username}</li>
                                                <li><strong>Deadline:</strong> ${deadline}</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <strong>Progress: ${task.progress}%</strong>
                                    <div class="progress mb-4">
                                        <div class="progress-bar" role="progressbar" style="width: ${task.progress}%;" aria-valuenow="${task.progress}"></div>
                                    </div>
                                    <hr>
                                    <h6 class="mb-3">Histori Aktivitas</h6>
                                    <div class="history-log">
                                        ${historyHtml}
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
        modalContainer.innerHTML += modalHtml;
    });
}


function getStatusBadge(status) {
    switch (status.toLowerCase()) {
        case 'in progress':
            return `<span class="badge bg-info text-dark">In Progress</span>`;
        case 'completed':
            return `<span class="badge bg-success">Completed</span>`;
        case 'pending':
            return `<span class="badge bg-warning text-dark">Pending</span>`;
        case 'revision':
            return `<span class="badge bg-danger">Revision</span>`;
        default:
            return `<span class="badge bg-secondary">${status}</span>`;
    }
}

function getHistoryBadge(action) {
    switch (action.toLowerCase()) {
        case 'submit':
            return `<span class="badge bg-info me-2">Submit</span>`;
        case 'revision':
            return `<span class="badge bg-warning me-2">Revision</span>`;
        case 'approve':
            return `<span class="badge bg-success me-2">Approve</span>`;
        case 'update_progress':
            return `<span class="badge bg-secondary me-2">Update</span>`;
        default:
            return `<span class="badge bg-dark me-2">${action}</span>`;
    }
}