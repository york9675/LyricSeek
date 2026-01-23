const API_URL = "https://lrclib.net/api";

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');
const statusContainer = document.getElementById('status-container');
const statusText = document.getElementById('status-text');
const header = document.getElementById('app-header');
const themeToggle = document.getElementById('theme-toggle');
const toggleAdvancedBtn = document.getElementById('toggle-advanced');
const advancedSearchContainer = document.getElementById('advanced-search-container');
const advTrack = document.getElementById('adv-track');
const advArtist = document.getElementById('adv-artist');
const advAlbum = document.getElementById('adv-album');
const advId = document.getElementById('adv-id');

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    handleInitialLoad();
});

// --- Advanced Search Toggle ---
toggleAdvancedBtn.addEventListener('click', () => {
    const isHidden = advancedSearchContainer.classList.contains('hidden');
    
    if (isHidden) {
        // Show Advanced
        advancedSearchContainer.classList.remove('hidden');
        toggleAdvancedBtn.classList.add('active');
        searchInput.value = '';
        searchInput.disabled = true;
        searchInput.placeholder = "Using advanced search...";
        advTrack.focus();
    } else {
        // Hide Advanced
        advancedSearchContainer.classList.add('hidden');
        toggleAdvancedBtn.classList.remove('active');
        searchInput.disabled = false;
        searchInput.placeholder = "Song title, artist, or album...";
        searchInput.focus();
    }
});

// Modal Elements
const modal = document.getElementById('lyrics-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalTitle = document.getElementById('modal-title');
const modalArtist = document.getElementById('modal-artist');
const modalAlbum = document.getElementById('modal-album');
const modalId = document.getElementById('modal-id');
const lyricsDisplay = document.getElementById('lyrics-display');
const btnViewPlain = document.getElementById('btn-view-plain');
const btnViewSynced = document.getElementById('btn-view-synced');

// Footer Buttons
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');
const downloadText = document.getElementById('download-text');

let currentLyrics = { plain: "", synced: "" };
let currentView = "plain";
let currentTrackInfo = {};

// --- Year ---
document.getElementById('year').innerText = new Date().getFullYear();

// --- Theme ---
function applyTheme(theme) {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    themeToggle.innerHTML = `<span class="material-icons-round">${theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>`;
}

function getPreferredTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initTheme() {
    applyTheme(getPreferredTheme());
}

themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
});

// --- Search ---
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = searchInput.value.trim();
    const isAdvanced = !advancedSearchContainer.classList.contains('hidden');
    
    let searchUrl = `${API_URL}/search?`;
    let hasSearchCriteria = false;
    let newUrlParams = new URLSearchParams();

    if (isAdvanced) {
        const t = advTrack.value.trim();
        const a = advArtist.value.trim();
        const al = advAlbum.value.trim();
        const i = advId.value.trim();

        if (i) {
            // ID Search Logic

            // If ID is provided, it typically overrides other params or is exclusive
            // Use the ID fetcher directly
            await fetchAndOpenLyricsById(i);
            
            // Update URL without reloading
            const p = new URLSearchParams();
            p.set('id', i);
            const newUrl = `${window.location.pathname}?${p.toString()}`;
            window.history.pushState({}, '', newUrl);
            return; 
        }

        if (t) {
            const params = new URLSearchParams();
            params.append('track_name', t);
            if (a) params.append('artist_name', a);
            if (al) params.append('album_name', al);
            searchUrl += params.toString();
            // Store params for URL state
            newUrlParams = params;
            hasSearchCriteria = true;
        } else {
            // Fallback to 'q' if track_name is missing, combining all terms
            let combined = [query, t, a, al].filter(Boolean).join(' ');
            if (combined) {
                searchUrl += `q=${encodeURIComponent(combined)}`;
                newUrlParams.set('q', combined);
                hasSearchCriteria = true;
            }
        }
    } else {
        if (query) {
            searchUrl += `q=${encodeURIComponent(query)}`;
            newUrlParams.set('q', query);
            hasSearchCriteria = true;
        }
    }

    if (!hasSearchCriteria) return;

    // Update Browser URL
    const newUrl = `${window.location.pathname}?${newUrlParams.toString()}`;
    window.history.pushState({}, '', newUrl);

    header.classList.add('active');
    resultsContainer.innerHTML = '';
    statusContainer.classList.remove('hidden');
    statusText.innerText = "Searching for lyrics...";

    const slowTimer = setTimeout(() => {
        statusText.innerText = "Still searching... this might take a while.";
    }, 3575);

    try {
        const response = await fetch(searchUrl);
        clearTimeout(slowTimer);

        if (!response.ok) throw new Error('Network error');
        
        const data = await response.json();
        statusContainer.classList.add('hidden');

        if (data.length === 0) {
            resultsContainer.innerHTML = `<div style="text-align:center; opacity:0.7;">No lyrics found for "${query}"</div>`;
            return;
        }
        renderResults(data);
    } catch (error) {
        clearTimeout(slowTimer);
        console.error(error);
        statusText.innerText = "Error fetching data.";
        document.querySelector('.loader').classList.add('hidden');
    }
}

