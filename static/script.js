let states = [];
let navbarTimeout;
let isNavbarTranslateInitialized = false;
let isAddingFavorite = false;

function toggleNavbar() {
    const navbar = document.querySelector('.navbar');
    const toggleBtn = document.querySelector('.navbar-toggle-btn');
    navbar.classList.toggle('open');
    toggleBtn.classList.toggle('active');
    clearTimeout(navbarTimeout);
    if (navbar.classList.contains('open')) {
        navbarTimeout = setTimeout(() => {
            navbar.classList.remove('open');
            toggleBtn.classList.remove('active');
        }, 5000);
        const firstNavItem = navbar.querySelector('.nav-item a');
        if (firstNavItem) firstNavItem.focus();
    } else {
        toggleBtn.focus();
    }
}

function closeNavbar() {
    const navbar = document.querySelector('.navbar');
    const toggleBtn = document.querySelector('.navbar-toggle-btn');
    navbar.classList.remove('open');
    toggleBtn.classList.remove('active');
    clearTimeout(navbarTimeout);
}

function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    const darkModeItem = document.querySelector('#toolsDropdown ~ .dropdown-menu .dropdown-item:first-child');
    if (darkModeItem) {
        darkModeItem.innerHTML = `${isDarkMode ? 'Light Mode' : 'Dark Mode'} <i class="fas fa-${isDarkMode ? 'sun' : 'moon'}"></i>`;
    }
}

function showLoadingSpinner(event) {
    const spinner = document.getElementById('loading-spinner');
    if (!spinner) return;

    spinner.classList.remove('hidden');
    console.log('Spinner shown');

    const spinnerText = spinner.querySelector('.spinner-text');
    if (spinnerText) {
        let dots = 0;
        spinnerText.dataset.interval = setInterval(() => {
            dots = (dots + 1) % 4;
            spinnerText.textContent = 'Processing' + '.'.repeat(dots);
        }, 300);
    }

    spinner.onclick = () => {
        spinner.classList.add('clicked');
        setTimeout(() => spinner.classList.remove('clicked'), 200);
        console.log('Spinner clicked!');
    };
}

function hideLoadingSpinner(minDuration = 500) {
    const spinner = document.getElementById('loading-spinner');
    if (!spinner) return Promise.resolve();

    const spinnerText = spinner.querySelector('.spinner-text');
    if (spinnerText && spinnerText.dataset.interval) {
        clearInterval(spinnerText.dataset.interval);
        delete spinnerText.dataset.interval;
    }

    const startTime = Date.now();
    return new Promise(resolve => {
        setTimeout(() => {
            spinner.classList.add('hidden');
            spinner.onclick = null;
            console.log('Spinner hidden on path:', window.location.pathname);
            resolve();
        }, Math.max(0, minDuration - (Date.now() - startTime)));
    });
}

function fetchStates() {
    showLoadingSpinner();
    fetch('/api/states', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
        .then(response => response.ok ? response.json() : Promise.reject('Failed to fetch states'))
        .then(data => {
            states = Array.isArray(data.states) ? data.states : [];
            setupAutocomplete();
            hideLoadingSpinner();
        })
        .catch(error => {
            console.error('Error fetching states:', error);
            const suggestionBox = document.getElementById('suggestions-container');
            if (suggestionBox) {
                suggestionBox.innerHTML = '<div class="suggestion-item">Error loading states</div>';
                suggestionBox.classList.remove('hidden');
            }
            hideLoadingSpinner();
        });
}

function setupAutocomplete() {
    const input = document.getElementById('state-input');
    const suggestionBox = document.getElementById('suggestions-container');
    if (!input || !suggestionBox) return;

    let focusedSuggestion = -1;

    input.addEventListener('input', function() {
        const value = this.value.trim().toLowerCase();
        suggestionBox.innerHTML = '';
        focusedSuggestion = -1;
        if (!value) {
            suggestionBox.classList.add('hidden');
            return;
        }

        const matches = states.filter(state => state.toLowerCase().startsWith(value));
        if (matches.length > 0) {
            matches.forEach((match, index) => {
                const suggestion = document.createElement('div');
                suggestion.textContent = match;
                suggestion.className = 'suggestion-item';
                suggestion.tabIndex = 0;
                suggestion.addEventListener('click', () => {
                    input.value = match;
                    suggestionBox.classList.add('hidden');
                    searchPlaces();
                });
                suggestionBox.appendChild(suggestion);
            });
            suggestionBox.classList.remove('hidden');
        } else {
            suggestionBox.classList.add('hidden');
        }
    });

    input.addEventListener('keydown', (e) => {
        const suggestions = suggestionBox.querySelectorAll('.suggestion-item');
        if (suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusedSuggestion = Math.min(focusedSuggestion + 1, suggestions.length - 1);
            suggestions[focusedSuggestion].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusedSuggestion = Math.max(focusedSuggestion - 1, -1);
            if (focusedSuggestion === -1) input.focus();
            else suggestions[focusedSuggestion].focus();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedSuggestion >= 0) {
                input.value = suggestions[focusedSuggestion].textContent;
                suggestionBox.classList.add('hidden');
            }
            searchPlaces();
        }
    });

    document.addEventListener('click', (e) => {
        if (!suggestionBox.contains(e.target) && e.target !== input) {
            suggestionBox.classList.add('hidden');
        }
    });
}

