const CURRENT_VENUE = window.BOOKING_VENUE || {
  key: "football",
  name: "PLC Football Field"
};

const CONFIG = {
  venue: CURRENT_VENUE.name,
  slotDuration: "2 hours",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxnZoACAnTQMGBXR7Wk5yp8tZCl1O8JXv9O6gxcB9Bbk6VP3bAIz9ihzWEoEY2eG2mw6Q/exec"
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const slotTimes = [
  "00:00", "02:00",
  "06:00", "08:00",
  "10:00", "12:00",
  "14:00", "16:00",
  "18:00", "20:00"
];

const state = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  selectedDate: null,
  selectedSlot: null,
  allBookings: [],
  currentBookingId: null,
  currentStatus: "Draft",
  isEditingExistingBooking: false
};

const pageTitle = document.getElementById("pageTitle");
const summaryVenue = document.getElementById("summaryVenue");
const venueBadge = document.getElementById("venueBadge");

const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");
const calendarGrid = document.getElementById("calendarGrid");
const slotsContainer = document.getElementById("slots");
const selectedDateTime = document.getElementById("selectedDateTime");

const form = document.getElementById("bookingForm");
const submitBtn = document.getElementById("submitBtn");
const errorText = document.getElementById("errorText");
const statusText = document.getElementById("statusText");
const confirmationBox = document.getElementById("confirmationBox");
const confirmDateTime = document.getElementById("confirmDateTime");
const confirmBookingId = document.getElementById("confirmBookingId");
const footerActions = document.getElementById("footerActions");

const inputs = {
  rankName: document.getElementById("rankName"),
  unit: document.getElementById("unit"),
  contact: document.getElementById("contact"),
  email: document.getElementById("email"),
  eventName: document.getElementById("eventName")
};

const summary = {
  date: document.getElementById("summaryDate"),
  time: document.getElementById("summaryTime"),
  rankName: document.getElementById("summaryRankName"),
  unit: document.getElementById("summaryUnit"),
  contact: document.getElementById("summaryContact"),
  email: document.getElementById("summaryEmail"),
  event: document.getElementById("summaryEvent"),
  bookingId: document.getElementById("summaryBookingId"),
  status: document.getElementById("summaryStatus")
};

function applyVenueToPage() {
  const pageNames = {
    "PLC Football Field": "Football Field",
    "PLC Basketball Court": "Basketball Court"
  };

  const venueBadges = {
    "PLC Football Field": "⚽ Football",
    "PLC Basketball Court": "🏀 Basketball"
  };

  const shortName = pageNames[CONFIG.venue] || CONFIG.venue;
  const badgeLabel = venueBadges[CONFIG.venue] || shortName;

  document.title = shortName;

  if (pageTitle) pageTitle.textContent = shortName;
  if (summaryVenue) summaryVenue.textContent = shortName;
  if (venueBadge) venueBadge.textContent = badgeLabel;
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
  if (!errorText) return;
  errorText.textContent = message;
  errorText.className = "rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700";
}

function clearError() {
  if (!errorText) return;
  errorText.textContent = "";
  errorText.className = "hidden rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700";
}

function setStatus(message, type = "info") {
  if (!statusText) return;
  statusText.textContent = message;

  if (type === "success") {
    statusText.className = "rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700";
  } else if (type === "error") {
    statusText.className = "rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700";
  } else {
    statusText.className = "rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700";
  }
}

function clearStatus() {
  if (!statusText) return;
  statusText.textContent = "";
  statusText.className = "hidden rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700";
}

function getIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("en-SG", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function normalizeTimeString(value) {
  if (!value) return "-";
  const raw = String(value).trim();

  if (/^\d{2}:\d{2}$/.test(raw)) return raw;

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  return raw;
}

async function apiRequest(params) {
  const url = new URL(CONFIG.appsScriptUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value ?? "");
  });

  let response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
      redirect: "follow",
      cache: "no-store"
    });
  } catch {
    throw new Error("Failed to fetch. Check Apps Script URL or deployment.");
  }

  const rawText = await response.text();

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`Apps Script did not return valid JSON: ${rawText.slice(0, 200)}`);
  }
}

