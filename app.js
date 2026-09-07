/* =========================================================
   TripSplit
   Firebase + Persistent Trips + Recent Trips + Realtime Sync
   Offline-First Optimistic Updates + Offline Sync Queue
   Dark Theme Controller + 10s Audio Roulette
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getDatabase,
    ref,
    get,
    set,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyAVkT9Azk5J1dDWJKurOchCda5EG03x3tI",
    authDomain: "tripsplit-41dd4.firebaseapp.com",
    databaseURL: "https://tripsplit-41dd4-default-rtdb.firebaseio.com/",
    projectId: "tripsplit-41dd4",
    storageBucket: "tripsplit-41dd4.firebasestorage.app",
    messagingSenderId: "434118904594",
    appId: "1:434118904594:web:d655e1ef9f88d265a981cb"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);


/* =========================================================
   STORAGE KEYS & STATE
========================================================= */

const CURRENT_KEY = "tripsplit_current_v5";
const CACHE_KEY = "tripsplit_cache_v5";
const RECENT_KEY = "tripsplit_recent_v5";
const THEME_KEY = "tripsplit_theme_v1";
const QUEUE_KEY = "tripsplit_pending_sync_v1";

const state = {
    currentId: localStorage.getItem(CURRENT_KEY) || null,
    trips: {},
    unsubscribe: null,
    categoryFilter: "all"
};


/* =========================================================
   THEME CONTROLLER (LIGHT / DARK)
========================================================= */

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = current === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
}


/* =========================================================
   OFFLINE SYNC QUEUE HELPERS
========================================================= */

function getPendingQueue() {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch (_) {
        return [];
    }
}

function addToSyncQueue(item) {
    const queue = getPendingQueue();
    queue.push(item);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function processSyncQueue() {
    if (!navigator.onLine) return;
    const queue = getPendingQueue();
    if (!queue.length) return;

    const remainingQueue = [];

    for (const task of queue) {
        try {
            if (task.type === "setExpense") {
                await set(ref(db, `trips/${task.tripId}/expenses/${task.expense.id}`), task.expense);
            } else if (task.type === "deleteExpense") {
                await set(ref(db, `trips/${task.tripId}/expenses/${task.expenseId}`), null);
            } else if (task.type === "addMember") {
                await set(ref(db, `trips/${task.tripId}/members/${task.member.id}`), task.member);
            }
        } catch (err) {
            console.warn("Queue sync retry pending:", task, err);
            remainingQueue.push(task);
        }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    if (queue.length > remainingQueue.length) {
        toast("Offline entries synced to cloud ☁️");
    }
}


/* =========================================================
   WEB AUDIO API SOUND EFFECTS (SYNTHESIZED)
========================================================= */

let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playTickSound() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(75, ctx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.04);
    } catch (_) {}
}

function playWinnerSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 Celebration

        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now + idx * 0.09);

            gain.gain.setValueAtTime(0, now + idx * 0.09);
            gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.09 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.09);
            osc.stop(now + idx * 0.09 + 0.55);
        });
    } catch (_) {}
}


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

function money(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(isoString) {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short"
        }) + " • " + d.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    } catch (_) {
        return "";
    }
}

function setSyncStatus(isLive) {
    const badge = $("syncBadge");
    const text = $("syncText");
    if (!badge || !text) return;

    if (isLive) {
        badge.className = "sync-badge synced";
        text.textContent = "Synced";
    } else {
        badge.className = "sync-badge cached";
        text.textContent = "Offline";
    }
}


/* =========================================================
   EXPENSE VISUAL CATEGORIES
========================================================= */

function expenseVisual(name, explicitCategory = null) {
    if (explicitCategory) {
        const map = {
            hotel: { emoji: "🏨", type: "hotel" },
            food: { emoji: "🍔", type: "food" },
            travel: { emoji: "🚕", type: "travel" },
            shopping: { emoji: "🛍️", type: "shopping" },
            fuel: { emoji: "⛽", type: "fuel" },
            fun: { emoji: "🎬", type: "fun" },
            medical: { emoji: "💊", type: "medical" },
            other: { emoji: "💸", type: "other" }
        };
        if (map[explicitCategory]) return map[explicitCategory];
    }

    const text = String(name || "").toLowerCase();

    if (/hotel|room|stay|resort|airbnb|lodge|hostel/.test(text)) {
        return { emoji: "🏨", type: "hotel" };
    }
    if (/food|lunch|dinner|breakfast|restaurant|pizza|burger|chai|tea|coffee|snack|meal/.test(text)) {
        return { emoji: "🍔", type: "food" };
    }
    if (/flight|air|plane|airport|ticket|train|rail|bus|taxi|cab|uber|auto|travel|transport/.test(text)) {
        return { emoji: "🚕", type: "travel" };
    }
    if (/shopping|shirt|clothes|dress|gift|mall|purchase/.test(text)) {
        return { emoji: "🛍️", type: "shopping" };
    }
    if (/fuel|petrol|diesel|gas|parking/.test(text)) {
        return { emoji: "⛽", type: "fuel" };
    }
    if (/movie|cinema|game|fun|entertainment/.test(text)) {
        return { emoji: "🎬", type: "fun" };
    }
    if (/medicine|medical|doctor|hospital/.test(text)) {
        return { emoji: "💊", type: "medical" };
    }
    return { emoji: "💸", type: "other" };
}