function renderResults(tracks) {
    tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'card';
        
        const minutes = Math.floor(track.duration / 60);
        const seconds = Math.floor(track.duration % 60).toString().padStart(2, '0');

        let badgesHtml = '<div class="badge-container">';
        if (track.instrumental) badgesHtml += '<span class="badge instrumental">Instrumental</span>';
        if (track.syncedLyrics) badgesHtml += '<span class="badge synced">Synced</span>';
        if (track.plainLyrics) badgesHtml += '<span class="badge plain">Plain</span>';
        badgesHtml += '</div>';

        card.innerHTML = `
            <div class="card-info">
                <h3>${track.trackName}</h3>
                <span class="artist">${track.artistName}</span>
                <span class="album">${track.albumName}</span>
            </div>
            <div class="card-meta">
                ${badgesHtml}
                <span class="duration">${minutes}:${seconds}</span>
            </div>
        `;

        card.addEventListener('click', () => openLyrics(track));
        resultsContainer.appendChild(card);
    });

    const note = document.createElement('div');
    note.className = 'search-note';
    note.innerHTML = "Didn't find what you are looking for? Try different terms (results limited to 20).";
    resultsContainer.appendChild(note);
}

// --- Lyrics View ---
async function openLyrics(track) {
    currentTrackInfo = track;
    modalTitle.innerText = track.trackName;
    modalArtist.innerText = track.artistName;
    modalAlbum.innerText = track.albumName || "Unknown Album";
    modalId.innerText = "ID: " + track.id;
    lyricsDisplay.innerText = "Loading lyrics...";
    modal.classList.remove('hidden');

    if (track.instrumental && !track.plainLyrics && !track.syncedLyrics) {
        currentLyrics.plain = "No lyrics available (instrumental track).";
        currentLyrics.synced = null;
        switchView('plain');
        return;
    }
    
    // Fetch details if needed
    if(!track.plainLyrics && !track.syncedLyrics) {
        try {
            const res = await fetch(`${API_URL}/get/${track.id}`);
            const data = await res.json();
            track = data;
            currentTrackInfo = data;
        } catch(e) {
            lyricsDisplay.innerText = "Error loading specific lyrics.";
            return;
        }
    }

    currentLyrics.plain = track.plainLyrics || "No plain text lyrics available.";
    currentLyrics.synced = track.syncedLyrics || null;

    // Reset view to plain
    switchView('plain');
}

function switchView(type) {
    currentView = type;
    
    // Update Button States
    if (type === 'plain') {
        btnViewPlain.classList.add('active');
        btnViewSynced.classList.remove('active');
        lyricsDisplay.innerText = currentLyrics.plain;
        
        // Update Download Button
        downloadText.innerText = "Download";
        btnDownload.disabled = !currentLyrics.plain;
        
    } else {
        btnViewPlain.classList.remove('active');
        btnViewSynced.classList.add('active');
        lyricsDisplay.innerText = currentLyrics.synced ? currentLyrics.synced : "Synced lyrics not available for this track.";
        
        // Update Download Button
        downloadText.innerText = "Download";
        btnDownload.disabled = !currentLyrics.synced;
    }
}

// --- Actions ---
btnViewPlain.addEventListener('click', () => switchView('plain'));
btnViewSynced.addEventListener('click', () => switchView('synced'));

closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
});

// Copy
btnCopy.addEventListener('click', () => {
    const text = currentView === 'plain' ? currentLyrics.plain : (currentLyrics.synced || "");
    if(!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
        const originalHtml = btnCopy.innerHTML;
        btnCopy.innerHTML = `<span class="material-icons-round">check</span> Copied`;
        setTimeout(() => btnCopy.innerHTML = originalHtml, 2000);
    });
});

// Download Logic
btnDownload.addEventListener('click', () => {
    let content = "";
    let ext = "";

    if (currentView === 'plain') {
        content = currentLyrics.plain;
        ext = 'txt';
    } else {
        content = currentLyrics.synced;
        ext = 'lrc';
    }

    if (!content) return;

    const filename = `${currentTrackInfo.artistName} - ${currentTrackInfo.trackName}.${ext}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
});

async function handleInitialLoad() {
    const params = new URLSearchParams(window.location.search);
    
    // Check for ID direct access
    if (params.has('id')) {
        const id = params.get('id');
        await fetchAndOpenLyricsById(id);
    }
    
    // Check for Search Query
    else if (params.has('q')) {
        const q = params.get('q');
        searchInput.value = q;
        performSearch();
    }
    
    // Check for Advanced Search Params
    else if (params.has('track_name') || params.has('id')) {
        // Switch to advanced mode
        toggleAdvancedBtn.click();
        
        if (params.has('id')) {
            advId.value = params.get('id');
        } else {
            advTrack.value = params.get('track_name') || '';
            advArtist.value = params.get('artist_name') || '';
            advAlbum.value = params.get('album_name') || '';
            performSearch();
        }
    }
}

async function fetchAndOpenLyricsById(id) {
    if (!id) return;
    
    header.classList.add('active'); // Simply move header up
    statusContainer.classList.remove('hidden');
    statusText.innerText = "Fetching lyrics by ID...";
    
    try {
        const response = await fetch(`${API_URL}/get/${id}`);
        if (!response.ok) throw new Error('Network error or ID not found');
        
        const track = await response.json();
        statusContainer.classList.add('hidden');
        
        // Open the modal directly
        openLyrics(track);
        // Also render it so background isn't empty
        renderResults([track]);
        
    } catch (error) {
        console.error(error);
        statusText.innerText = "Error fetching lyrics by ID.";
        document.querySelector('.loader').classList.add('hidden');
    }
}
