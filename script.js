const CONFIG = {
  venue: "PLC Football Field",
  slotDuration: "2 hours",
  appsScriptUrl: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE"
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const slotTimes = [
  "12:00 AM", "2:00 AM",
  "6:00 AM", "8:00 AM",
  "10:00 AM", "12:00 PM",
  "2:00 PM", "4:00 PM",
  "6:00 PM", "8:00 PM"
];

const state = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  selectedDate: null,
  selectedSlot: null,
  allBookings: [],
  currentBookingId: null,
  currentStatus: "Draft",
  isEditingExistingBooking: false,
  filterBySelectedDate: false
};

const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");
const calendarGrid = document.getElementById("calendarGrid");
const slotsContainer = document.getElementById("slots");
const selectedDateTime = document.getElementById("selectedDateTime");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const bookingsTableBody = document.getElementById("bookingsTableBody");
const form = document.getElementById("bookingForm");
const submitBtn = document.getElementById("submitBtn");
const errorText = document.getElementById("errorText");
const statusText = document.getElementById("statusText");
const confirmationBox = document.getElementById("confirmationBox");
const confirmDateTime = document.getElementById("confirmDateTime");
const confirmBookingId = document.getElementById("confirmBookingId");
const footerActions = document.getElementById("footerActions");

const inputs = {
  email: document.getElementById("email"),
  contact: document.getElementById("contact"),
  rank: document.getElementById("rank"),
  unit: document.getElementById("unit"),
  name: document.getElementById("name"),
  eventName: document.getElementById("eventName")
};

const summary = {
  date: document.getElementById("summaryDate"),
  time: document.getElementById("summaryTime"),
  name: document.getElementById("summaryName"),
  rank: document.getElementById("summaryRank"),
  unit: document.getElementById("summaryUnit"),
  email: document.getElementById("summaryEmail"),
  contact: document.getElementById("summaryContact"),
  event: document.getElementById("summaryEvent"),
  bookingId: document.getElementById("summaryBookingId"),
  status: document.getElementById("summaryStatus")
};

function populateSelectors() {
  monthSelect.innerHTML = "";
  yearSelect.innerHTML = "";

  monthNames.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = month;
    if (index === state.currentMonth) option.selected = true;
    monthSelect.appendChild(option);
  });

  for (let year = 2024; year <= 2035; year++) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    if (year === state.currentYear) option.selected = true;
    yearSelect.appendChild(option);
  }
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()].slice(0, 3);
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function getIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setError(message) {
  errorText.textContent = message;
  errorText.className = "error-text show";
}

function clearError() {
  errorText.textContent = "";
  errorText.className = "error-text";
}

function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.className = `status-text show ${type}`;
}

function clearStatus() {
  statusText.textContent = "";
  statusText.className = "status-text";
}

async function apiRequest(params) {
  const url = new URL(CONFIG.appsScriptUrl);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value ?? "");
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow"
  });

  const rawText = await response.text();

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`Non-JSON response: ${rawText.slice(0, 200)}`);
  }

  return data;
}

function updateSummary() {
  summary.date.textContent = state.selectedDate ? formatDate(state.selectedDate) : "-";
  summary.time.textContent = state.selectedSlot || "-";
  summary.name.textContent = inputs.name.value || "-";
  summary.rank.textContent = inputs.rank.value || "-";
  summary.unit.textContent = inputs.unit.value || "-";
  summary.email.textContent = inputs.email.value || "-";
  summary.contact.textContent = inputs.contact.value || "-";
  summary.event.textContent = inputs.eventName.value || "-";
  summary.bookingId.textContent = state.currentBookingId || "-";
  summary.status.textContent = state.currentStatus || "Draft";

  selectedDateTime.textContent =
    state.selectedDate && state.selectedSlot
      ? `${formatDate(state.selectedDate)} • ${state.selectedSlot}`
      : "Select a date and slot";
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  const startDayIndex = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < startDayIndex; i++) {
    const empty = document.createElement("button");
    empty.className = "day empty";
    empty.disabled = true;
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day++) {
    const btn = document.createElement("button");
    btn.className = "day";
    btn.textContent = day;

    const thisDate = new Date(state.currentYear, state.currentMonth, day);
    thisDate.setHours(0, 0, 0, 0);

    const isToday = thisDate.getTime() === today.getTime();
    const isPast = thisDate.getTime() < today.getTime();
    const isSelected =
      state.selectedDate &&
      thisDate.getTime() === new Date(state.selectedDate).setHours(0, 0, 0, 0);

    if (isToday) btn.classList.add("today");
    if (isSelected) btn.classList.add("selected");
    if (isPast) {
      btn.classList.add("past");
      btn.disabled = true;
    }

    btn.addEventListener("click", async () => {
      state.selectedDate = thisDate;
      state.selectedSlot = null;
      state.filterBySelectedDate = true;
      renderCalendar();
      updateSummary();
      hideConfirmation();
      renderSlots();
      renderBookingsTable();
    });

    calendarGrid.appendChild(btn);
  }
}

