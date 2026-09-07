/* =========================================================
   TripSplit
   Firebase + Persistent Trips + Recent Trips + Realtime Sync
   Offline-First Optimistic Updates + Offline Sync Queue
   Dark Theme Controller Integrated
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
            toast("Trip not found.");
            return;
        }

        const trip = normalizeTrip(snapshot.val(), id);
        saveTripLocally(trip);
        subscribeToTrip(id);
        renderTrip();
    } catch (error) {
        console.error(error);
        toast("Could not open this trip.");
    }
}

async function refreshTripFromFirebase(id) {
    try {
        const snapshot = await get(ref(db, "trips/" + id));
        if (!snapshot.exists()) {
            removeRecentTrip(id);
            if (state.currentId === id) {
                state.currentId = null;
                localStorage.removeItem(CURRENT_KEY);
                show("home");
            }
            return;
        }
        const trip = normalizeTrip(snapshot.val(), id);
        saveTripLocally(trip);
        setSyncStatus(true);
        renderTrip();
    } catch (error) {
        setSyncStatus(false);
        console.warn("Background Firebase refresh failed:", error);
    }
}


/* =========================================================
   JOIN TRIP
========================================================= */

async function joinTrip() {
    const code = $("joinCode").value.trim().toUpperCase();
    const name = $("joinName").value.trim();

    if (code.length !== 6) {
        toast("Enter a valid 6-character code.");
        return;
    }
    if (!name) {
        toast("Enter your name.");
        return;
    }

    const button = $("joinConfirmBtn");
    button.disabled = true;
    button.textContent = "Joining...";

    try {
        const codeSnapshot = await get(ref(db, "tripCodes/" + code));
        if (!codeSnapshot.exists()) {
            toast("Trip code not found.");
            return;
        }

        const tripId = codeSnapshot.val();
        const tripSnapshot = await get(ref(db, "trips/" + tripId));
        if (!tripSnapshot.exists()) {
            toast("Trip no longer exists.");
            return;
        }

        const trip = normalizeTrip(tripSnapshot.val(), tripId);
        const existing = trip.members.find(
            m => m.name.trim().toLowerCase() === name.toLowerCase()
        );

        if (!existing) {
            const memberId = uid();
            await set(ref(db, `trips/${tripId}/members/${memberId}`), {
                id: memberId,
                name
            });
            toast("Joined trip successfully 🎉");
        } else {
            toast("Welcome back 👋");
        }

        $("joinCode").value = "";
        $("joinName").value = "";

        saveTripLocally(trip);
        subscribeToTrip(tripId);
        renderTrip();
    } catch (error) {
        console.error(error);
        toast("Could not join trip.");
    } finally {
        button.disabled = false;
        button.textContent = "Join Trip";
    }
}


/* =========================================================
   ADD MEMBER (OFFLINE-CAPABLE + QUEUE)
========================================================= */

function addMember() {
    const trip = current();
    if (!trip) return;

    openModal(
        "Add Friend",
        "Add someone to this trip.",
        `
        <label>Friend Name</label>
        <input id="newMemberName" placeholder="e.g. Ahmed" maxlength="40">
        <button class="btn btn-primary full" id="saveMemberBtn">Add Friend</button>
        `
    );

    $("saveMemberBtn").onclick = async () => {
        const name = $("newMemberName").value.trim();
        if (!name) {
            toast("Enter friend name.");
            return;
        }

        const duplicate = trip.members.some(
            m => m.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicate) {
            toast("Member already exists.");
            return;
        }

        const memberId = uid();
        const newMember = { id: memberId, name };

        // Local state update
        trip.members.push(newMember);
        saveTripLocally(trip);
        renderTrip();
        closeModal();
        toast("Friend added 👥");

        // Sync logic with queue fallback
        if (!navigator.onLine) {
            addToSyncQueue({
                type: "addMember",
                tripId: trip.id,
                member: newMember
            });
            setSyncStatus(false);
        } else {
            try {
                await set(ref(db, `trips/${trip.id}/members/${memberId}`), newMember);
                setSyncStatus(true);
            } catch (error) {
                console.warn("Live add failed, added to queue:", error);
                addToSyncQueue({
                    type: "addMember",
                    tripId: trip.id,
                    member: newMember
                });
                setSyncStatus(false);
            }
        }
    };
}


