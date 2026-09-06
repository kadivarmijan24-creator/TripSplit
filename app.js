/* =========================================================
   TripSplit - Firebase Realtime Database
   REALTIME SAFE VERSION
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getDatabase,
    ref,
    get,
    set,
    update,
    onValue,
    runTransaction
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
   LOCAL STATE
========================================================= */

const CURRENT_KEY = "tripsplit_current_v4";
const CACHE_KEY = "tripsplit_cache_v4";

const state = {
    currentId: localStorage.getItem(CURRENT_KEY) || null,
    trips: {},
    unsubscribe: null
};


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
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 10)
    );
}

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   NORMALIZE DATA
========================================================= */

function normalizeTrip(trip, id = null) {

    if (!trip) return null;

    const membersObject =
        trip.members &&
        typeof trip.members === "object"
            ? trip.members
            : {};

    const expensesObject =
        trip.expenses &&
        typeof trip.expenses === "object"
            ? trip.expenses
            : {};

    return {
        id: trip.id || id,
        name: trip.name || "Trip",
        code: trip.code || "",
        createdAt:
            trip.createdAt ||
            new Date().toISOString(),

        members: Array.isArray(trip.members)
            ? trip.members
            : Object.entries(membersObject).map(
                ([memberId, member]) => ({
                    id: member.id || memberId,
                    name: member.name || "Member"
                })
            ),

        expenses: Array.isArray(trip.expenses)
            ? trip.expenses
            : Object.entries(expensesObject).map(
                ([expenseId, expense]) => ({
                    id: expense.id || expenseId,
                    ...expense
                })
            )
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
   VIEW
========================================================= */

function show(view) {

    document.querySelectorAll(".view").forEach(v => {
        v.classList.remove("active");
    });

    const target = $(view + "View");

    if (target) {
        target.classList.add("active");
    }

    const isTrip = view === "trip";

    $("backBtn")?.classList.toggle(
        "hidden",
        view === "home"
    );

    $("bottomNav")?.classList.toggle(
        "show",
        isTrip
    );

    if (isTrip) {
        openTab("overview");
    }
}


/* =========================================================
   TABS
========================================================= */

function openTab(tab) {

    document.querySelectorAll(".tab-content")
        .forEach(el => {
            el.classList.remove("active");
        });

    const content =
        $("tab" +
            tab.charAt(0).toUpperCase() +
            tab.slice(1));

    if (content) {
        content.classList.add("active");
    }

    document.querySelectorAll(".nav-item")
        .forEach(btn => {
            btn.classList.toggle(
                "active",
                btn.dataset.tab === tab
            );
        });
}


/* =========================================================
   MODAL
========================================================= */

function openModal(title, subtitle, body) {

    $("modalTitle").textContent = title;
    $("modalSubtitle").textContent = subtitle;
    $("modalBody").innerHTML = body;

    $("modal").classList.add("show");
    $("modal").setAttribute(
        "aria-hidden",
        "false"
    );
}

function closeModal() {

    $("modal").classList.remove("show");

    $("modal").setAttribute(
        "aria-hidden",
        "true"
    );
}


/* =========================================================
   CURRENT TRIP
========================================================= */

function current() {

    return state.currentId
        ? state.trips[state.currentId]
        : null;
}

function cacheTrip(trip) {

    try {
        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify(trip)
        );
    } catch (_) {}
}

function setCurrent(id) {

    state.currentId = id;

    localStorage.setItem(
        CURRENT_KEY,
        id
    );
}


/* =========================================================
   TRIP CODE
========================================================= */

const CODE_CHARS =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {

    let code = "";

    for (let i = 0; i < 6; i++) {

        code += CODE_CHARS[
            Math.floor(
                Math.random() *
                CODE_CHARS.length
            )
        ];
    }

    return code;
}

async function getUniqueCode() {

    for (let attempt = 0; attempt < 20; attempt++) {

        const code = generateCode();

        const snapshot =
            await get(
                ref(db, "tripCodes/" + code)
            );

        if (!snapshot.exists()) {
            return code;
        }
    }

    throw new Error(
        "Unable to create unique trip code."
    );
}


/* =========================================================
   FIREBASE REALTIME SUBSCRIPTION
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

    const tripRef =
        ref(db, "trips/" + tripId);

    state.unsubscribe =
        onValue(
            tripRef,

            snapshot => {

                if (!snapshot.exists()) {

                    toast(
                        "Trip no longer exists."
                    );

                    state.currentId = null;

                    localStorage.removeItem(
                        CURRENT_KEY
                    );

                    show("home");

                    return;
                }

                const trip =
                    normalizeTrip(
                        snapshot.val(),
                        tripId
                    );

                state.trips[trip.id] = trip;

                setCurrent(trip.id);

                cacheTrip(trip);

                renderTrip();
            },

            error => {

                console.error(
                    "Firebase realtime error:",
                    error
                );

                toast(
                    "Realtime connection error."
                );
            }
        );
}


/* =========================================================
   CREATE TRIP
========================================================= */

async function createTrip() {

    const name =
        $("tripName").value.trim();

    const creator =
        $("creatorName").value.trim();

    if (!name) {
        toast("Enter trip name.");
        return;
    }

    if (!creator) {
        toast("Enter your name.");
        return;
    }

    const button =
        $("createConfirmBtn");

    button.disabled = true;
    button.textContent = "Creating...";

    try {

        const id = uid();

        const code =
            await getUniqueCode();

        const memberId = uid();

        const trip = {
            id,
            name,
            code,

            createdAt:
                new Date().toISOString(),

            members: {
                [memberId]: {
                    id: memberId,
                    name: creator
                }
            },

            expenses: {}
        };

        await update(
            ref(db),
            {
                ["trips/" + id]: trip,
                ["tripCodes/" + code]: id
            }
        );

        const normalized =
            normalizeTrip(trip, id);

        state.trips[id] = normalized;

        setCurrent(id);

        cacheTrip(normalized);

        $("tripName").value = "";
        $("creatorName").value = "";

        subscribeToTrip(id);

        renderTrip();

        toast(
            "Trip created successfully 🎉"
        );

    } catch (error) {

        console.error(error);

        toast(
            "Could not create trip."
        );

    } finally {

        button.disabled = false;
        button.textContent = "Create Trip";
    }
}


/* =========================================================
   JOIN TRIP
========================================================= */

async function joinTrip() {

    const code =
        $("joinCode").value
            .trim()
            .toUpperCase();

    const name =
        $("joinName").value.trim();

    if (code.length !== 6) {

        toast(
            "Enter a valid 6-character code."
        );

        return;
    }

    if (!name) {

        toast("Enter your name.");

        return;
    }

    const button =
        $("joinConfirmBtn");

    button.disabled = true;
    button.textContent = "Joining...";

    try {

        const codeSnapshot =
            await get(
                ref(
                    db,
                    "tripCodes/" + code
                )
            );

        if (!codeSnapshot.exists()) {

            toast("Trip code not found.");

            return;
        }

        const tripId =
            codeSnapshot.val();

        const tripSnapshot =
            await get(
                ref(
                    db,
                    "trips/" + tripId
                )
            );

        if (!tripSnapshot.exists()) {

            toast("Trip no longer exists.");

            return;
        }

        const trip =
            normalizeTrip(
                tripSnapshot.val(),
                tripId
            );

        const existing =
            trip.members.find(
                member =>
                    member.name
                        .trim()
                        .toLowerCase() ===
                    name.toLowerCase()
            );

        if (!existing) {

            const memberId = uid();

            await set(
                ref(
                    db,
                    `trips/${tripId}/members/${memberId}`
                ),
                {
                    id: memberId,
                    name
                }
            );

            toast(
                "Joined trip successfully 🎉"
            );

        } else {

            toast("Welcome back 👋");
        }

        $("joinCode").value = "";
        $("joinName").value = "";

        setCurrent(tripId);

        subscribeToTrip(tripId);

    } catch (error) {

        console.error(error);

        toast(
            "Could not join trip."
        );

    } finally {

        button.disabled = false;
        button.textContent = "Join Trip";
    }
}


/* =========================================================
   ADD MEMBER
========================================================= */

function addMember() {

    const trip = current();

    if (!trip) return;

    openModal(
        "Add Friend",
        "Add someone to this trip.",

        `
        <label>Friend Name</label>

        <input
            id="newMemberName"
            placeholder="e.g. Ahmed"
            maxlength="40"
        >

        <button
            class="btn btn-primary full"
            id="saveMemberBtn"
        >
            Add Friend
        </button>
        `
    );

    $("saveMemberBtn").onclick =
        async () => {

            const name =
                $("newMemberName")
                    .value
                    .trim();

            if (!name) {

                toast("Enter friend name.");

                return;
            }

            const duplicate =
                trip.members.some(
                    member =>
                        member.name
                            .trim()
                            .toLowerCase() ===
                        name.toLowerCase()
                );

            if (duplicate) {

                toast(
                    "Member already exists."
                );

                return;
            }

            const memberId = uid();

            try {

                await set(
                    ref(
                        db,
                        `trips/${trip.id}/members/${memberId}`
                    ),
                    {
                        id: memberId,
                        name
                    }
                );

                closeModal();

                toast(
                    "Friend added 👥"
                );

            } catch (error) {

                console.error(error);

                toast(
                    "Could not add member."
                );
            }
        };
}


/* =========================================================
   EXPENSE FORM
========================================================= */

function expenseForm(exp = null) {

    const trip = current();

    if (!trip) return;

    const isEdit = !!exp;

    const paidBy =
        exp?.paidBy ||
        trip.members[0]?.id ||
        "";

    let splitMode =
        exp?.splitMode ||
        "equal";

    openModal(
        isEdit
            ? "Edit Expense"
            : "Add Expense",

        isEdit
            ? "Update this expense."
            : "Record a payment.",

        `
        <label>Expense Name</label>

        <input
            id="expenseName"
            placeholder="e.g. Hotel"
            maxlength="60"
            value="${esc(exp?.name || "")}"
        >

        <label>Amount</label>

        <input
            id="expenseAmount"
            type="number"
            min="0"
            step="0.01"
            placeholder="₹ 0"
            value="${exp?.amount ?? ""}"
        >

        <label>Paid By</label>

        <select id="expensePaidBy">

            ${trip.members.map(member => `

                <option
                    value="${esc(member.id)}"
                    ${
                        member.id === paidBy
                            ? "selected"
                            : ""
                    }
                >
                    ${esc(member.name)}
                </option>

            `).join("")}

        </select>

        <label>Split Type</label>

        <div class="choice-row">

            <button
                type="button"
                class="choice ${
                    splitMode === "equal"
                        ? "selected"
                        : ""
                }"
                data-split="equal"
            >
                Equal Split
            </button>

            <button
                type="button"
                class="choice ${
                    splitMode === "custom"
                        ? "selected"
                        : ""
                }"
                data-split="custom"
            >
                Custom Split
            </button>

        </div>

        <label>Split Between</label>

        <div class="check-list">

            ${trip.members.map(member => {

                const checked =
                    exp
                        ? (
                            Array.isArray(
                                exp.splitBetween
                            )
                                ? exp.splitBetween
                                    .includes(member.id)
                                : true
                        )
                        : true;

                return `

                    <div class="check-item">

                        <input
                            type="checkbox"
                            class="split-member"
                            value="${esc(member.id)}"
                            id="split_${esc(member.id)}"
                            ${
                                checked
                                    ? "checked"
                                    : ""
                            }
                        >

                        <label
                            for="split_${esc(member.id)}"
                        >
                            ${esc(member.name)}
                        </label>

                    </div>

                `;

            }).join("")}

        </div>

        <div id="customSplitArea"></div>

        <button
            class="btn btn-primary full"
            id="saveExpenseBtn"
        >
            ${
                isEdit
                    ? "Save Changes"
                    : "Add Expense"
            }
        </button>
        `
    );


    function updateCustomTotal() {

        let total = 0;

        document
            .querySelectorAll(".custom-input")
            .forEach(input => {

                total += Number(
                    input.value || 0
                );
            });

        if ($("customTotal")) {

            $("customTotal").textContent =
                money(total);
        }
    }


    function renderCustomArea() {

        const area =
            $("customSplitArea");

        if (!area) return;

        if (splitMode !== "custom") {

            area.innerHTML = "";

            return;
        }

        const selectedIds =
            [
                ...document.querySelectorAll(
                    ".split-member:checked"
                )
            ].map(
                input => input.value
            );

        area.innerHTML = `

            <label>Custom Amounts</label>

            <div class="check-list">

                ${trip.members
                    .filter(member =>
                        selectedIds.includes(
                            member.id
                        )
                    )
                    .map(member => {

                        const oldValue =
                            exp?.customSplits?.[
                                member.id
                            ] ?? "";

                        return `

                            <div class="custom-row">

                                <span>
                                    ${esc(
                                        member.name
                                    )}
                                </span>

                                <input
                                    type="number"
                                    class="custom-input"
                                    data-member="${esc(
                                        member.id
                                    )}"
                                    min="0"
                                    step="0.01"
                                    placeholder="₹0"
                                    value="${oldValue}"
                                >

                            </div>

                        `;
                    })
                    .join("")}

            </div>

            <div class="split-total">

                <span>Custom Total</span>

                <strong id="customTotal">
                    ₹0
                </strong>

            </div>
        `;

        updateCustomTotal();
    }


    document
        .querySelectorAll("[data-split]")
        .forEach(button => {

            button.onclick = () => {

                splitMode =
                    button.dataset.split;

                document
                    .querySelectorAll(
                        "[data-split]"
                    )
                    .forEach(btn => {

                        btn.classList.toggle(
                            "selected",
                            btn.dataset.split ===
                            splitMode
                        );
                    });

                renderCustomArea();
            };
        });


    document
        .querySelectorAll(".split-member")
        .forEach(input => {

            input.onchange = () => {

                if (
                    splitMode === "custom"
                ) {
                    renderCustomArea();
                }
            };
        });


    $("modalBody").addEventListener(
        "input",
        event => {

            if (
                event.target.classList.contains(
                    "custom-input"
                )
            ) {
                updateCustomTotal();
            }
        }
    );


    renderCustomArea();


    $("saveExpenseBtn").onclick =
        async () => {

            const name =
                $("expenseName")
                    .value
                    .trim();

            const amount =
                Number(
                    $("expenseAmount")
                        .value
                );

            const paidBy =
                $("expensePaidBy")
                    .value;

            const splitBetween =
                [
                    ...document.querySelectorAll(
                        ".split-member:checked"
                    )
                ].map(
                    input => input.value
                );


            if (!name) {

                toast(
                    "Enter expense name."
                );

                return;
            }

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                toast(
                    "Enter a valid amount."
                );

                return;
            }

            if (!paidBy) {

                toast(
                    "Select who paid."
                );

                return;
            }

            if (!splitBetween.length) {

                toast(
                    "Select at least one member."
                );

                return;
            }


            let customSplits = {};


            if (
                splitMode === "custom"
            ) {

                let total = 0;

                for (
                    const memberId
                    of splitBetween
                ) {

                    const input =
                        document.querySelector(
                            `.custom-input[data-member="${memberId}"]`
                        );

                    const value =
                        Number(
                            input?.value || 0
                        );

                    if (
                        !Number.isFinite(value) ||
                        value < 0
                    ) {

                        toast(
                            "Enter valid custom amounts."
                        );

                        return;
                    }

                    customSplits[memberId] =
                        value;

                    total += value;
                }

                if (
                    Math.abs(
                        total - amount
                    ) > 0.01
                ) {

                    toast(
                        `Custom split must equal ${money(amount)}`
                    );

                    return;
                }
            }


            const expenseId =
                exp?.id || uid();

            const expense = {

                id: expenseId,

                name,

                amount,

                paidBy,

                splitBetween,

                splitMode,

                customSplits,

                createdAt:
                    exp?.createdAt ||
                    new Date().toISOString()
            };


            try {

                /*
                   IMPORTANT:
                   Only update this particular expense.
                   Other phone's expenses will NOT be overwritten.
                */

                await set(
                    ref(
                        db,
                        `trips/${trip.id}/expenses/${expenseId}`
                    ),
                    expense
                );

                closeModal();

                toast(
                    isEdit
                        ? "Expense updated 💾"
                        : "Expense added 💸"
                );

            } catch (error) {

                console.error(error);

                toast(
                    "Could not save expense."
                );
            }
        };
}