function populateSelectors() {
  if (!monthSelect || !yearSelect) return;

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

function updateSummary() {
  if (!summary.date) return;

  summary.date.textContent = state.selectedDate ? formatDisplayDate(state.selectedDate) : "-";
  summary.time.textContent = state.selectedSlot || "-";
  summary.rankName.textContent = inputs.rankName.value || "-";
  summary.unit.textContent = inputs.unit.value || "-";
  summary.contact.textContent = inputs.contact.value || "-";
  summary.email.textContent = inputs.email.value || "-";
  summary.event.textContent = inputs.eventName.value || "-";
  summary.bookingId.textContent = state.currentBookingId || "-";
  summary.status.textContent = state.currentStatus || "Draft";

  if (selectedDateTime) {
    selectedDateTime.textContent =
      state.selectedDate && state.selectedSlot
        ? `${formatDisplayDate(state.selectedDate)} • ${state.selectedSlot}`
        : "Select a date and slot";
  }
}

function renderCalendar() {
  if (!calendarGrid) return;
  calendarGrid.innerHTML = "";

  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  const startDayIndex = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < startDayIndex; i++) {
    const empty = document.createElement("div");
    empty.className = "h-11 sm:h-12";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = day;

    const thisDate = new Date(state.currentYear, state.currentMonth, day);
    thisDate.setHours(0, 0, 0, 0);

    const isToday = thisDate.getTime() === today.getTime();
    const isPast = thisDate.getTime() < today.getTime();
    const isSelected =
      state.selectedDate &&
      thisDate.getTime() === new Date(state.selectedDate).setHours(0, 0, 0, 0);

    let className = "h-11 sm:h-12 rounded-2xl text-sm sm:text-[15px] font-bold transition border ";

    if (isPast) {
      className += "bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed";
      btn.disabled = true;
    } else if (isSelected) {
      className += "bg-slate-900 text-white border-slate-900 shadow-sm";
    } else if (isToday) {
      className += "bg-white text-slate-900 border-blue-300 hover:bg-blue-50";
    } else {
      className += "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300";
    }

    btn.className = className;

    btn.addEventListener("click", () => {
      state.selectedDate = thisDate;
      state.selectedSlot = null;
      renderCalendar();
      updateSummary();
      hideConfirmation();
      renderSlots();
    });

    calendarGrid.appendChild(btn);
  }
}

