const TOKEN_KEY = 'authToken';
const API_URL = 'http://localhost:8080/tasks/';

document.addEventListener('DOMContentLoaded', () => {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll(
        '[data-bs-toggle="tooltip"], [title]'));
    tooltipTriggerList.map(el => el.getAttribute('title') ? new bootstrap.Tooltip(el) : null);

    loadAndRenderTasks();
    loadAndPopulateLeaders();

    document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '../index.html';
    });
    document.getElementById('addTaskForm').addEventListener('submit', handleAddTask);
    document.getElementById('editTaskForm').addEventListener('submit', handleEditTask);
    document.getElementById('confirmDeleteButton').addEventListener('click', handleDeleteTask);
    document.getElementById('updateProgressForm').addEventListener('submit', handleUpdateProgress);

});
async function loadAndPopulateLeaders() {
    const leaders = await fetchLeaders();
    if (leaders) {
        populateLeaderDropdown(leaders);
    } else {
        const leaderSelect = document.getElementById('taskLeader');
        leaderSelect.innerHTML = '<option value="">Gagal memuat leader</option>';
        leaderSelect.disabled = true;
        const editLeaderSelect = document.getElementById('editTaskLeader');
        if (editLeaderSelect) {
            editLeaderSelect.innerHTML = '<option value="">Gagal memuat leader</option>';
            editLeaderSelect.disabled = true;
        }
    }
}

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

