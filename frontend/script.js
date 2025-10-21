const apiUrl = 'http://localhost:8080/auth/login';

const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async function (event) {

    event.preventDefault();

    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;

    const loginData = {
        username: username,
        password: password
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error: ${response.status}`);
        }

        const data = await response.json();
        

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userRole', data.role);

        if (data.role === 'manager') {
            window.location.href = './manager/dashboard.html';
        } else if (data.role === 'pelaksana') {
            window.location.href = './pelaksana/dashboard.html';
        } else if (data.role === 'leader') {
            window.location.href = './leader/dashboard.html';
        }

    } catch (error) {
        console.error('Gagal melakukan login:', error.message);

        Swal.fire({
            title: 'Login Gagal!',
            text: error.message, 
            icon: 'error',
            confirmButtonText: 'Coba Lagi'
        });
    }
});