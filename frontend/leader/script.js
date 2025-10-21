const TOKEN_KEY = 'authToken';
const API_URL = 'http://localhost:8080/tasks/';

document.addEventListener('DOMContentLoaded', () => {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll(
        '[data-bs-toggle="tooltip"], [title]'));
    tooltipTriggerList.map(el => el.getAttribute('title') ? new bootstrap.Tooltip(el) : null);
    loadAndRenderTasks();

    document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '../index.html';
    });
    const rejectForm = document.getElementById('rejectTaskForm');
    if (rejectForm) {
        rejectForm.addEventListener('submit', handleRejectTaskSubmit);
    }

    const updateProgressForm = document.getElementById('updateProgressForm');
    if (updateProgressForm) {
        updateProgressForm.addEventListener('submit', handleUpdateProgressSubmit);
    }
});


async function loadAndRenderTasks() {

    const tasks = await fetchTasks();
    if (tasks) {
        renderKpi(tasks);
        renderTable(tasks);
        renderModals(tasks);
        setupActionListeners(tasks);
    } else {
        const tableBody = document.getElementById('task-table-body');
        tableBody.innerHTML =
            `<tr><td colspan="6" class="text-center p-4 text-danger">Gagal memuat data. Periksa konsol.</td></tr>`;
    }
}

async function fetchTasks() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        console.error('Token tidak ditemukan.');
        window.location.href = '../index.html';
        return null;
    }
    try {
        const response = await fetch(`${API_URL}pending`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem(TOKEN_KEY);
            window.location.href = '../index.html';
            return null;
        }
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data.tasks;
    } catch (error) {
        console.error('Gagal mengambil data tugas:', error);
        return null;
    }
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