async function fetchLeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        console.error('Token tidak ditemukan.');
        return null;
    }
    try {
        const response = await fetch('http://localhost:8080/leader/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.status === 401 || response.status === 403) {
            console.error('Otentikasi gagal untuk fetchLeaders');
            return null;
        }
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data.leaders;
    } catch (error) {
        console.error('Gagal mengambil data leader:', error);
        return null;
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
        const response = await fetch(API_URL, {
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
        if (taskStatus === 'in progress' || taskStatus === 'approved by leader') {
            actionButtonEdit = `
                <a href="#" class="action-icon text-success me-2 action-update"
                   data-task-id="${task.id}"
                   title="Update Progress">
                    <i class="bi bi-pencil-square fs-5"></i>
                </a>`;
        } else if (taskStatus === 'revision') {
            actionButtonEdit = `
                <a href="#" class="action-icon text-warning me-2 action-edit"
                   data-task-id="${task.id}"
                   title="Revisi & Submit Ulang Tugas">
                    <i class="bi bi-pencil-fill fs-5"></i>
                </a>`;
        } else {
            actionButtonEdit = `
                <a href="#" class="action-icon text-muted me-2"
                   style="cursor: not-allowed;"
                   title="Tidak dapat di-edit (Status: ${task.status})">
                    <i class="bi bi-pencil-square fs-5"></i>
                </a>`;
        }

        let actionButtonDelete = '';
        if (taskStatus === 'submitted' || taskStatus === 'revision') {
            actionButtonDelete = `
                <a href="#" class="action-icon text-danger action-delete"
                   data-task-id="${task.id}"
                   title="Hapus Tugas">
                    <i class="bi bi-trash-fill fs-5"></i>
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
                ${actionButtonDelete}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function populateLeaderDropdown(leaders) {
    const addLeaderSelect = document.getElementById('taskLeader');
    const editLeaderSelect = document.getElementById('editTaskLeader');

    addLeaderSelect.innerHTML = '<option value="" selected disabled>Pilih Leader...</option>';
    if (editLeaderSelect) editLeaderSelect.innerHTML = '<option value="" selected disabled>Pilih Leader...</option>';

    if (leaders && leaders.length > 0) {
        leaders.forEach(leader => {
            const option = document.createElement('option');
            option.value = leader.id;
            option.textContent = `${leader.username} (${leader.Role})`;

            addLeaderSelect.appendChild(option.cloneNode(true));
            if (editLeaderSelect) editLeaderSelect.appendChild(option);
        });

        addLeaderSelect.disabled = false;
        if (editLeaderSelect) editLeaderSelect.disabled = false;
    } else {
        addLeaderSelect.innerHTML = '<option value="">Tidak ada leader</option>';
        addLeaderSelect.disabled = true;
        if (editLeaderSelect) {
            editLeaderSelect.innerHTML = '<option value="">Tidak ada leader</option>';
            editLeaderSelect.disabled = true;
        }
    }
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

    const deleteModalEl = document.getElementById('deleteConfirmModal');
    const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;

    const editModalEl = document.getElementById('editTaskModal');
    const editModal = editModalEl ? new bootstrap.Modal(editModalEl) : null;

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
            } catch (e) {
                document.getElementById('editTaskDeadline').value = ''; // Handle potential date errors
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

async function handleAddTask(event) {
    event.preventDefault();
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const assignee_id = parseInt(document.getElementById('taskLeader').value, 10);
    const deadlineInput = document.getElementById('taskDeadline').value;

    if (!title || !assignee_id || !deadlineInput) {
        Swal.fire('Oops...', 'Judul, Leader, dan Deadline wajib diisi!', 'warning');
        return;
    }

    const due_date = `${deadlineInput} 00:00:00.000`;

    const requestBody = { title, description, assignee_id, due_date };
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
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Gagal menyimpan tugas. Status: ${response.status}`);
        }

        const addTaskModalEl = document.getElementById('addTaskModal');
        const addTaskModal = bootstrap.Modal.getInstance(addTaskModalEl);
        if (addTaskModal) addTaskModal.hide();

        Swal.fire({
            title: 'Berhasil!',
            text: 'Tugas baru berhasil ditambahkan!',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        document.getElementById('addTaskForm').reset();
        loadAndRenderTasks();
    } catch (error) {
        console.error('Error saat menambah tugas:', error);
        Swal.fire({
            title: 'Gagal!',
            text: `Gagal menyimpan tugas: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

async function handleEditTask(event) {
    event.preventDefault();
    const taskId = document.getElementById('editTaskId').value;
    if (!taskId) {
        Swal.fire('Error', 'ID Tugas tidak ditemukan!', 'error');
        return;
    }
    const title = document.getElementById('editTaskTitle').value;
    const description = document.getElementById('editTaskDescription').value;
    const assignee_id = parseInt(document.getElementById('editTaskLeader').value, 10);
    const deadlineInput = document.getElementById('editTaskDeadline').value;
    if (!title || !assignee_id || !deadlineInput) {
        Swal.fire('Oops...', 'Judul, Leader, dan Deadline wajib diisi!', 'warning');
        return;
    }
    const due_date = `${deadlineInput} 23:59:59.000`;
    const requestBody = { title, description, assignee_id, due_date };
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
    try {
        const response = await fetch(`${API_URL}${taskId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Gagal menyimpan revisi. Status: ${response.status}`);
        }

        const editModalEl = document.getElementById('editTaskModal');
        const editModal = bootstrap.Modal.getInstance(editModalEl);
        if (editModal) editModal.hide();

        Swal.fire({
            title: 'Berhasil!',
            text: 'Tugas berhasil direvisi dan disubmit ulang!',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        document.getElementById('editTaskForm').reset();
        loadAndRenderTasks();
    } catch (error) {
        console.error('Error saat revisi tugas:', error);
        Swal.fire({
            title: 'Gagal!',
            text: `Gagal menyimpan revisi: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}
async function handleDeleteTask() {
    const taskId = document.getElementById('deleteTaskId').value;
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
    try {
        const response = await fetch(`${API_URL}${taskId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Gagal menghapus tugas. Status: ${response.status}`);
        }

        const deleteModalEl = document.getElementById('deleteConfirmModal');
        const deleteModal = bootstrap.Modal.getInstance(deleteModalEl);
        if (deleteModal) deleteModal.hide();

        Swal.fire({
            title: 'Berhasil!',
            text: 'Tugas berhasil dihapus!',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        loadAndRenderTasks();
    } catch (error) {
        console.error('Error saat menghapus tugas:', error);
        Swal.fire({
            title: 'Gagal!',
            text: `Gagal menghapus tugas: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}
async function handleUpdateProgress(event) {
    event.preventDefault();
    const taskId = document.getElementById('updateTaskId').value;
    const progress = parseInt(document.getElementById('progressInput').value, 10);
    if (!taskId) {
        Swal.fire('Error', 'ID Tugas tidak ditemukan!', 'error');
        return;
    }
    const requestBody = { progress };
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
    try {
        const response = await fetch(`${API_URL}${taskId}/progress`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Gagal update progress. Status: ${response.status}`);
        }

        const updateModalEl = document.getElementById('updateProgressModal');
        const updateModal = bootstrap.Modal.getInstance(updateModalEl);
        if (updateModal) updateModal.hide();

        Swal.fire({
            title: 'Berhasil!',
            text: 'Progress berhasil diperbarui!',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        loadAndRenderTasks();
    } catch (error) {
        console.error('Error saat update progress:', error);
        Swal.fire({
            title: 'Gagal!',
            text: `Gagal update progress: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}