/* =========================================================
   DELETE EXPENSE
========================================================= */

async function deleteExpense(id) {

    const trip = current();

    if (!trip) return;

    const expense =
        trip.expenses.find(
            e => e.id === id
        );

    if (!expense) return;

    if (
        !confirm(
            `Delete "${expense.name}"?`
        )
    ) {
        return;
    }

    try {

        await set(
            ref(
                db,
                `trips/${trip.id}/expenses/${id}`
            ),
            null
        );

        toast(
            "Expense deleted."
        );

    } catch (error) {

        console.error(error);

        toast(
            "Could not delete expense."
        );
    }
}


/* =========================================================
   SHARES
========================================================= */

function shares(exp) {

    const result = {};

    if (
        exp.splitMode === "custom"
    ) {

        for (
            const memberId of
            exp.splitBetween || []
        ) {

            result[memberId] =
                Number(
                    exp.customSplits?.[
                        memberId
                    ] || 0
                );
        }

        return result;
    }

    const ids =
        exp.splitBetween || [];

    const each =
        ids.length
            ? Number(exp.amount) /
              ids.length
            : 0;

    ids.forEach(id => {

        result[id] = each;
    });

    return result;
}


/* =========================================================
   BALANCES
========================================================= */

function balances() {

    const trip = current();

    if (!trip) return {};

    const result = {};

    trip.members.forEach(member => {

        result[member.id] = 0;
    });


    trip.expenses.forEach(exp => {

        const amount =
            Number(exp.amount || 0);

        if (
            result[exp.paidBy] !== undefined
        ) {

            result[exp.paidBy] += amount;
        }


        const split =
            shares(exp);


        Object.entries(split)
            .forEach(
                ([memberId, share]) => {

                    if (
                        result[memberId] !==
                        undefined
                    ) {

                        result[memberId] -=
                            Number(
                                share || 0
                            );
                    }
                }
            );
    });


    return result;
}