/* =========================================================
   NORMALIZE TRIP
========================================================= */

function normalizeTrip(trip, id = null) {
    if (!trip) return null;

    const membersObject = trip.members && typeof trip.members === "object" ? trip.members : {};
    const expensesObject = trip.expenses && typeof trip.expenses === "object" ? trip.expenses : {};

    return {
        id: trip.id || id,
        name: trip.name || "Trip",
        code: trip.code || "",
        createdAt: trip.createdAt || new Date().toISOString(),
        members: Array.isArray(trip.members)
            ? trip.members
            : Object.entries(membersObject).map(([memberId, member]) => ({
                id: member.id || memberId,
                name: member.name || "Member"
            })),
        expenses: Array.isArray(trip.expenses)
            ? trip.expenses
            : Object.entries(expensesObject).map(([expenseId, expense]) => ({
                id: expense.id || expenseId,
                ...expense
            }))
    };
}


/* =========================================================
   TOAST
========================================================= */

let toastTimer;

function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove("show");
    }, 2400);
}


/* =========================================================
   CURRENT TRIP & CACHE
========================================================= */

function current() {
    return state.currentId ? state.trips[state.currentId] : null;
}

function setCurrent(id) {
    state.currentId = id || null;
    if (id) {
        localStorage.setItem(CURRENT_KEY, id);
    } else {
        localStorage.removeItem(CURRENT_KEY);
    }
}

function tripCacheKey(id) {
    return CACHE_KEY + "_" + id;
}

function cacheTrip(trip) {
    if (!trip?.id) return;
    try {
        localStorage.setItem(tripCacheKey(trip.id), JSON.stringify(trip));
        localStorage.setItem(CACHE_KEY, JSON.stringify(trip));
    } catch (error) {
        console.warn("Local cache error:", error);
    }
}

function getCachedTrip(id) {
    if (!id) return null;
    try {
        const exact = localStorage.getItem(tripCacheKey(id));
        if (exact) {
            const trip = JSON.parse(exact);
            if (trip && trip.id === id) return normalizeTrip(trip, id);
        }
        const generic = localStorage.getItem(CACHE_KEY);
        if (generic) {
            const trip = JSON.parse(generic);
            if (trip && trip.id === id) return normalizeTrip(trip, id);
        }
    } catch (error) {
        console.warn("Cache read error:", error);
    }
    return null;
}

function saveTripLocally(trip) {
    if (!trip?.id) return;
    const normalized = normalizeTrip(trip, trip.id);
    state.trips[normalized.id] = normalized;
    setCurrent(normalized.id);
    cacheTrip(normalized);
    addRecentTrip(normalized);
}


/* =========================================================
   RECENT TRIPS WITH DEDICATED REMOVE BUTTON
========================================================= */

function getRecentTrips() {
    try {
        const data = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
        if (!Array.isArray(data)) return [];
        return data.filter(item => item && item.id);
    } catch (_) {
        return [];
    }
}

function saveRecentTrips(list) {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (_) {}
}

function addRecentTrip(trip) {
    if (!trip?.id) return;
    let list = getRecentTrips();

    const item = {
        id: trip.id,
        name: trip.name || "Trip",
        code: trip.code || "",
        updatedAt: Date.now()
    };

    list = list.filter(x => x && x.id !== trip.id);
    list.unshift(item);
    list = list.slice(0, 10);

    saveRecentTrips(list);
    renderRecentTrips();
}

function removeRecentTrip(id) {
    const list = getRecentTrips().filter(trip => trip.id !== id);
    saveRecentTrips(list);
    renderRecentTrips();
}

function renderRecentTrips() {
    const section = $("recentTripsSection");
    const container = $("recentTripsList");
    if (!section || !container) return;

    const trips = getRecentTrips();

    if (!trips.length) {
        section.classList.add("hidden");
        container.innerHTML = "";
        return;
    }

    section.classList.remove("hidden");
    container.innerHTML = trips.map(trip => `
        <div class="recent-trip-row">
            <button type="button" class="recent-trip-card" data-recent-trip="${esc(trip.id)}">
                <div class="recent-trip-icon">
                    <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
                        <path d="M14 17C14 17 21 14 24 24C27 34 34 31 34 31" stroke="#D2042D" stroke-width="4" stroke-linecap="round"/>
                        <circle cx="14" cy="17" r="4.5" fill="#D2042D"/>
                        <circle cx="34" cy="31" r="4.5" fill="#ED3155"/>
                    </svg>
                </div>
                <div class="recent-trip-info">
                    <b>${esc(trip.name)}</b>
                    <small>Code: ${esc(trip.code || "------")}</small>
                </div>
                <div class="recent-trip-arrow">→</div>
            </button>
            <button type="button" class="recent-trip-del-btn" data-delete-recent="${esc(trip.id)}" title="Remove trip from list">
                ✕
            </button>
        </div>
    `).join("");
}