function renderSlots() {
  slotsContainer.innerHTML = "";

  slotTimes.forEach((time) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot-btn";

    const bookingForThisSlot = state.allBookings.find((booking) => {
      const sameDate = state.selectedDate && booking.bookingDate === getIsoDate(state.selectedDate);
      const sameTime = booking.bookingTime === time;
      const sameVenue = booking.venue === CONFIG.venue;
      const active = booking.status !== "Cancelled";
      const differentBooking = booking.bookingId !== state.currentBookingId;
      return sameDate && sameTime && sameVenue && active && differentBooking;
    });

    const isDisabled = !!bookingForThisSlot;
    const isSelected = state.selectedSlot === time;

    if (isSelected) btn.classList.add("selected");
    if (isDisabled && !isSelected) {
      btn.classList.add("disabled");
      btn.disabled = true;
    }

    btn.innerHTML = `
      <span class="slot-time">${time}</span>
      <span class="slot-sub">${
        bookingForThisSlot
          ? `Booked by ${escapeHtml(bookingForThisSlot.name)}`
          : "Available"
      }</span>
    `;

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      state.selectedSlot = time;
      updateSummary();
      hideConfirmation();
      clearError();
    });

    slotsContainer.appendChild(btn);
  });
}

function getStatusBadge(status) {
  const value = String(status || "").toLowerCase();

  if (value === "confirmed") {
    return `<span class="status-badge status-confirmed">Confirmed</span>`;
  }
  if (value === "updated") {
    return `<span class="status-badge status-updated">Updated</span>`;
  }
  if (value === "cancelled") {
    return `<span class="status-badge status-cancelled">Cancelled</span>`;
  }

  return `<span class="status-badge">${escapeHtml(status || "-")}</span>`;
}

function renderBookingsTable() {
  let bookings = [...state.allBookings];

  if (state.filterBySelectedDate && state.selectedDate) {
    const selectedIsoDate = getIsoDate(state.selectedDate);
    bookings = bookings.filter((booking) => booking.bookingDate === selectedIsoDate);
    selectedDateLabel.textContent = `Showing bookings for ${formatDate(state.selectedDate)}.`;
  } else {
    selectedDateLabel.textContent = "Showing all bookings. Select a date to filter.";
  }

  bookings.sort((a, b) => {
    const aKey = `${a.bookingDate} ${a.bookingTime}`;
    const bKey = `${b.bookingDate} ${b.bookingTime}`;
    return aKey.localeCompare(bKey);
  });

  if (!bookings.length) {
    bookingsTableBody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-cell">No bookings found.</td>
      </tr>
    `;
    return;
  }

  bookingsTableBody.innerHTML = bookings.map((booking) => `
    <tr>
      <td>${escapeHtml(booking.bookingId)}</td>
      <td>${getStatusBadge(booking.status)}</td>
      <td>${escapeHtml(booking.bookingDate)}</td>
      <td>${escapeHtml(booking.bookingTime)}</td>
      <td>${escapeHtml(booking.name)}</td>
      <td>${escapeHtml(booking.rank)}</td>
      <td>${escapeHtml(booking.unit)}</td>
      <td>${escapeHtml(booking.email)}</td>
      <td>${escapeHtml(booking.contact)}</td>
      <td>${escapeHtml(booking.eventName)}</td>
      <td>${escapeHtml(booking.venue)}</td>
      <td>
        <button class="table-load-btn" type="button" data-booking-id="${escapeHtml(booking.bookingId)}">
          Load
        </button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".table-load-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const bookingId = button.getAttribute("data-booking-id");
      const booking = state.allBookings.find((item) => item.bookingId === bookingId);
      if (booking) {
        loadBookingIntoForm(booking);
      }
    });
  });
}