/* =========================================================
   SETTLEMENT
========================================================= */

function settlements() {

    const balance =
        balances();

    const debtors = [];
    const creditors = [];

    Object.entries(balance)
        .forEach(
            ([memberId, amount]) => {

                if (amount < -0.01) {

                    debtors.push({
                        id: memberId,
                        amount: -amount
                    });

                } else if (
                    amount > 0.01
                ) {

                    creditors.push({
                        id: memberId,
                        amount
                    });
                }
            }
        );


    const result = [];

    let d = 0;
    let c = 0;


    while (
        d < debtors.length &&
        c < creditors.length
    ) {

        const debtor =
            debtors[d];

        const creditor =
            creditors[c];

        const amount =
            Math.min(
                debtor.amount,
                creditor.amount
            );


        result.push({
            from: debtor.id,
            to: creditor.id,
            amount
        });


        debtor.amount -= amount;

        creditor.amount -= amount;


        if (
            debtor.amount <= 0.01
        ) {
            d++;
        }

        if (
            creditor.amount <= 0.01
        ) {
            c++;
        }
    }


    return result;
}


/* =========================================================
   MEMBER NAME
========================================================= */

function memberName(id) {

    const trip = current();

    const member =
        trip?.members.find(
            m => m.id === id
        );

    return member?.name || "Unknown";
}