function searchPlaces() {
    const stateInput = document.getElementById('state-input');
    const category = document.getElementById('category-select');
    if (!stateInput || !category) return;

    const state = stateInput.value.trim();
    const categoryValue = category.value;
    if (!state) {
        console.log('No state entered, skipping search');
        return;
    }
    showLoadingSpinner();
    window.location.href = `/places/${encodeURIComponent(state)}?category=${encodeURIComponent(categoryValue)}`;
}

function toggleStateDropdown() {
    const categorySelect = document.getElementById('category-select');
    const stateSelect = document.getElementById('state-select');
    const placesContainer = document.getElementById('places-container');
    
    if (categorySelect.value) {
        stateSelect.classList.remove('hidden');
        placesContainer.innerHTML = '';
    } else {
        stateSelect.classList.add('hidden');
        placesContainer.innerHTML = '';
    }
}

function fetchPlaces() {
    const category = document.getElementById('category-select').value;
    const state = document.getElementById('state-select').value;
    const placesContainer = document.getElementById('places-container');

    if (!state || !category || !placesContainer) {
        console.error('Missing required elements for fetchPlaces');
        return;
    }

    showLoadingSpinner();
    placesContainer.classList.add('hidden');

    fetch('/api/favorites/list', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
        .then(response => response.json())
        .then(favoritesData => {
            const favorites = favoritesData.favorites || [];
            return fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: state, category: category })
            })
            .then(response => response.ok ? response.json() : Promise.reject('Failed to fetch places'))
            .then(data => {
                console.log('Fetch places response:', data);
                placesContainer.innerHTML = '';
                if (!data.places || data.places.length === 0) {
                    placesContainer.innerHTML = '<p>No places found.</p>';
                } else {
                    data.places.forEach(place => {
                        const isFavorited = favorites.some(fav => 
                            fav.place_name === place.name && fav.state === state
                        );
                        const card = document.createElement('div');
                        card.className = 'card';
                        card.dataset.category = place.category;
                        card.innerHTML = `
                            <h3>${place.name}</h3>
                            <p class="category-tag">${place.category}</p>
                            <button class="details-btn" data-name="${place.name}" data-category="${place.category}" data-state="${state}" tabIndex="0"><i class="fas fa-info-circle"></i> Details</button>
                            <button class="favorite-btn" data-name="${place.name}" data-state="${state}" data-category="${place.category}" tabIndex="0" ${isFavorited ? 'disabled' : ''}>
                                <i class="fas fa-heart"></i> ${isFavorited ? 'Favorited' : 'Favorite'}
                            </button>
                        `;
                        if (isFavorited) card.querySelector('.favorite-btn').classList.add('favorited');
                        placesContainer.appendChild(card);
                    });
                }
                placesContainer.classList.remove('hidden');
                hideLoadingSpinner();
            });
        })
        .catch(error => {
            console.error('Error fetching places or favorites:', error);
            placesContainer.innerHTML = '<p class="error-message">Failed to load places. Please try again.</p>';
            placesContainer.classList.remove('hidden');
            hideLoadingSpinner();
        });
}