function loadBookingIntoForm(booking) {
  inputs.email.value = booking.email || "";
  inputs.contact.value = booking.contact || "";
  inputs.rank.value = booking.rank || "";
  inputs.unit.value = booking.unit || "";
  inputs.name.value = booking.name || "";
  inputs.eventName.value = booking.eventName || "";

  state.currentBookingId = booking.bookingId || null;
  state.currentStatus = booking.status || "Draft";
  state.isEditingExistingBooking = booking.status !== "Cancelled";

  if (booking.bookingDate) {
    const [year, month, day] = booking.bookingDate.split("-").map(Number);
    const selected = new Date(year, month - 1, day);
    state.selectedDate = selected;
    state.currentMonth = selected.getMonth();
    state.currentYear = selected.getFullYear();
    monthSelect.value = state.currentMonth;
    yearSelect.value = state.currentYear;
  }

  state.selectedSlot = booking.bookingTime || null;
  state.filterBySelectedDate = true;

  submitBtn.textContent = booking.status === "Cancelled" ? "Submit Booking" : "Save Changes";

  updateSummary();
  renderCalendar();
  renderSlots();
  renderBookingsTable();
  hideConfirmation();
  clearError();
  setStatus(`Loaded booking ${booking.bookingId}.`, "info");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideConfirmation() {
  confirmationBox.classList.add("hidden");
  footerActions.classList.add("hidden");
}

function showConfirmation() {
  confirmDateTime.textContent = `${formatDate(state.selectedDate)} • ${state.selectedSlot}`;
  confirmBookingId.textContent = `Booking ID: ${state.currentBookingId || "-"}`;
  confirmationBox.classList.remove("hidden");
  footerActions.classList.remove("hidden");
}

function resetBookingState() {
  state.selectedSlot = null;
  state.currentBookingId = null;
  state.currentStatus = "Draft";
  state.isEditingExistingBooking = false;
  submitBtn.textContent = "Submit Booking";
  hideConfirmation();
  clearError();
  clearStatus();
  updateSummary();
  renderSlots();
}

function getFormPayload() {
  return {
    email: inputs.email.value.trim(),
    contact: inputs.contact.value.trim(),
    rank: inputs.rank.value.trim(),
    unit: inputs.unit.value.trim(),
    name: inputs.name.value.trim(),
    eventName: inputs.eventName.value.trim(),
    venue: CONFIG.venue,
    bookingDate: state.selectedDate ? getIsoDate(state.selectedDate) : "",
    bookingTime: state.selectedSlot || "",
    duration: CONFIG.slotDuration,
    bookingId: state.currentBookingId || ""
  };
}

async function loadAllBookings() {
  const data = await apiRequest({
    action: "listBookings",
    venue: CONFIG.venue
  });

  if (!data.success) {
    throw new Error(data.message || "Failed to load bookings.");
  }

  state.allBookings = Array.isArray(data.bookings) ? data.bookings : [];
  renderSlots();
  renderBookingsTable();
}

async function createBooking() {
  return apiRequest({
    action: "createBooking",
    ...getFormPayload()
  });
}

async function updateBooking() {
  return apiRequest({
    action: "updateBooking",
    ...getFormPayload()
  });
}

async function cancelBooking() {
  if (!state.currentBookingId) {
    setStatus("No booking loaded to cancel.", "error");
    return;
  }

  const confirmed = window.confirm("Are you sure you want to cancel this booking?");
  if (!confirmed) return;

  try {
    setStatus("Cancelling booking...", "info");

    const data = await apiRequest({
      action: "cancelBooking",
      bookingId: state.currentBookingId
    });

    if (!data.success) {
      throw new Error(data.message || "Cancel failed.");
    }

    state.currentStatus = "Cancelled";
    updateSummary();
    hideConfirmation();
    setStatus(`Booking ${state.currentBookingId} cancelled successfully.`, "success");
    await loadAllBookings();
  } catch (error) {
    setStatus(error.message || "Failed to cancel booking.", "error");
  }
}

async function findBooking() {
  const bookingId = document.getElementById("searchBookingId").value.trim();
  const email = document.getElementById("searchEmail").value.trim();

  if (!bookingId) {
    setStatus("Please enter a Booking ID.", "error");
    return;
  }

  try {
    setStatus("Loading booking...", "info");

    const data = await apiRequest({
      action: "getBooking",
      bookingId,
      email
    });

    if (!data.success || !data.booking) {
      throw new Error(data.message || "Booking not found.");
    }

    loadBookingIntoForm(data.booking);
  } catch (error) {
    setStatus(error.message || "Failed to load booking.", "error");
  }
}

monthSelect.addEventListener("change", () => {
  state.currentMonth = Number(monthSelect.value);
  renderCalendar();
});

yearSelect.addEventListener("change", () => {
  state.currentYear = Number(yearSelect.value);
  renderCalendar();
});

document.getElementById("prevMonth").addEventListener("click", () => {
  state.currentMonth--;
  if (state.currentMonth < 0) {
    state.currentMonth = 11;
    state.currentYear--;
  }
  monthSelect.value = state.currentMonth;
  yearSelect.value = state.currentYear;
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  state.currentMonth++;
  if (state.currentMonth > 11) {
    state.currentMonth = 0;
    state.currentYear++;
  }
  monthSelect.value = state.currentMonth;
  yearSelect.value = state.currentYear;
  renderCalendar();
});

document.getElementById("todayBtn").addEventListener("click", () => {
  const today = new Date();
  state.currentMonth = today.getMonth();
  state.currentYear = today.getFullYear();
  state.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  state.selectedSlot = null;
  state.filterBySelectedDate = true;
  monthSelect.value = state.currentMonth;
  yearSelect.value = state.currentYear;
  renderCalendar();
  updateSummary();
  renderSlots();
  renderBookingsTable();
});

Object.values(inputs).forEach((input) => {
  input.addEventListener("input", updateSummary);
});

document.getElementById("resetBtn").addEventListener("click", () => {
  setTimeout(() => {
    resetBookingState();
  }, 0);
});

document.getElementById("changeBookingBtn").addEventListener("click", () => {
  if (!state.currentBookingId) {
    setStatus("No booking loaded to change.", "error");
    return;
  }

  state.isEditingExistingBooking = true;
  state.currentStatus = "Updated";
  submitBtn.textContent = "Save Changes";
  hideConfirmation();
  updateSummary();
  setStatus(`Editing booking ${state.currentBookingId}. Make your changes and save.`, "info");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("cancelBookingBtn").addEventListener("click", cancelBooking);
document.getElementById("findBookingBtn").addEventListener("click", findBooking);

document.getElementById("refreshBookingsBtn").addEventListener("click", async () => {
  try {
    setStatus("Refreshing bookings...", "info");
    await loadAllBookings();
    clearStatus();
  } catch (error) {
    setStatus(error.message || "Failed to refresh bookings.", "error");
  }
});

document.getElementById("clearDateFilterBtn").addEventListener("click", () => {
  state.filterBySelectedDate = false;
  renderBookingsTable();
});

document.getElementById("backBtn").addEventListener("click", () => {
  window.history.back();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  if (!state.selectedDate || !state.selectedSlot) {
    setError("Please select a date and time slot before submitting.");
    return;
  }

  try {
    submitBtn.disabled = true;
    setStatus(state.currentBookingId ? "Saving booking..." : "Creating booking...", "info");

    await loadAllBookings();

    const selectedDateIso = getIsoDate(state.selectedDate);

    const conflict = state.allBookings.find((booking) => {
      const sameDate = booking.bookingDate === selectedDateIso;
      const sameTime = booking.bookingTime === state.selectedSlot;
      const sameVenue = booking.venue === CONFIG.venue;
      const active = booking.status !== "Cancelled";
      const differentBooking = booking.bookingId !== state.currentBookingId;
      return sameDate && sameTime && sameVenue && active && differentBooking;
    });

    if (conflict) {
      throw new Error(`This slot is already booked by ${conflict.name}. Please choose another slot.`);
    }

    const data = state.currentBookingId ? await updateBooking() : await createBooking();

    if (!data.success) {
      throw new Error(data.message || "Something went wrong.");
    }

    const wasEditing = !!state.currentBookingId;

    state.currentBookingId = data.bookingId || state.currentBookingId;
    state.currentStatus = wasEditing ? "Updated" : "Confirmed";
    state.isEditingExistingBooking = false;
    submitBtn.textContent = "Submit Booking";

    updateSummary();
    showConfirmation();
    setStatus(`Booking ${state.currentBookingId} saved successfully.`, "success");

    await loadAllBookings();
  } catch (error) {
    setStatus(error.message || "Failed to save booking.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

(async function init() {
  populateSelectors();
  renderCalendar();
  renderSlots();
  updateSummary();

  try {
    await loadAllBookings();
  } catch (error) {
    setStatus(error.message || "Failed to load initial bookings.", "error");
  }
})();