/* =========================================================
   EMPTY
========================================================= */

function empty(title, text) {

    return `
        <div class="empty">
            <strong>${esc(title)}</strong>
            ${esc(text)}
        </div>
    `;
}


/* =========================================================
   RECENT EXPENSES
========================================================= */

function renderRecentExpenses() {

    const trip = current();

    const container =
        $("recentExpensesList");

    if (!trip || !container) return;

    const expenses =
        [...trip.expenses]
            .sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            )
            .slice(0, 3);


    if (!expenses.length) {

        container.innerHTML =
            empty(
                "No expenses yet",
                "Add your first trip expense."
            );

        return;
    }


    container.innerHTML =
        expenses.map(exp => `

            <div class="card expense-card">

                <div>

                    <b>
                        ${esc(exp.name)}
                    </b>

                    <small>
                        Paid by
                        ${esc(
                            memberName(
                                exp.paidBy
                            )
                        )}
                    </small>

                </div>

                <div class="expense-amount">
                    ${money(exp.amount)}
                </div>

            </div>

        `).join("");
}


/* =========================================================
   MEMBERS
========================================================= */

function renderMembers() {

    const trip = current();

    const container =
        $("membersList");

    if (!trip || !container) return;


    if (!trip.members.length) {

        container.innerHTML =
            empty(
                "No members",
                "Add friends to this trip."
            );

        return;
    }


    container.innerHTML =
        trip.members.map(
            (member, index) => `

            <div class="card member-card">

                <div class="avatar">
                    ${esc(
                        member.name
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <div>

                    <b>
                        ${esc(member.name)}
                    </b>

                    <small>
                        ${
                            index === 0
                                ? "Trip creator"
                                : "Member"
                        }
                    </small>

                </div>

            </div>

        `
        ).join("");
}


