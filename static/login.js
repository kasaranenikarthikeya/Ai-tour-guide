let loggedIn = false;

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        loggedIn = true;
        favorites = data.favorites;
        localStorage.setItem('favorites', JSON.stringify(favorites));
        window.location.href = '/';
    })
    .catch(alert);
}

function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        login();
    })
    .catch(alert);
}

function syncFavorites() {
    if (loggedIn) {
        fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorites })
        });
    }
}

// Update toggleFavorite to sync
function toggleFavorite(name, state) {
    const index = favorites.findIndex(f => f.name === name && f.state === state);
    if (index === -1) favorites.push({ name, state });
    else favorites.splice(index, 1);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    syncFavorites();
    updateFavoriteButtons(name, state);
    if (window.location.pathname === '/favorites') renderFavorites();
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Add to DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Existing code...
    if (sessionStorage.getItem('loggedIn')) loggedIn = true;
});