function renderTable(tasks) {
    const tableBody = document.getElementById('task-table-body');
    tableBody.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        tableBody.innerHTML =
            `<tr><td colspan="6" class="text-center p-4">Tidak ada tugas yang ditemukan.</td></tr>`;
        return;
    }

    tasks.forEach(task => {
        const deadline = new Date(task.deadline).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const statusBadge = getStatusBadge(task.status);
        const taskStatus = task.status.toLowerCase();

        let actionButtonEdit = '';
        if (taskStatus === 'in progress') {
            actionButtonEdit = `
                <a href="#" class="action-icon text-success me-2 action-update"
                   data-task-id="${task.id}"
                   title="Update Progress">
                    <i class="bi bi-pencil-square fs-5"></i>
                </a>`;
        } 
        let actionButtonsSubmit = '';
    
       if (taskStatus === 'submitted') {
        actionButtonsSubmit = `
         <a href="#" class="action-icon text-success me-2 action-approve"
            data-task-id="${task.id}"
            title="Setujui Tugas">
            <i class="bi bi-check-lg fs-5"></i>
         </a>
         <a href="#" class="action-icon text-danger action-reject"
            data-task-id="${task.id}"
            data-bs-toggle="modal" 
            data-bs-target="#rejectTaskModal"  
            title="Tolak / Revisi Tugas">
            <i class="bi bi-x-lg fs-5"></i>
         </a>`;
}

        const row = document.createElement('tr');
        row.innerHTML = `
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
            <td class="text-center">
                <a href="#" class="action-icon text-primary me-2"
                   data-bs-toggle="modal"
                   data-bs-target="#taskDetailModal${task.id}"
                   title="Lihat Detail">
                    <i class="bi bi-eye-fill fs-5"></i>
                </a>
                ${actionButtonEdit}
                 ${actionButtonsSubmit} 
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderModals(tasks) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = '';

    tasks.forEach(task => {
        let historyHtml = '';
        if (task.histories && task.histories.length > 0) {
            historyHtml = task.histories.map(history => {
                const historyDate = new Date(history.created_at).toLocaleString('id-ID');
                const historyBadge = getHistoryBadge(history.action);
                const noteHtml = history.note ? `<p class="mb-1">"${history.note}"</p>` : '';
                return `
                    <div class="history-item ${history.action.toLowerCase()}">
                        ${historyBadge}
                        <strong>(oleh: ${history.action_by.username})</strong>
                        ${noteHtml}
                        <p class="mb-0 small text-muted">${historyDate}</p>
                    </div>
                `;
            }).join('');
        }

        if (historyHtml.length === 0) historyHtml = '<p>Belum ada histori.</p>';

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
                                <div class="col-md-7"><strong>Deskripsi:</strong><p>${task.description}</p></div>
                                <div class="col-md-5">
                                    <ul class="list-unstyled">
                                        <li><strong>Leader:</strong> ${task.assigned_leader.username}</li>
                                        <li><strong>Status:</strong> ${getStatusBadge(task.status)}</li>
                                        <li><strong>Dibuat oleh:</strong> ${task.created_by.username}</li>
                                        <li><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString('id-ID')}</li>
                                    </ul>
                                </div>
                            </div>
                            <strong>Progress: ${task.progress}%</strong>
                            <div class="progress mb-4"><div class="progress-bar" role="progressbar" style="width: ${task.progress}%;"></div></div>
                            <hr><h6 class="mb-3">Histori Aktivitas</h6>
                            <div class="history-log">${historyHtml}</div>
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

function setupActionListeners(tasks) {
    const updateModalEl = document.getElementById('updateProgressModal');
    const updateModal = updateModalEl ? new bootstrap.Modal(updateModalEl) : null;


    document.querySelectorAll('.action-update').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (!updateModal) return;
            const taskId = button.getAttribute('data-task-id');
            const task = tasks.find(t => t.id == taskId);
            if (!task) return;

            document.getElementById('updateProgressModalLabel').innerText = `Update Progress: ${task.title}`;
            document.getElementById('updateTaskId').value = task.id;
            document.getElementById('progressInput').value = task.progress;
            document.getElementById('progressValue').innerText = `${task.progress}%`;
            updateModal.show();
        });
    });

    document.querySelectorAll('.action-edit').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (!editModal) return;
            const taskId = button.getAttribute('data-task-id');
            const task = tasks.find(t => t.id == taskId);
            if (!task) return;

            document.getElementById('editTaskModalLabel').innerText = `Revisi Tugas: ${task.title}`;
            document.getElementById('editTaskId').value = task.id;
            document.getElementById('editTaskTitle').value = task.title;
            document.getElementById('editTaskDescription').value = task.description;
            document.getElementById('editTaskLeader').value = task.assigned_leader.id;

            try {
                const deadlineDate = new Date(task.deadline);
                const yyyy = deadlineDate.getFullYear();
                const mm = String(deadlineDate.getMonth() + 1).padStart(2, '0');
                const dd = String(deadlineDate.getDate()).padStart(2, '0');
                document.getElementById('editTaskDeadline').value = `${yyyy}-${mm}-${dd}`;
            } catch (error) {
                document.getElementById('editTaskDeadline').value = '';
            }

            editModal.show();
        });
    });

    const progressInputElement = document.getElementById('progressInput');
    if (progressInputElement) {
        progressInputElement.addEventListener('input', (event) => {
            document.getElementById('progressValue').innerText = event.target.value + '%';
        });
    }


    document.querySelectorAll('.action-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (!deleteModal) return;
            const taskId = button.getAttribute('data-task-id');
            const task = tasks.find(t => t.id == taskId);
            if (!task) return;

            document.getElementById('deleteTaskId').value = task.id;
            document.getElementById('deleteTaskName').innerText = `"${task.title} (ID: ${task.id})"`;
            deleteModal.show();
        });
    });
    document.querySelectorAll('.action-approve').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            const taskId = button.getAttribute('data-task-id');
            await handleApproveTask(taskId);
        });
    });
    document.querySelectorAll('.action-reject').forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        const taskId = button.getAttribute('data-task-id');
        const rejectInput = document.getElementById('rejectTaskId');
        if (rejectInput) rejectInput.value = taskId;
    });
});

}

function getStatusBadge(status) {
    const lowerStatus = status ? status.toLowerCase() : '';
    switch (lowerStatus) {
        case 'in progress': return `<span class="badge bg-info text-dark">In Progress</span>`;
        case 'completed': return `<span class="badge bg-success">Completed</span>`;
        case 'pending': return `<span class="badge bg-warning text-dark">Pending</span>`;
        case 'revision': return `<span class="badge bg-danger">Revision</span>`;
        case 'submitted': return `<span class="badge bg-primary">Submitted</span>`;
        default: return `<span class="badge bg-secondary">${status || 'N/A'}</span>`;
    }
}

function getHistoryBadge(action) {
    const lowerAction = action ? action.toLowerCase() : '';
    switch (lowerAction) {
        case 'submit': return `<span class="badge bg-info me-2">Submit</span>`;
        case 'revision': return `<span class="badge bg-warning me-2">Revision</span>`;
        case 'approve': return `<span class="badge bg-success me-2">Approve</span>`;
        case 'update_progress': return `<span class="badge bg-secondary me-2">Update</span>`;
        default: return `<span class="badge bg-dark me-2">${action || 'N/A'}</span>`;
    }
}

function clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
    }
}
async function handleApproveTask(taskId) {
    if (!taskId) {
        Swal.fire({
            title: 'Error!',
            text: 'ID Tugas tidak valid untuk approve!',
            icon: 'error',
            confirmButtonText: 'OK'
        });
        return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        Swal.fire({
            title: 'Otentikasi Gagal',
            text: 'Token tidak ditemukan. Silakan login ulang.',
            icon: 'warning',
            confirmButtonText: 'Login Ulang'
        }).then(() => {
            window.location.href = '../index.html';
        });
        return;
    }

    const result = await Swal.fire({
        title: `Setujui Tugas ID: ${taskId}?`,
        text: "Tugas akan ditandai sebagai 'Completed' dan tidak bisa diubah lagi.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, Setujui!',
        cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}${taskId}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            let errorMsg = `Gagal menyetujui tugas. Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        Swal.fire({
            title: 'Berhasil!',
            text: `Tugas ID: ${taskId} berhasil disetujui!`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        loadAndRenderTasks();

    } catch (error) {
        Swal.fire({
            title: 'Gagal!',
            text: `Gagal menyetujui tugas: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

async function handleRejectTaskSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const taskId = form.rejectTaskId.value;
    const note = form.rejectNote.value;

    if (!taskId) {
        Swal.fire('Error', 'ID Tugas tidak ditemukan!', 'error');
        return;
    }
    if (!note) {
        Swal.fire('Oops...', 'Catatan revisi wajib diisi!', 'warning');
        form.rejectNote.focus();
        return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        Swal.fire({
            title: 'Otentikasi Gagal',
            text: 'Token tidak ditemukan. Silakan login ulang.',
            icon: 'warning',
            confirmButtonText: 'Login Ulang'
        }).then(() => {
            window.location.href = '../index.html';
        });
        return;
    }

    const requestBody = {
        note: note
    };

    try {
        const response = await fetch(`${API_URL}${taskId}/revise`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorMsg = `Gagal mengirim revisi. Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('rejectTaskModal'));
        if (modalInstance) modalInstance.hide();
        
        Swal.fire({
            title: 'Berhasil!',
            text: `Tugas ID: ${taskId} berhasil dikirim untuk revisi.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        clearForm('rejectTaskForm');
        loadAndRenderTasks();

    } catch (error) {
        Swal.fire({
            title: 'Gagal!',
            text: `Gagal mengirim revisi: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

async function handleUpdateProgressSubmit(event) {
    event.preventDefault();
    const form = event.target;
    
    const taskId = form.updateTaskId.value;
    const progress = form.progressInput.value;
    const note = form.progressNote.value;

    if (!taskId) {
        Swal.fire('Error', 'ID Tugas tidak ditemukan!', 'error');
        return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        Swal.fire({
            title: 'Otentikasi Gagal',
            text: 'Token tidak ditemukan. Silakan login ulang.',
            icon: 'warning',
            confirmButtonText: 'Login Ulang'
        }).then(() => {
            window.location.href = '../index.html';
        });
        return;
    }

    const requestBody = {
        progress: parseInt(progress),
        note: note
    };

    try {
        const response = await fetch(`${API_URL}${taskId}/progress/override`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorMsg = `Gagal meng-override progress. Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('updateProgressModal'));
        if (modalInstance) modalInstance.hide();
        
        Swal.fire({
            title: 'Berhasil!',
            text: `Progress untuk Tugas ID: ${taskId} berhasil di-override.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        clearForm('updateProgressForm');
        document.getElementById('progressValue').innerText = '0%';
        loadAndRenderTasks();

    } catch (error) {
        Swal.fire({
            title: 'Gagal!',
            text: `Gagal meng-override progress: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}