/* =========================================================
   EXPENSE FORM (OFFLINE-FIRST + SYNC QUEUE SAFEGUARD)
========================================================= */

function expenseForm(exp = null) {
    const trip = current();
    if (!trip) return;

    const isEdit = !!exp;
    const paidBy = exp?.paidBy || trip.members[0]?.id || "";
    let splitMode = exp?.splitMode || "equal";
    let selectedCategory = exp?.category || "food";

    const categories = [
        { id: "food", label: "🍔 Food" },
        { id: "hotel", label: "🏨 Stay" },
        { id: "travel", label: "🚕 Travel" },
        { id: "fuel", label: "⛽ Fuel" },
        { id: "shopping", label: "🛍️ Shopping" },
        { id: "fun", label: "🎬 Fun" },
        { id: "medical", label: "💊 Medical" },
        { id: "other", label: "💸 Other" }
    ];

    openModal(
        isEdit ? "Edit Expense" : "Add Expense",
        isEdit ? "Update this expense." : "Record a payment.",
        `
        <label>Expense Category</label>
        <div class="category-grid" id="categoryPicker">
            ${categories.map(cat => `
                <button type="button" class="category-btn ${cat.id === selectedCategory ? "active" : ""}" data-cat="${cat.id}">
                    ${cat.label}
                </button>
            `).join("")}
        </div>

        <label>Expense Name</label>
        <input id="expenseName" placeholder="e.g. Dinner, Hotel, Taxi" maxlength="60" value="${esc(exp?.name || "")}">

        <label>Amount</label>
        <input id="expenseAmount" type="number" min="0" step="0.01" placeholder="₹ 0" value="${exp?.amount ?? ""}">

        <label>Paid By</label>
        <select id="expensePaidBy">
            ${trip.members.map(member => `
                <option value="${esc(member.id)}" ${member.id === paidBy ? "selected" : ""}>
                    ${esc(member.name)}
                </option>
            `).join("")}
        </select>

        <label>Split Type</label>
        <div class="choice-row">
            <button type="button" class="choice ${splitMode === "equal" ? "selected" : ""}" data-split="equal">
                Equal Split
            </button>
            <button type="button" class="choice ${splitMode === "custom" ? "selected" : ""}" data-split="custom">
                Custom Split
            </button>
        </div>

        <label>Split Between</label>
        <div class="check-list">
            ${trip.members.map(member => {
                const checked = exp
                    ? (Array.isArray(exp.splitBetween) ? exp.splitBetween.includes(member.id) : true)
                    : true;
                return `
                    <div class="check-item">
                        <input type="checkbox" class="split-member" value="${esc(member.id)}" id="split_${esc(member.id)}" ${checked ? "checked" : ""}>
                        <label for="split_${esc(member.id)}">${esc(member.name)}</label>
                    </div>
                `;
            }).join("")}
        </div>

        <div id="customSplitArea"></div>

        <button class="btn btn-primary full" id="saveExpenseBtn">
            ${isEdit ? "Save Changes" : "Add Expense"}
        </button>
        `
    );

    document.querySelectorAll("#categoryPicker .category-btn").forEach(btn => {
        btn.onclick = () => {
            selectedCategory = btn.dataset.cat;
            document.querySelectorAll("#categoryPicker .category-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const nameInput = $("expenseName");
            if (!nameInput.value.trim()) {
                const labelText = btn.textContent.trim().split(" ").slice(1).join(" ");
                nameInput.value = labelText;
            }
        };
    });

    function updateCustomTotal() {
        let total = 0;
        document.querySelectorAll(".custom-input").forEach(input => {
            total += Number(input.value || 0);
        });
        if ($("customTotal")) {
            $("customTotal").textContent = money(total);
        }
    }

    function renderCustomArea() {
        const area = $("customSplitArea");
        if (!area) return;

        if (splitMode !== "custom") {
            area.innerHTML = "";
            return;
        }

        const selectedIds = [...document.querySelectorAll(".split-member:checked")].map(i => i.value);

        area.innerHTML = `
            <label>Custom Amounts</label>
            <div class="check-list">
                ${trip.members.filter(m => selectedIds.includes(m.id)).map(member => {
                    const oldValue = exp?.customSplits?.[member.id] ?? "";
                    return `
                        <div class="custom-row">
                            <span>${esc(member.name)}</span>
                            <input type="number" class="custom-input" data-member="${esc(member.id)}" min="0" step="0.01" placeholder="₹0" value="${oldValue}">
                        </div>
                    `;
                }).join("")}
            </div>
            <div class="split-total">
                <span>Custom Total</span>
                <strong id="customTotal">₹0</strong>
            </div>
        `;
        updateCustomTotal();
    }

    document.querySelectorAll("[data-split]").forEach(button => {
        button.onclick = () => {
            splitMode = button.dataset.split;
            document.querySelectorAll("[data-split]").forEach(btn => {
                btn.classList.toggle("selected", btn.dataset.split === splitMode);
            });
            renderCustomArea();
        };
    });

    document.querySelectorAll(".split-member").forEach(input => {
        input.onchange = () => {
            if (splitMode === "custom") renderCustomArea();
        };
    });

    $("modalBody").addEventListener("input", event => {
        if (event.target.classList.contains("custom-input")) {
            updateCustomTotal();
        }
    });

    renderCustomArea();

    $("saveExpenseBtn").onclick = async () => {
        const name = $("expenseName").value.trim();
        const amount = Number($("expenseAmount").value);
        const paidBy = $("expensePaidBy").value;
        const splitBetween = [...document.querySelectorAll(".split-member:checked")].map(i => i.value);

        if (!name) {
            toast("Enter expense name.");
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            toast("Enter a valid amount.");
            return;
        }
        if (!paidBy) {
            toast("Select who paid.");
            return;
        }
        if (!splitBetween.length) {
            toast("Select at least one member.");
            return;
        }

        let customSplits = {};
        if (splitMode === "custom") {
            let total = 0;
            for (const memberId of splitBetween) {
                const input = document.querySelector(`.custom-input[data-member="${memberId}"]`);
                const val = Number(input?.value || 0);
                if (!Number.isFinite(val) || val < 0) {
                    toast("Enter valid custom amounts.");
                    return;
                }
                customSplits[memberId] = val;
                total += val;
            }

            if (Math.abs(total - amount) > 0.01) {
                toast(`Custom split must equal ${money(amount)}`);
                return;
            }
        }

        const expenseId = exp?.id || uid();
        const expense = {
            id: expenseId,
            name,
            category: selectedCategory,
            amount,
            paidBy,
            splitBetween,
            splitMode,
            customSplits,
            createdAt: exp?.createdAt || new Date().toISOString()
        };

        // 1. INSTANT LOCAL UPDATE
        const expIndex = trip.expenses.findIndex(e => e.id === expenseId);
        if (expIndex >= 0) {
            trip.expenses[expIndex] = expense;
        } else {
            trip.expenses.push(expense);
        }

        saveTripLocally(trip);
        renderTrip();
        closeModal();
        toast(isEdit ? "Expense updated 💾" : "Expense added 💸");

        // 2. QUEUE & CLOUD SYNC
        if (!navigator.onLine) {
            addToSyncQueue({
                type: "setExpense",
                tripId: trip.id,
                expense: expense
            });
            setSyncStatus(false);
            toast("Saved offline. Will sync when online 📱");
        } else {
            try {
                await set(ref(db, `trips/${trip.id}/expenses/${expenseId}`), expense);
                setSyncStatus(true);
            } catch (error) {
                console.warn("Live save failed, saved to sync queue:", error);
                addToSyncQueue({
                    type: "setExpense",
                    tripId: trip.id,
                    expense: expense
                });
                setSyncStatus(false);
            }
        }
    };
}

async function deleteExpense(id) {
    const trip = current();
    if (!trip) return;

    const expense = trip.expenses.find(e => e.id === id);
    if (!expense) return;

    if (!confirm(`Delete "${expense.name}"?`)) return;

    // Instant local delete
    trip.expenses = trip.expenses.filter(e => e.id !== id);
    saveTripLocally(trip);
    renderTrip();
    toast("Expense deleted.");

    if (!navigator.onLine) {
        addToSyncQueue({
            type: "deleteExpense",
            tripId: trip.id,
            expenseId: id
        });
        setSyncStatus(false);
    } else {
        try {
            await set(ref(db, `trips/${trip.id}/expenses/${id}`), null);
            setSyncStatus(true);
        } catch (error) {
            console.warn("Live delete failed, queued for sync:", error);
            addToSyncQueue({
                type: "deleteExpense",
                tripId: trip.id,
                expenseId: id
            });
            setSyncStatus(false);
        }
    }
}


/* =========================================================
   SPLIT CALCULATIONS & BALANCES
========================================================= */

function shares(exp) {
    const result = {};
    if (exp.splitMode === "custom") {
        for (const memberId of exp.splitBetween || []) {
            result[memberId] = Number(exp.customSplits?.[memberId] || 0);
        }
        return result;
    }

    const ids = exp.splitBetween || [];
    const each = ids.length ? Number(exp.amount) / ids.length : 0;
    ids.forEach(id => {
        result[id] = each;
    });
    return result;
}

function balances() {
    const trip = current();
    if (!trip) return {};

    const result = {};
    trip.members.forEach(m => {
        result[m.id] = 0;
    });

    trip.expenses.forEach(exp => {
        const amt = Number(exp.amount || 0);
        if (result[exp.paidBy] !== undefined) {
            result[exp.paidBy] += amt;
        }

        const split = shares(exp);
        Object.entries(split).forEach(([memberId, share]) => {
            if (result[memberId] !== undefined) {
                result[memberId] -= Number(share || 0);
            }
        });
    });

    return result;
}

function settlements() {
    const balance = balances();
    const debtors = [];
    const creditors = [];

    Object.entries(balance).forEach(([memberId, amt]) => {
        if (amt < -0.01) debtors.push({ id: memberId, amount: -amt });
        else if (amt > 0.01) creditors.push({ id: memberId, amount: amt });
    });

    const result = [];
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
        const debtor = debtors[d];
        const creditor = creditors[c];
        const amt = Math.min(debtor.amount, creditor.amount);

        result.push({
            from: debtor.id,
            to: creditor.id,
            amount: amt
        });

        debtor.amount -= amt;
        creditor.amount -= amt;

        if (debtor.amount <= 0.01) d++;
        if (creditor.amount <= 0.01) c++;
    }

    return result;
}