function filterPlaces(state) {
    const category = document.getElementById('category-filter')?.value;
    const placesContainer = document.getElementById('places-container');

    if (!placesContainer) {
        console.error('Places container not found in DOM');
        return;
    }
    if (!state || !category) {
        console.warn('Missing state or category for filtering');
        placesContainer.innerHTML = '<p>Please select a state and category.</p>';
        return;
    }

    showLoadingSpinner();
    placesContainer.classList.add('hidden');

    fetch('/api/favorites/list', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
        .then(response => response.ok ? response.json() : Promise.reject('Failed to fetch favorites'))
        .then(favoritesData => {
            const favorites = favoritesData.favorites || [];
            return fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: state, category: category })
            })
            .then(response => response.ok ? response.json() : Promise.reject('Failed to fetch places'))
            .then(data => {
                console.log('Filter places response:', data);
                placesContainer.innerHTML = '';
                if (!data.places || data.places.length === 0) {
                    placesContainer.innerHTML = '<p>No places found for this filter.</p>';
                } else {
                    data.places.forEach(place => {
                        const isFavorited = favorites.some(fav => 
                            fav.place_name === place.name && fav.state === state
                        );
                        const card = document.createElement('div');
                        card.className = 'card';
                        card.dataset.category = place.category;
                        card.innerHTML = `
                            <h3>${place.name}</h3>
                            <p class="category-tag">${place.category}</p>
                            <button class="details-btn" data-name="${place.name}" data-category="${place.category}" data-state="${state}" tabIndex="0"><i class="fas fa-info-circle"></i> Details</button>
                            <button class="favorite-btn" data-name="${place.name}" data-state="${state}" data-category="${place.category}" tabIndex="0" ${isFavorited ? 'disabled' : ''}>
                                <i class="fas fa-heart"></i> ${isFavorited ? 'Favorited' : 'Favorite'}
                            </button>
                        `;
                        if (isFavorited) card.querySelector('.favorite-btn').classList.add('favorited');
                        placesContainer.appendChild(card);
                    });
                }
                placesContainer.classList.remove('hidden');
                initializeFavoriteButtons(); // Ensure favorite states are updated
                hideLoadingSpinner();
            });
        })
        .catch(error => {
            console.error('Error filtering places or fetching favorites:', error);
            placesContainer.innerHTML = '<p class="error-message">Failed to load places. Please try again.</p>';
            placesContainer.classList.remove('hidden');
            hideLoadingSpinner();
        });
}

function openPlaceModal(name, category, state) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const description = document.getElementById('modal-description');
    const mapsButton = document.getElementById('modal-maps');
    const favoriteButton = document.getElementById('modal-favorite');

    if (!modal || !title || !description || !mapsButton || !favoriteButton) {
        console.error('Modal elements missing');
        return;
    }

    title.textContent = name;
    description.textContent = `Category: ${category} | State: ${state}`;
    mapsButton.onclick = () => viewOnGoogleMaps(name, state);
    favoriteButton.dataset.name = name;
    favoriteButton.dataset.state = state;
    favoriteButton.dataset.category = category;
    favoriteButton.innerHTML = '<i class="fas fa-heart"></i> Add to Favorites';

    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.classList.add('hidden');
}

function toggleFavorite(name, state, category, event) {
    if (!name || !state || !category) {
        console.error('Missing required fields:', { name, state, category });
        return;
    }
    const button = document.querySelector(`.favorite-btn[data-name="${name}"][data-state="${state}"]`);
    if (button && button.disabled) {
        console.log('Place already favorited, skipping...');
        return;
    }
    if (isAddingFavorite) {
        console.log('Already adding a favorite, skipping duplicate request...');
        return;
    }
    isAddingFavorite = true;
    showLoadingSpinner(event);
    fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: state, place_name: name, category: category })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            console.log('Favorite added:', { name, state, category });
            updateFavoriteButtons(name, state, true);
            if (window.location.pathname === '/favorites') {
                updateFavoritesList(name, state, category, data.id);
            }
        } else {
            throw new Error(data.error || 'Failed to add favorite');
        }
    })
    .catch(error => {
        console.error('Error adding favorite:', error);
    })
    .finally(() => {
        hideLoadingSpinner(500).then(() => {
            isAddingFavorite = false;
        });
    });
}

function toggleFavoriteFromModal(event) {
    const favoriteButton = document.getElementById('modal-favorite');
    const name = favoriteButton.dataset.name;
    const state = favoriteButton.dataset.state;
    const category = favoriteButton.dataset.category;
    toggleFavorite(name, state, category, event);
    closeModal();
}

function updateFavoriteButtons(name, state, isFavorited) {
    const buttons = document.querySelectorAll(`.favorite-btn[data-name="${name}"][data-state="${state}"]`);
    buttons.forEach(btn => {
        btn.innerHTML = `<i class="fas fa-heart"></i> ${isFavorited ? 'Favorited' : 'Favorite'}`;
        btn.disabled = isFavorited;
        btn.classList.toggle('favorited', isFavorited);
    });
}

