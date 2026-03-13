const CONFIG = {
  venue: "PLC Football Field",
  slotDuration: "2 hours",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxCWYpy7J1wIKPK5hOIzg6TtDzqn_1VI_DjuWf6ZTEx5kA6T1kEWHDwlSQf8IEZk5XY-Q/exec"
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
const bookingsDateFilter = document.getElementById("bookingsDateFilter");
const refreshBookingsBtn = document.getElementById("refreshBookingsBtn");
const clearDateFilterBtn = document.getElementById("clearDateFilterBtn");

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
  errorText.className = "rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700";
}

function clearError() {
  errorText.textContent = "";
  errorText.className = "hidden rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700";
}

function setStatus(message, type = "info") {
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

function formatIsoDateToDisplay(isoDate) {
  if (!isoDate) return "-";

  const parts = String(isoDate).split("-");
  if (parts.length !== 3) return String(isoDate);

  const [year, month, day] = parts.map(Number);
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return String(isoDate);

  return formatDisplayDate(d);
}

function normalizeTimeString(value) {
  if (!value) return "-";

  const raw = String(value).trim();

  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

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

function getStatusBadge(status) {
  const value = String(status || "").toLowerCase();

  if (value === "confirmed") {
    return `<span class="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Confirmed</span>`;
  }
  if (value === "updated") {
    return `<span class="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">Updated</span>`;
  }
  if (value === "cancelled") {
    return `<span class="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Cancelled</span>`;
  }

  return `<span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">${escapeHtml(status || "-")}</span>`;
}

function buildContactLink(booking) {
  const email = (booking.email || "").trim();

  if (!email) {
    return `<span class="text-xs font-semibold text-slate-400">No email</span>`;
  }

  const subject = encodeURIComponent(`PLC Booking Enquiry - ${booking.bookingId || ""}`);
  const body = encodeURIComponent(
    `Hi ${booking.rankName || ""},\n\nI’m contacting you regarding your booking for ${CONFIG.venue} on ${formatIsoDateToDisplay(booking.bookingDate || "")} at ${normalizeTimeString(booking.bookingTime || "")}.\n\nRegards,`
  );

  return `
    <a
      class="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
      href="mailto:${email}?subject=${subject}&body=${body}"
    >
      Contact
    </a>
  `;
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
  } catch (networkError) {
    throw new Error("Failed to fetch. Check Apps Script URL or deployment.");
  }

  const rawText = await response.text();

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (parseError) {
    throw new Error(`Apps Script did not return valid JSON: ${rawText.slice(0, 200)}`);
  }

  return data;
}

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

function updateSummary() {
  summary.date.textContent = state.selectedDate ? formatDisplayDate(state.selectedDate) : "-";
  summary.time.textContent = state.selectedSlot || "-";
  summary.rankName.textContent = inputs.rankName.value || "-";
  summary.unit.textContent = inputs.unit.value || "-";
  summary.contact.textContent = inputs.contact.value || "-";
  summary.email.textContent = inputs.email.value || "-";
  summary.event.textContent = inputs.eventName.value || "-";
  summary.bookingId.textContent = state.currentBookingId || "-";
  summary.status.textContent = state.currentStatus || "Draft";

  selectedDateTime.textContent =
    state.selectedDate && state.selectedSlot
      ? `${formatDisplayDate(state.selectedDate)} • ${state.selectedSlot}`
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

    let className =
      "h-11 sm:h-12 rounded-2xl text-sm sm:text-[15px] font-bold transition border ";

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
      state.filterBySelectedDate = true;

      if (bookingsDateFilter) {
        bookingsDateFilter.value = "";
      }

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

    const bookingForThisSlot = state.allBookings.find((booking) => {
      const sameDate =
        state.selectedDate &&
        booking.bookingDate === getIsoDate(state.selectedDate);

      const sameTime = normalizeTimeString(booking.bookingTime) === time;
      const sameVenue = booking.venue === CONFIG.venue;
      const active = booking.status !== "Cancelled";
      const differentBooking = booking.bookingId !== state.currentBookingId;

      return sameDate && sameTime && sameVenue && active && differentBooking;
    });

    const isDisabled = !!bookingForThisSlot;
    const isSelected = state.selectedSlot === time;

    let className =
      "w-full rounded-2xl border p-4 text-left transition min-h-[92px] ";

    if (isSelected) {
      className += "bg-slate-900 text-white border-slate-900 shadow-md";
    } else if (isDisabled) {
      className += "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed";
      btn.disabled = true;
    } else {
      className += "bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:shadow-sm hover:-translate-y-[1px]";
    }

    btn.className = className;

    btn.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-base font-extrabold">${time}</div>
          <div class="mt-1 text-xs sm:text-sm ${isSelected ? "text-slate-200" : isDisabled ? "text-slate-400" : "text-slate-500"}">
            ${bookingForThisSlot ? `Booked by ${escapeHtml(bookingForThisSlot.rankName)}` : "Available"}
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

function renderBookingsTable() {
  try {
    if (!bookingsTableBody) {
      setStatus("Bookings table body not found in HTML.", "error");
      return;
    }

    let bookings = Array.isArray(state.allBookings) ? [...state.allBookings] : [];
    const selectedFilterDate = bookingsDateFilter ? bookingsDateFilter.value : "";

    if (selectedFilterDate) {
      bookings = bookings.filter((booking) => booking.bookingDate === selectedFilterDate);
      if (selectedDateLabel) {
        selectedDateLabel.textContent = `Showing bookings for ${formatIsoDateToDisplay(selectedFilterDate)}.`;
      }
    } else if (state.filterBySelectedDate && state.selectedDate) {
      const selectedIsoDate = getIsoDate(state.selectedDate);
      bookings = bookings.filter((booking) => booking.bookingDate === selectedIsoDate);
      if (selectedDateLabel) {
        selectedDateLabel.textContent = `Showing bookings for ${formatDisplayDate(state.selectedDate)}.`;
      }
    } else {
      if (selectedDateLabel) {
        selectedDateLabel.textContent = "Showing all bookings. Select a date to filter.";
      }
    }

    bookings.sort((a, b) => {
      const aKey = `${a.bookingDate || ""} ${normalizeTimeString(a.bookingTime || "")}`;
      const bKey = `${b.bookingDate || ""} ${normalizeTimeString(b.bookingTime || "")}`;
      return aKey.localeCompare(bKey);
    });

    if (!bookings.length) {
      bookingsTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">
            No bookings found.
          </td>
        </tr>
      `;
      return;
    }

    bookingsTableBody.innerHTML = bookings.map((booking) => `
      <tr class="border-b border-slate-100">
        <td class="px-4 py-3">${getStatusBadge(booking.status)}</td>
        <td class="px-4 py-3">${escapeHtml(formatIsoDateToDisplay(booking.bookingDate || ""))}</td>
        <td class="px-4 py-3">${escapeHtml(normalizeTimeString(booking.bookingTime || ""))}</td>
        <td class="px-4 py-3">${escapeHtml(booking.rankName || "-")}</td>
        <td class="px-4 py-3">${escapeHtml(booking.unit || "-")}</td>
        <td class="px-4 py-3">${escapeHtml(booking.contact || "-")}</td>
        <td class="px-4 py-3">${escapeHtml(booking.eventName || "-")}</td>
        <td class="px-4 py-3">${escapeHtml(booking.venue || "-")}</td>
        <td class="px-4 py-3">${buildContactLink(booking)}</td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("renderBookingsTable failed:", error);
    setStatus(`Failed while rendering bookings table: ${error.message}`, "error");
  }
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
    monthSelect.value = state.currentMonth;
    yearSelect.value = state.currentYear;
  }

  state.selectedSlot = normalizeTimeString(booking.bookingTime) || null;
  state.filterBySelectedDate = true;

  if (bookingsDateFilter) {
    bookingsDateFilter.value = "";
  }

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
  confirmDateTime.textContent = `${formatDisplayDate(state.selectedDate)} • ${state.selectedSlot}`;
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
  try {
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
  } catch (error) {
    console.error("loadAllBookings failed:", error);
    setStatus(error.message || "Failed to load bookings.", "error");
  }
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

  if (bookingsDateFilter) {
    bookingsDateFilter.value = "";
  }

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
document.getElementById("backBtn").addEventListener("click", () => {
  window.history.back();
});

if (bookingsDateFilter) {
  bookingsDateFilter.addEventListener("change", () => {
    state.filterBySelectedDate = false;
    renderBookingsTable();
  });
}

if (refreshBookingsBtn) {
  refreshBookingsBtn.addEventListener("click", async () => {
    try {
      setStatus("Refreshing bookings...", "info");
      await loadAllBookings();
      clearStatus();
    } catch (error) {
      setStatus(error.message || "Failed to refresh bookings.", "error");
    }
  });
}

if (clearDateFilterBtn) {
  clearDateFilterBtn.addEventListener("click", () => {
    if (bookingsDateFilter) {
      bookingsDateFilter.value = "";
    }
    state.filterBySelectedDate = false;
    renderBookingsTable();
  });
}

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

    if (!data.success) {
      throw new Error(data.message || "Something went wrong.");
    }

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