function memberName(id) {
    const trip = current();
    const member = trip?.members.find(m => m.id === id);
    return member?.name || "Unknown";
}

function empty(title, text) {
    return `
        <div class="empty">
            <strong>${esc(title)}</strong>
            ${esc(text)}
        </div>
    `;
}

function expenseHTML(exp) {
    const visual = expenseVisual(exp.name, exp.category);
    return `
        <div class="expense-main-row">
            <div class="expense-image ${visual.type}">
                <span>${visual.emoji}</span>
            </div>
            <div class="expense-info">
                <b>${esc(exp.name)}</b>
                <div class="expense-meta">
                    <small>Paid by ${esc(memberName(exp.paidBy))}</small>
                    <span class="dot">•</span>
                    <small>${formatDate(exp.createdAt)}</small>
                </div>
            </div>
            <div class="expense-amount">${money(exp.amount)}</div>
        </div>
    `;
}


/* =========================================================
   UI RENDERING (EXPENSES, MEMBERS, BALANCES)
========================================================= */

function renderRecentExpenses() {
    const trip = current();
    const container = $("recentExpensesList");
    if (!trip || !container) return;

    const expenses = [...trip.expenses]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);

    if (!expenses.length) {
        container.innerHTML = empty("No expenses yet", "Add your first trip expense.");
        return;
    }

    container.innerHTML = expenses.map(exp => `
        <div class="card expense-card-wrapper">
            ${expenseHTML(exp)}
        </div>
    `).join("");
}