function initializeFavoriteButtons() {
    fetch('/api/favorites/list', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('Favorites list endpoint not found. Assuming no favorites yet.');
                return { favorites: [] };
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.favorites) {
            data.favorites.forEach(fav => {
                updateFavoriteButtons(fav.place_name, fav.state, true);
            });
        }
    })
    .catch(error => {
        console.error('Error fetching favorites:', error);
    });
}

function updateFavoritesList(name, state, category, id) {
    const container = document.getElementById('favorites-container');
    if (!container || container.querySelector('.no-favorites')) {
        container.innerHTML = '';
    }
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = id;
    card.dataset.name = name;
    card.dataset.state = state;
    card.dataset.category = category;
    card.innerHTML = `
        <div class="card-header">
            <h3>${name}</h3>
            <button class="delete-btn" tabindex="0">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="card-body">
            <p><strong>State:</strong> ${state}</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Added:</strong> ${new Date().toISOString().split('T')[0]}</p>
        </div>
        <div class="card-footer">
            <button class="details-btn" tabindex="0">
                <i class="fas fa-info-circle"></i> Details
            </button>
            <button class="maps-btn" tabindex="0">
                <i class="fas fa-map-marker-alt"></i> View on Maps
            </button>
        </div>
    `;
    container.insertBefore(card, container.firstChild);
}

function openGoogleMaps(place) {
    const query = encodeURIComponent(place);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
}

function toggleTranslate() {
    const navbarTranslateContainer = document.querySelector('.navbar-translate-container');
    if (!navbarTranslateContainer.classList.contains('active') && !isNavbarTranslateInitialized) {
        new google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'en,es,fr,de,it,ar,te,hi',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false
        }, 'navbar_translate_element');
        isNavbarTranslateInitialized = true;
    }
    navbarTranslateContainer.classList.toggle('active');
}

function setupCardNavigation(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.addEventListener('keydown', (e) => {
        const cards = Array.from(container.querySelectorAll('.card'));
        if (cards.length === 0) return;

        const focusedElement = document.activeElement;
        const currentCard = focusedElement.closest('.card');
        if (!currentCard) return;

        const cardIndex = cards.indexOf(currentCard);
        const buttons = Array.from(currentCard.querySelectorAll('button'));
        const buttonIndex = buttons.indexOf(focusedElement);

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cardIndex > 0) {
                cards[cardIndex - 1].querySelector('button').focus();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (cardIndex < cards.length - 1) {
                cards[cardIndex + 1].querySelector('button').focus();
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (buttonIndex > 0) {
                buttons[buttonIndex - 1].focus();
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (buttonIndex < buttons.length - 1) {
                buttons[buttonIndex + 1].focus();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedElement.classList.contains('details-btn')) {
                const name = focusedElement.dataset.name;
                const category = focusedElement.dataset.category;
                const state = focusedElement.dataset.state;
                openPlaceModal(name, category, state);
            } else if (focusedElement.classList.contains('favorite-btn')) {
                const name = focusedElement.dataset.name;
                const state = focusedElement.dataset.state;
                const category = focusedElement.dataset.category;
                toggleFavorite(name, state, category, e);
            } else if (focusedElement.classList.contains('delete-btn')) {
                const id = focusedElement.closest('.card').dataset.id;
                deleteFavorite(id, e);
            } else if (focusedElement.tagName === 'A' && window.location.pathname === '/states') {
                window.location.href = focusedElement.href;
            }
        }
    });
}

function setupDropdownNavigation() {
    const categorySelect = document.getElementById('category-select');
    const stateSelect = document.getElementById('state-select');
    if (!categorySelect || !stateSelect) return;

    categorySelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            toggleStateDropdown();
            stateSelect.focus();
        }
    });

    stateSelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchPlaces();
        }
    });
}