/* =========================================================
   EXPENSES
========================================================= */

function renderExpenses() {

    const trip = current();

    const container =
        $("expensesList");

    if (!trip || !container) return;


    if (!trip.expenses.length) {

        container.innerHTML =
            empty(
                "No expenses yet",
                "Add an expense to start splitting."
            );

        return;
    }


    const expenses =
        [...trip.expenses]
            .sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            );


    container.innerHTML =
        expenses.map(exp => `

            <div class="card">

                <div class="expense-card">

                    <div>

                        <b>
                            ${esc(exp.name)}
                        </b>

                        <small>
                            Paid by
                            ${esc(
                                memberName(
                                    exp.paidBy
                                )
                            )}
                        </small>

                        <small>
                            ${
                                exp.splitMode ===
                                "custom"
                                    ? "Custom split"
                                    : "Equal split"
                            }
                        </small>

                    </div>

                    <div class="expense-amount">
                        ${money(exp.amount)}
                    </div>

                </div>


                <div class="card-actions">

                    <button
                        class="mini-btn"
                        data-edit-expense="${esc(
                            exp.id
                        )}"
                    >
                        Edit
                    </button>

                    <button
                        class="mini-btn"
                        data-delete-expense="${esc(
                            exp.id
                        )}"
                    >
                        Delete
                    </button>

                </div>

            </div>

        `).join("");
}