function renderMembers() {
    const trip = current();
    const container = $("membersList");
    if (!trip || !container) return;

    if (!trip.members.length) {
        container.innerHTML = empty("No members", "Add friends to this trip.");
        return;
    }

    container.innerHTML = trip.members.map((member, index) => `
        <div class="card member-card">
            <div class="avatar">${esc(member.name.charAt(0).toUpperCase())}</div>
            <div>
                <b>${esc(member.name)}</b>
                <small>${index === 0 ? "Trip creator" : "Member"}</small>
            </div>
        </div>
    `).join("");
}

function renderExpenses() {
    const trip = current();
    const container = $("expensesList");
    if (!trip || !container) return;

    let expenses = [...trip.expenses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (state.categoryFilter !== "all") {
        expenses = expenses.filter(exp => expenseVisual(exp.name, exp.category).type === state.categoryFilter);
    }

    if (!expenses.length) {
        container.innerHTML = empty(
            state.categoryFilter === "all" ? "No expenses yet" : "No matches",
            "Add an expense to start splitting."
        );
        return;
    }

    container.innerHTML = expenses.map(exp => `
        <div class="card">
            ${expenseHTML(exp)}
            <div class="card-actions">
                <button class="mini-btn" data-edit-expense="${esc(exp.id)}">Edit</button>
                <button class="mini-btn" data-delete-expense="${esc(exp.id)}">Delete</button>
            </div>
        </div>
    `).join("");
}

function renderBalances() {
    const trip = current();
    const container = $("balancesList");
    if (!trip || !container) return;

    const balance = balances();

    container.innerHTML = trip.members.map(member => {
        const val = balance[member.id] || 0;
        let status = "Settled";
        if (val > 0.01) status = "gets back";
        else if (val < -0.01) status = "owes";

        const className = val > 0.01 ? "positive" : val < -0.01 ? "negative" : "";

        return `
            <div class="card balance-card">
                <div>
                    <b>${esc(member.name)}</b>
                    <small>${status}</small>
                </div>
                <strong class="${className}">
                    ${val > 0.01 ? "+" : ""}${money(val)}
                </strong>
            </div>
        `;
    }).join("");
}

function renderSettlement() {
    const container = $("settlementList");
    if (!container) return;

    const list = settlements();
    if (!list.length) {
        container.innerHTML = empty("All settled 🎉", "Nobody owes anything.");
        return;
    }

    container.innerHTML = list.map(item => `
        <div class="settlement-card">
            <div class="who">
                <b>${esc(memberName(item.from))}</b>
                <small>needs to pay</small>
            </div>
            <div class="settle-arrow">→</div>
            <div class="who">
                <b>${esc(memberName(item.to))}</b>
            </div>
            <div class="settle-money">${money(item.amount)}</div>
        </div>
    `).join("");
}

function renderTrip() {
    const trip = current();
    if (!trip) {
        show("home");
        return;
    }

    $("tripTitle").textContent = trip.name;
    $("tripCode").textContent = trip.code;
    $("tripMemberCount").textContent = `${trip.members.length} ${trip.members.length === 1 ? "member" : "members"}`;
    $("totalMembers").textContent = trip.members.length;

    const total = trip.expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    $("totalExpense").textContent = money(total);

    renderRecentExpenses();
    renderMembers();
    renderExpenses();
    renderBalances();
    renderSettlement();

    addRecentTrip(trip);

    const tripView = $("tripView");
    if (tripView && !tripView.classList.contains("active")) {
        show("trip");
    }
}


/* =========================================================
   WHATSAPP & SUMMARY SHARING
========================================================= */

async function shareWhatsAppSummary() {
    const trip = current();
    if (!trip) return;

    const list = settlements();
    const total = trip.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    let text = `🌴 *${trip.name}* (TripSplit Summary)\n`;
    text += `💰 Total Expenses: ${money(total)}\n`;
    text += `👥 Members: ${trip.members.map(m => m.name).join(", ")}\n\n`;

    text += `⚖️ *Final Settlements:*\n`;
    if (!list.length) {
        text += `All settled up! Nobody owes anything 🎉\n\n`;
    } else {
        list.forEach(item => {
            text += `• ${memberName(item.from)} ➔ pays ${memberName(item.to)}: ${money(item.amount)}\n`;
        });
        text += `\n`;
    }
    text += `Join this trip using code: *${trip.code}*`;

    const encoded = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: `${trip.name} - Settlement Summary`,
                text: text
            });
            return;
        } catch (_) {}
    }

    window.open(whatsappUrl, "_blank");
}