/* =========================================================
   NAVIGATION / VIEW CONTROLS
========================================================= */

function show(view) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const target = $(view + "View");
    if (target) {
        target.classList.add("active");
    }

    const isTrip = view === "trip";
    $("backBtn")?.classList.toggle("hidden", view === "home");
    $("bottomNav")?.classList.toggle("show", isTrip);

    if (isTrip) {
        openTab("overview");
    }

    if (view === "home") {
        renderRecentTrips();
    }
}

function openTab(tab) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    const content = $("tab" + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (content) {
        content.classList.add("active");
    }

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });
}

function openModal(title, subtitle, body) {
    $("modalTitle").textContent = title;
    $("modalSubtitle").textContent = subtitle;
    $("modalBody").innerHTML = body;

    $("modal").classList.add("show");
    $("modal").setAttribute("aria-hidden", "false");
}

function closeModal() {
    $("modal").classList.remove("show");
    $("modal").setAttribute("aria-hidden", "true");
}


/* =========================================================
   TRIP CODE GENERATION
========================================================= */

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
}

async function getUniqueCode() {
    for (let attempt = 0; attempt < 20; attempt++) {
        const code = generateCode();
        const snapshot = await get(ref(db, "tripCodes/" + code));
        if (!snapshot.exists()) {
            return code;
        }
    }
    throw new Error("Unable to create unique trip code.");
}


/* =========================================================
   REALTIME SUBSCRIPTION
========================================================= */

function unsubscribeTrip() {
    if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
    }
}

function subscribeToTrip(tripId) {
    unsubscribeTrip();
    if (!tripId) return;

    const tripRef = ref(db, "trips/" + tripId);
    state.unsubscribe = onValue(
        tripRef,
        snapshot => {
            if (!snapshot.exists()) {
                removeRecentTrip(tripId);
                if (state.currentId === tripId) {
                    state.currentId = null;
                    localStorage.removeItem(CURRENT_KEY);
                }
                delete state.trips[tripId];
                show("home");
                toast("Trip no longer exists.");
                return;
            }

            const trip = normalizeTrip(snapshot.val(), tripId);
            saveTripLocally(trip);
            setSyncStatus(true);
            renderTrip();
        },
        error => {
            console.error("Firebase realtime error:", error);
            setSyncStatus(false);
            toast("Working offline 📱");
        }
    );
}


/* =========================================================
   CREATE TRIP
========================================================= */

async function createTrip() {
    const name = $("tripName").value.trim();
    const creator = $("creatorName").value.trim();

    if (!name) {
        toast("Enter trip name.");
        return;
    }
    if (!creator) {
        toast("Enter your name.");
        return;
    }

    const button = $("createConfirmBtn");
    button.disabled = true;
    button.textContent = "Creating...";

    try {
        const id = uid();
        const code = await getUniqueCode();
        const memberId = uid();

        const trip = {
            id,
            name,
            code,
            createdAt: new Date().toISOString(),
            members: {
                [memberId]: {
                    id: memberId,
                    name: creator
                }
            },
            expenses: {}
        };

        await update(ref(db), {
            ["trips/" + id]: trip,
            ["tripCodes/" + code]: id
        });

        const normalized = normalizeTrip(trip, id);
        saveTripLocally(normalized);

        $("tripName").value = "";
        $("creatorName").value = "";

        subscribeToTrip(id);
        renderTrip();
        toast("Trip created successfully 🎉");
    } catch (error) {
        console.error(error);
        toast("Could not create trip.");
    } finally {
        button.disabled = false;
        button.textContent = "Create Trip";
    }
}


/* =========================================================
   OPEN RECENT TRIP
========================================================= */

async function openRecentTrip(id) {
    if (!id) return;

    if (state.trips[id]) {
        setCurrent(id);
        subscribeToTrip(id);
        renderTrip();
        return;
    }

    const cached = getCachedTrip(id);
    if (cached) {
        state.trips[id] = cached;
        setCurrent(id);
        addRecentTrip(cached);
        renderTrip();

        try {
            subscribeToTrip(id);
        } catch (_) {}

        refreshTripFromFirebase(id);
        return;
    }

    try {
        const snapshot = await get(ref(db, "trips/" + id));
        if (!snapshot.exists()) {
            removeRecentTrip(id);
            to