/* =========================================================
   BALANCES
========================================================= */

function renderBalances() {

    const trip = current();

    const container =
        $("balancesList");

    if (!trip || !container) return;

    const balance =
        balances();


    container.innerHTML =
        trip.members.map(member => {

            const value =
                balance[member.id] || 0;

            let status = "Settled";

            if (value > 0.01) {

                status = "gets back";

            } else if (value < -0.01) {

                status = "owes";
            }


            const className =
                value > 0.01
                    ? "positive"
                    : value < -0.01
                        ? "negative"
                        : "";


            return `

                <div class="card balance-card">

                    <div>

                        <b>
                            ${esc(
                                member.name
                            )}
                        </b>

                        <small>
                            ${status}
                        </small>

                    </div>

                    <strong
                        class="${className}"
                    >
                        ${
                            value > 0.01
                                ? "+"
                                : ""
                        }${money(value)}
                    </strong>

                </div>

            `;

        }).join("");
}


/* =========================================================
   SETTLEMENT
========================================================= */

function renderSettlement() {

    const container =
        $("settlementList");

    if (!container) return;


    const list =
        settlements();


    if (!list.length) {

        container.innerHTML =
            empty(
                "All settled 🎉",
                "Nobody owes anything."
            );

        return;
    }


    container.innerHTML =
        list.map(item => `

            <div class="settlement-card">

                <div class="who">

                    <b>
                        ${esc(
                            memberName(
                                item.from
                            )
                        )}
                    </b>

                    <small>
                        needs to pay
                    </small>

                </div>

                <div class="settle-arrow">
                    →
                </div>

                <div class="who">

                    <b>
                        ${esc(
                            memberName(
                                item.to
                            )
                        )}
                    </b>

                </div>

                <div class="settle-money">
                    ${money(item.amount)}
                </div>

            </div>

        `).join("");
}