async function shareTrip() {
    const trip = current();
    if (!trip) return;

    const text = `Join my TripSplit trip "${trip.name}" using code: ${trip.code}`;
    try {
        if (navigator.share) {
            await navigator.share({ title: "TripSplit", text });
            return;
        }
    } catch (error) {
        if (error?.name === "AbortError") return;
    }

    try {
        await navigator.clipboard.writeText(trip.code);
        toast("Trip code copied 📋");
    } catch (_) {
        toast(`Trip Code: ${trip.code}`);
    }
}

async function copyCode() {
    const trip = current();
    if (!trip) return;

    try {
        await navigator.clipboard.writeText(trip.code);
        toast("Trip code copied 📋");
    } catch (_) {
        toast(`Trip Code: ${trip.code}`);
    }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

$("themeToggleBtn")?.addEventListener("click", toggleTheme);

$("createTripBtn")?.addEventListener("click", () => show("create"));
$("joinTripBtn")?.addEventListener("click", () => show("join"));
$("createConfirmBtn")?.addEventListener("click", createTrip);
$("joinConfirmBtn")?.addEventListener("click", joinTrip);

$("backBtn")?.addEventListener("click", () => show("home"));
$("homeBtn")?.addEventListener("click", () => show("home"));

$("closeModal")?.addEventListener("click", closeModal);
$("modal")?.addEventListener("click", e => {
    if (e.target === $("modal")) closeModal();
});

$("copyCodeBtn")?.addEventListener("click", copyCode);
$("shareBtn")?.addEventListener("click", shareTrip);
$("whatsappShareBtn")?.addEventListener("click", shareWhatsAppSummary);

$("addMemberBtn")?.addEventListener("click", addMember);
$("overviewAddMember")?.addEventListener("click", addMember);

$("addExpenseBtn")?.addEventListener("click", () => expenseForm());
$("overviewAddExpense")?.addEventListener("click", () => expenseForm());

// Online / Offline window events for sync status & queue flushing
window.addEventListener("online", async () => {
    setSyncStatus(true);
    toast("Back online 🌐");
    
    // Process all pending offline modifications first
    await processSyncQueue();

    const id = state.currentId;
    if (id) refreshTripFromFirebase(id);
});

window.addEventListener("offline", () => {
    setSyncStatus(false);
    toast("Working offline 📱");
});

// Recent trip open vs remove
$("recentTripsList")?.addEventListener("click", event => {
    const delBtn = event.target.closest("[data-delete-recent]");
    if (delBtn) {
        event.stopPropagation();
        const tripId = delBtn.dataset.deleteRecent;
        removeRecentTrip(tripId);
        toast("Trip removed from screen.");
        return;
    }

    const card = event.target.closest("[data-recent-trip]");
    if (card) {
        openRecentTrip(card.dataset.recentTrip);
    }
});

// Clear all recent trips
$("clearRecentBtn")?.addEventListener("click", () => {
    if (!confirm("Clear recent trips from this device?")) return;
    saveRecentTrips([]);
    renderRecentTrips();
    toast("Recent trips cleared.");
});

// Category filter chip listener
$("categoryFilterBar")?.addEventListener("click", event => {
    const chip = event.target.closest(".filter-chip");
    if (!chip) return;

    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.categoryFilter = chip.dataset.filter || "all";
    renderExpenses();
});

// Bottom navigation tabs
document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => openTab(button.dataset.tab));
});