function renderSlots() {
  if (!slotsContainer) return;
  slotsContainer.innerHTML = "";

  slotTimes.forEach((time) => {
    const btn = document.createElement("button");
    btn.type = "button";

    const bookingForThisSlot = state.allBookings.find((booking) => {
      const sameDate = state.selectedDate && booking.bookingDate === getIsoDate(state.selectedDate);
      const sameTime = normalizeTimeString(booking.bookingTime) === time;
      const sameVenue = booking.venue === CONFIG.venue;
      const active = booking.status !== "Cancelled";
      const differentBooking = booking.bookingId !== state.currentBookingId;

      return sameDate && sameTime && sameVenue && active && differentBooking;
    });

    const isDisabled = !!bookingForThisSlot;
    const isSelected = state.selectedSlot === time;

    let className = "w-full rounded-2xl border p-4 text-left transition min-h-[92px] ";

    if (isSelected) {
      className += "bg-slate-900 text-white border-slate-900 shadow-md";
    } else if (isDisabled) {
      className += "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed";
      btn.disabled = true;
    } else {
      className += "bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:shadow-sm hover:-translate-y-[1px]";
    }

    const bookedLabel = bookingForThisSlot
      ? `Booked by ${escapeHtml(bookingForThisSlot.rankName || "-")}, ${escapeHtml(bookingForThisSlot.contact || "-")}`
      : "Available";

    btn.className = className;
    btn.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-base font-extrabold">${time}</div>
          <div class="mt-1 text-xs sm:text-sm ${isSelected ? "text-slate-200" : isDisabled ? "text-slate-400" : "text-slate-500"}">
            ${bookedLabel}
          </div>
        </div>
        <div class="shrink-0">
          <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
            isSelected
              ? "bg-slate-700 text-white"
              : isDisabled
              ? "bg-slate-200 text-slate-500"
              : "bg-emerald-50 text-emerald-700"
          }">
            ${isDisabled ? "Booked" : "Open"}
          </span>
        </div>
      </div>
    `;

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      state.selectedSlot = time;
      updateSummary();
      hideConfirmation();
      clearError();
      renderSlots();
    });

    slotsContainer.appendChild(btn);
  });
}

function hideConfirmation() {
  if (confirmationBox) confirmationBox.classList.add("hidden");
  if (footerActions) footerActions.classList.add("hidden");
}

function showConfirmation() {
  if (confirmDateTime) {
    confirmDateTime.textContent = `${formatDisplayDate(state.selectedDate)} • ${state.selectedSlot}`;
  }
  if (confirmBookingId) {
    confirmBookingId.textContent = `Booking ID: ${state.currentBookingId || "-"}`;
  }
  if (confirmationBox) confirmationBox.classList.remove("hidden");
  if (footerActions) footerActions.classList.remove("hidden");
}

function getFormPayload() {
  return {
    rankName: inputs.rankName.value.trim(),
    unit: inputs.unit.value.trim(),
    contact: inputs.contact.value.trim(),
    email: inputs.email.value.trim(),
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
}

function loadBookingIntoForm(booking) {
  inputs.rankName.value = booking.rankName || "";
  inputs.unit.value = booking.unit || "";
  inputs.contact.value = booking.contact || "";
  inputs.email.value = booking.email || "";
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
    if (monthSelect) monthSelect.value = state.currentMonth;
    if (yearSelect) yearSelect.value = state.currentYear;
  }

  state.selectedSlot = normalizeTimeString(booking.bookingTime) || null;

  submitBtn.textContent = booking.status === "Cancelled" ? "Submit Booking" : "Save Changes";

  updateSummary();
  renderCalendar();
  renderSlots();
  clearError();

  if (booking.status === "Cancelled") {
    hideConfirmation();
    setStatus(`Loaded cancelled booking ${booking.bookingId}.`, "info");
  } else {
    showConfirmation();
    setStatus(`Loaded booking ${booking.bookingId}. You can edit or cancel it.`, "info");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
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

    if (!data.success) throw new Error(data.message || "Cancel failed.");

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
  const bookingIdInput = document.getElementById("searchBookingId");
  const emailInput = document.getElementById("searchEmail");

  const bookingId = bookingIdInput ? bookingIdInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";

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

if (monthSelect) {
  monthSelect.addEventListener("change", () => {
    state.currentMonth = Number(monthSelect.value);
    renderCalendar();
  });
}

if (yearSelect) {
  yearSelect.addEventListener("change", () => {
    state.currentYear = Number(yearSelect.value);
    renderCalendar();
  });
}

const prevMonthBtn = document.getElementById("prevMonth");
if (prevMonthBtn) {
  prevMonthBtn.addEventListener("click", () => {
    state.currentMonth--;
    if (state.currentMonth < 0) {
      state.currentMonth = 11;
      state.currentYear--;
    }
    if (monthSelect) monthSelect.value = state.currentMonth;
    if (yearSelect) yearSelect.value = state.currentYear;
    renderCalendar();
  });
}

const nextMonthBtn = document.getElementById("nextMonth");
if (nextMonthBtn) {
  nextMonthBtn.addEventListener("click", () => {
    state.currentMonth++;
    if (state.currentMonth > 11) {
      state.currentMonth = 0;
      state.currentYear++;
    }
    if (monthSelect) monthSelect.value = state.currentMonth;
    if (yearSelect) yearSelect.value = state.currentYear;
    renderCalendar();
  });
}

const todayBtn = document.getElementById("todayBtn");
if (todayBtn) {
  todayBtn.addEventListener("click", () => {
    const today = new Date();
    state.currentMonth = today.getMonth();
    state.currentYear = today.getFullYear();
    state.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    state.selectedSlot = null;

    if (monthSelect) monthSelect.value = state.currentMonth;
    if (yearSelect) yearSelect.value = state.currentYear;

    renderCalendar();
    updateSummary();
    renderSlots();
  });
}

Object.values(inputs).forEach((input) => {
  if (input) input.addEventListener("input", updateSummary);
});

const resetBtn = document.getElementById("resetBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    setTimeout(() => {
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
    }, 0);
  });
}

const changeBookingBtn = document.getElementById("changeBookingBtn");
if (changeBookingBtn) {
  changeBookingBtn.addEventListener("click", () => {
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
}

const cancelBookingBtn = document.getElementById("cancelBookingBtn");
if (cancelBookingBtn) cancelBookingBtn.addEventListener("click", cancelBooking);

const findBookingBtn = document.getElementById("findBookingBtn");
if (findBookingBtn) findBookingBtn.addEventListener("click", findBooking);

if (form) {
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
        const sameTime = normalizeTimeString(booking.bookingTime) === state.selectedSlot;
        const sameVenue = booking.venue === CONFIG.venue;
        const active = booking.status !== "Cancelled";
        const differentBooking = booking.bookingId !== state.currentBookingId;

        return sameDate && sameTime && sameVenue && active && differentBooking;
      });

      if (conflict) {
        throw new Error(
          `This slot is already booked by ${conflict.rankName}. It can only be booked again if that booking is cancelled.`
        );
      }

      const wasEditing = !!state.currentBookingId;
      const data = wasEditing ? await updateBooking() : await createBooking();

      if (!data.success) throw new Error(data.message || "Something went wrong.");

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
}

(async function init() {
  applyVenueToPage();
  populateSelectors();
  renderCalendar();
  updateSummary();

  try {
    await loadAllBookings();
  } catch (error) {
    setStatus(error.message || "Failed to load initial bookings.", "error");
  }
})();