/* =========================================================
   RENDER TRIP
========================================================= */

function renderTrip() {

    const trip = current();

    if (!trip) {

        show("home");

        return;
    }


    $("tripTitle").textContent =
        trip.name;

    $("tripCode").textContent =
        trip.code;


    $("tripMemberCount").textContent =
        `${trip.members.length} ${
            trip.members.length === 1
                ? "member"
                : "members"
        }`;


    $("totalMembers").textContent =
        trip.members.length;


    const total =
        trip.expenses.reduce(
            (sum, exp) =>
                sum +
                Number(
                    exp.amount || 0
                ),
            0
        );


    $("totalExpense").textContent =
        money(total);


    renderRecentExpenses();
    renderMembers();
    renderExpenses();
    renderBalances();
    renderSettlement();


    const tripView =
        $("tripView");

    if (
        tripView &&
        !tripView.classList.contains(
            "active"
        )
    ) {

        show("trip");
    }
}


/* =========================================================
   SHARE
========================================================= */

async function shareTrip() {

    const trip = current();

    if (!trip) return;


    const text =
        `Join my TripSplit trip "${trip.name}" using code: ${trip.code}`;


    try {

        if (navigator.share) {

            await navigator.share({
                title: "TripSplit",
                text
            });

            return;
        }

    } catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {
            return;
        }
    }


    try {

        await navigator.clipboard.writeText(
            trip.code
        );

        toast(
            "Trip code copied 📋"
        );

    } catch (_) {

        toast(
            `Trip Code: ${trip.code}`
        );
    }
}


/* =========================================================
   COPY CODE
========================================================= */

async function copyCode() {

    const trip = current();

    if (!trip) return;

    try {

        await navigator.clipboard.writeText(
            trip.code
        );

        toast(
            "Trip code copied 📋"
        );

    } catch (_) {

        toast(
            `Trip Code: ${trip.code}`
        );
    }
}


/* =========================================================
   EVENTS
========================================================= */

$("createTripBtn")
    ?.addEventListener(
        "click",
        () => show("create")
    );


$("joinTripBtn")
    ?.addEventListener(
        "click",
        () => show("join")
    );


$("createConfirmBtn")
    ?.addEventListener(
        "click",
        createTrip
    );


$("joinConfirmBtn")
    ?.addEventListener(
        "click",
        joinTrip
    );


$("backBtn")
    ?.addEventListener(
        "click",
        () => show("home")
    );