// View All shortcuts
document.querySelectorAll("[data-tab]").forEach(button => {
    if (button.classList.contains("nav-item")) return;
    button.addEventListener("click", () => {
        const tab = button.dataset.tab;
        if (tab && current()) openTab(tab);
    });
});

// Inline expense actions
document.addEventListener("click", event => {
    const editBtn = event.target.closest("[data-edit-expense]");
    if (editBtn) {
        const trip = current();
        const exp = trip?.expenses.find(e => e.id === editBtn.dataset.editExpense);
        if (exp) expenseForm(exp);
        return;
    }

    const delBtn = event.target.closest("[data-delete-expense]");
    if (delBtn) {
        deleteExpense(delBtn.dataset.deleteExpense);
    }
});

$("joinCode")?.addEventListener("input", event => {
    event.target.value = event.target.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
});


/* =========================================================
   PAGE PERSISTENCE & INITIALIZATION
========================================================= */

window.addEventListener("pagehide", () => {
    const trip = current();
    if (trip) {
        cacheTrip(trip);
        addRecentTrip(trip);
    }
});

(async function init() {
    // Restore Saved Theme
    const savedTheme = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(savedTheme);

    renderRecentTrips();
    show("home");

    const currentId = state.currentId;
    if (currentId) {
        const cached = getCachedTrip(currentId);
        if (cached) {
            state.trips[currentId] = cached;
        }
    }

    setSyncStatus(navigator.onLine);

    // If loaded online, flush any pending offline queues immediately
    if (navigator.onLine) {
        processSyncQueue();
    }

    const dismissSplash = () => {
        setTimeout(() => {
            const splash = $("splashScreen");
            if (splash) {
                splash.classList.add("hide");
            }
        }, 1800);
    };

    if (document.readyState === "complete") {
        dismissSplash();
    } else {
        window.addEventListener("load", dismissSplash);
    }
})();