function deleteFavorite(id, event) {
    console.log('deleteFavorite called with id:', id);
    showLoadingSpinner(event);
    fetch(`/api/favorites/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (!response.ok && response.status !== 404) {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to delete favorite');
            });
        }
        return response.json().catch(() => ({}));
    })
    .then(data => {
        console.log('Favorite removed or already gone:', id);
        const card = document.querySelector(`.card[data-id="${id}"]`);
        if (card) {
            const name = card.dataset.name;
            const state = card.dataset.state;
            card.remove();
            updateFavoriteButtons(name, state, false);
        }
        if (!document.querySelector('.card') && window.location.pathname === '/favorites') {
            const container = document.getElementById('favorites-container');
            if (container) {
                container.innerHTML = '<p class="no-favorites">No favorites saved yet. Start adding some from the <a href="/states">States</a> or <a href="/categories">Categories</a> pages!</p>';
            }
        }
    })
    .catch(error => {
        console.error('Error deleting favorite:', error);
    })
    .finally(() => {
        hideLoadingSpinner(500);
    });
}

function viewOnGoogleMaps(place, state) {
    if (!place || !state) return;
    const query = encodeURIComponent(`${place}, ${state}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
}

function viewOnGoogleMapsFromModal() {
    const name = document.getElementById('modal-title').textContent;
    const stateMatch = document.getElementById('modal-description').textContent.match(/State: (.+)/);
    const state = stateMatch ? stateMatch[1] : '';
    if (name && state) viewOnGoogleMaps(name, state);
}

document.addEventListener('DOMContentLoaded', () => {
    hideLoadingSpinner();

    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        fetchStates();
    }

    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        const darkModeItem = document.querySelector('#toolsDropdown ~ .dropdown-menu .dropdown-item:first-child');
        if (darkModeItem) {
            darkModeItem.innerHTML = 'Light Mode <i class="fas fa-sun"></i>';
        }
    }

    setupCardNavigation('#places-container');
    setupCardNavigation('#favorites-container');
    setupCardNavigation('.card-container');

    if (window.location.pathname === '/categories') {
        setupDropdownNavigation();
    }

    if (window.location.pathname.startsWith('/places') || window.location.pathname === '/categories' || window.location.pathname === '/favorites') {
        initializeFavoriteButtons();
    }

    const cardContainers = document.querySelectorAll('.card-container');
    cardContainers.forEach(container => {
        container.addEventListener('click', (e) => {
            const detailsBtn = e.target.closest('.details-btn');
            const favoriteBtn = e.target.closest('.favorite-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const mapsBtn = e.target.closest('.maps-btn');

            if (detailsBtn) {
                const name = detailsBtn.dataset.name;
                const category = detailsBtn.dataset.category;
                const state = detailsBtn.dataset.state;
                openPlaceModal(name, category, state);
            }

            if (favoriteBtn) {
                const name = favoriteBtn.dataset.name;
                const state = favoriteBtn.dataset.state;
                const category = favoriteBtn.dataset.category;
                toggleFavorite(name, state, category, e);
                e.stopPropagation();
            }

            if (deleteBtn) {
                const id = deleteBtn.closest('.card').dataset.id;
                if (id) deleteFavorite(id, e);
            }

            if (mapsBtn) {
                const card = mapsBtn.closest('.card');
                const name = card.dataset.name;
                const state = card.dataset.state;
                viewOnGoogleMaps(name, state);
            }
        });
    });

    setTimeout(() => {
        if (typeof google !== 'undefined' && google.translate) {
            new google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: 'en,es,fr,de,it,ar,te,hi',
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                autoDisplay: false
            }, 'google_translate_element');
        }
    }, 500);

    document.addEventListener('click', (e) => {
        const navbar = document.querySelector('.navbar');
        const toggleBtn = document.querySelector('.navbar-toggle-btn');
        if (!navbar.contains(e.target) && !toggleBtn.contains(e.target) && navbar.classList.contains('open')) {
            closeNavbar();
        }

        const navbarTranslateContainer = document.querySelector('.navbar-translate-container');
        const translateBtn = document.querySelector('.translate-toggle');
        if (navbarTranslateContainer && translateBtn) {
            if (!navbarTranslateContainer.contains(e.target) && !translateBtn.contains(e.target) && navbarTranslateContainer.classList.contains('active')) {
                navbarTranslateContainer.classList.remove('active');
            }
        }
    });

    const modalFavorite = document.getElementById('modal-favorite');
    const modalMaps = document.getElementById('modal-maps');
    const closeModalBtn = document.querySelector('.close-modal');
    
    if (modalFavorite && !modalFavorite.dataset.listenerAdded) {
        modalFavorite.addEventListener('click', (e) => {
            toggleFavoriteFromModal(e);
            e.stopPropagation();
        });
        modalFavorite.dataset.listenerAdded = 'true';
    }
    if (modalMaps && !modalMaps.dataset.listenerAdded) {
        modalMaps.addEventListener('click', viewOnGoogleMapsFromModal);
        modalMaps.dataset.listenerAdded = 'true';
    }
    if (closeModalBtn && !closeModalBtn.dataset.listenerAdded) {
        closeModalBtn.addEventListener('click', closeModal);
        closeModalBtn.dataset.listenerAdded = 'true';
    }
});