$("homeBtn")
    ?.addEventListener(
        "click",
        () => {

            if (current()) {

                renderTrip();

                return;
            }

            show("home");
        }
    );


$("closeModal")
    ?.addEventListener(
        "click",
        closeModal
    );


$("modal")
    ?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("modal")
            ) {
                closeModal();
            }
        }
    );


$("copyCodeBtn")
    ?.addEventListener(
        "click",
        copyCode
    );


$("shareBtn")
    ?.addEventListener(
        "click",
        shareTrip
    );


$("addMemberBtn")
    ?.addEventListener(
        "click",
        addMember
    );


$("overviewAddMember")
    ?.addEventListener(
        "click",
        addMember
    );


$("addExpenseBtn")
    ?.addEventListener(
        "click",
        () => expenseForm()
    );


$("overviewAddExpense")
    ?.addEventListener(
        "click",
        () => expenseForm()
    );


/* =========================================================
   BOTTOM NAV
========================================================= */

document
    .querySelectorAll(".nav-item")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                openTab(
                    button.dataset.tab
                );
            }
        );
    });


/* =========================================================
   VIEW ALL
========================================================= */

document
    .querySelectorAll(
        '[data-tab]'
    )
    .forEach(button => {

        if (
            button.classList.contains(
                "nav-item"
            )
        ) {
            return;
        }

        button.addEventListener(
            "click",
            () => {

                const tab =
                    button.dataset.tab;

                if (
                    tab &&
                    current()
                ) {

                    openTab(tab);
                }
            }
        );
    });


/* =========================================================
   EXPENSE ACTIONS
========================================================= */

document.addEventListener(
    "click",
    event => {

        const editButton =
            event.target.closest(
                "[data-edit-expense]"
            );


        if (editButton) {

            const trip = current();

            const expense =
                trip?.expenses.find(
                    e =>
                        e.id ===
                        editButton
                            .dataset
                            .editExpense
                );


            if (expense) {

                expenseForm(
                    expense
                );
            }

            return;
        }


        const deleteButton =
            event.target.closest(
                "[data-delete-expense]"
            );


        if (deleteButton) {

            deleteExpense(
                deleteButton
                    .dataset
                    .deleteExpense
            );
        }
    }
);


/* =========================================================
   JOIN CODE
========================================================= */

$("joinCode")
    ?.addEventListener(
        "input",
        event => {

            event.target.value =
                event.target.value
                    .toUpperCase()
                    .replace(
                        /[^A-Z0-9]/g,
                        ""
                    )
                    .slice(0, 6);
        }
    );


/* =========================================================
   INITIAL LOAD
========================================================= */

async function loadCurrentTrip() {

    if (!state.currentId) {
        return false;
    }

    try {

        const snapshot =
            await get(
                ref(
                    db,
                    "trips/" +
                    state.currentId
                )
            );


        if (!snapshot.exists()) {

            localStorage.removeItem(
                CURRENT_KEY
            );

            state.currentId = null;

            return false;
        }


        const trip =
            normalizeTrip(
                snapshot.val(),
                state.currentId
            );


        state.trips[trip.id] =
            trip;

        cacheTrip(trip);

        subscribeToTrip(
            trip.id
        );

        renderTrip();

        return true;

    } catch (error) {

        console.error(error);

        try {

            const cached =
                JSON.parse(
                    localStorage.getItem(
                        CACHE_KEY
                    )
                );


            if (
                cached &&
                cached.id ===
                state.currentId
            ) {

                state.trips[
                    cached.id
                ] =
                    normalizeTrip(
                        cached
                    );

                renderTrip();

                toast(
                    "Offline mode."
                );

                return true;
            }

        } catch (_) {}


        toast(
            "Unable to connect to Firebase."
        );

        return false;
    }
}


/* =========================================================
   START
========================================================= */

(async function init() {

    const restored =
        await loadCurrentTrip();

    if (!restored) {
        show("home");
    }

})();