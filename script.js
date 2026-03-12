const CONFIG = {
  venue: "PLC Football Field",
  slotDuration: "2 hours",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbzFgY7aQIhqfM1BQIXvkcVd3y28wIKTZmgOk21M8Fd1fxunrPJ_5QGqTpcOHazfhT_Hjw/exec"
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
  bookedSlots: [],
  currentBookingId: null,
  currentStatus: "Draft",
  isEditingExistingBooking: false
};

const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");
const calendarGrid = document.getElementById("calendarGrid");
const slotsContainer = document.getElementById("slots");
const selectedDateTime = document.getElementById("selectedDateTime");
const summaryDate = document.getElementById("summaryDate");
const summaryTime = document.getElementById("summaryTime");
const summaryName = document.getElementById("summaryName");
const summaryUnit = document.getElementById("summaryUnit");
const summaryEvent = document.getElementById("summaryEvent");
const summaryBookingId = document.getElementById("summaryBookingId");
const summaryStatus = document.getElementById("summaryStatus");
const form = document.getElementById("bookingForm");
const errorText = document.getElementById("errorText");
const statusText = document.getElementById("statusText");
const confirmationBox = document.getElementById("confirmationBox");
const confirmDateTime = document.getElementById("confirmDateTime");
const confirmBookingId = document.getElementById("confirmBookingId");
const footerActions = document.getElementById("footerActions");
const submitBtn = document.getElementById("submitBtn");

const emailInput = document.getElementById("email");
const rankInput = document.getElementById("rank");
const nameInput = document.getElementById("name");
const unitInput = document.getElementById("unit");
const eventInput = document.getElementById("eventName");
const contactInput = document.getElementById("contact");

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

function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.className = `status-text show ${type}`;
}

function clearStatus() {
  statusText.textContent = "";
  statusText.className = "status-text";
}

function updateSummaryFields() {
  summaryName.textContent = nameInput.value || "-";
  summaryUnit.textContent = unitInput.value || "-";
  summaryEvent.textContent = eventInput.value || "-";
  summaryBookingId.textContent = state.currentBookingId || "-";
  summaryStatus.textContent = state.currentStatus;
}

function updateHeader() {
  const dateText = state.selectedDate ? formatDate(state.selectedDate) : "No date selected";
  const timeText = state.selectedSlot ? state.selectedSlot : "No slot selected";

  selectedDateTime.textContent =
    state.selectedDate && state.selectedSlot
      ? `${dateText}, ${timeText}`
      : "Select a date and slot";

  summaryDate.textContent = state.selectedDate ? formatDate(state.selectedDate) : "-";
  summaryTime.textContent = state.selectedSlot || "-";

  updateSummaryFields();
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  const startDayIndex = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const today = new Date();

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

    const isToday =
      day === today.getDate() &&
      state.currentMonth === today.getMonth() &&
      state.currentYear === today.getFullYear();

    const isSelected =
      state.selectedDate &&
      day === state.selectedDate.getDate() &&
      state.currentMonth === state.selectedDate.getMonth() &&
      state.currentYear === state.selectedDate.getFullYear();

    if (isToday) btn.classList.add("today-ring");
    if (isSelected) btn.classList.add("selected");

    btn.addEventListener("click", async () => {
      state.selectedDate = thisDate;
      state.selectedSlot = null;
      renderCalendar();
      updateHeader();
      hideConfirmation();
      await loadUnavailableSlotsForSelectedDate();
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

    const isBookedByOthers = state.bookedSlots.includes(time);
    const isCurrentSelection = state.selectedSlot === time;

    if (isCurrentSelection) btn.classList.add("selected");

    if (isBookedByOthers && !isCurrentSelection) {
      btn.classList.add("disabled");
      btn.disabled = true;
    }

    btn.innerHTML = `
      <span class="slot-time">${time}</span>
      <span class="slot-sub">${isBookedByOthers && !isCurrentSelection ? "Unavailable" : "1 slot"}</span>
    `;

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      state.selectedSlot = time;
      renderSlots();
      updateHeader();
      hideConfirmation();
    });

    slotsContainer.appendChild(btn);
  });
}

function hideConfirmation() {
  confirmationBox.classList.remove("show");
  footerActions.classList.remove("show");
}

function getFormData() {
  return {
    email: emailInput.value.trim(),
    rank: rankInput.value.trim(),
    name: nameInput.value.trim(),
    unit: unitInput.value.trim(),
    eventName: eventInput.value.trim(),
    contact: contactInput.value.trim(),
    venue: CONFIG.venue,
    bookingDate: state.selectedDate ? getIsoDate(state.selectedDate) : "",
    bookingDateDisplay: state.selectedDate ? formatDate(state.selectedDate) : "",
    bookingTime: state.selectedSlot || "",
    duration: CONFIG.slotDuration,
    bookingId: state.currentBookingId || "",
    status: state.currentStatus
  };
}

async function apiRequest(params) {
  const url = new URL(CONFIG.appsScriptUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error("Network error.");
  }

  return response.json();
}

async function loadUnavailableSlotsForSelectedDate() {
  if (!state.selectedDate) {
    state.bookedSlots = [];
    renderSlots();
    return;
  }

  try {
    setStatus("Loading slot availability...", "info");

    const data = await apiRequest({
      action: "getSlots",
      bookingDate: getIsoDate(state.selectedDate),
      venue: CONFIG.venue,
      excludeBookingId: state.currentBookingId || ""
     });

    if (data.success) {
      state.bookedSlots = Array.isArray(data.bookedSlots) ? data.bookedSlots : [];
      renderSlots();
      clearStatus();
    } else {
      state.bookedSlots = [];
      renderSlots();
      setStatus(data.message || "Could not load slots.", "error");
    }
  } catch (error) {
    state.bookedSlots = [];
    renderSlots();
    setStatus("Failed to load slot availability.", "error");
  }
}

async function createBooking() {
  const payload = getFormData();

  const data = await apiRequest({
    action: "createBooking",
    email: payload.email,
    rank: payload.rank,
    name: payload.name,
    unit: payload.unit,
    eventName: payload.eventName,
    contact: payload.contact,
    venue: payload.venue,
    bookingDate: payload.bookingDate,
    bookingTime: payload.bookingTime,
    duration: payload.duration
  });

  return data;
}

async function updateBooking() {
  const payload = getFormData();

  const data = await apiRequest({
    action: "updateBooking",
    bookingId: payload.bookingId,
    email: payload.email,
    rank: payload.rank,
    name: payload.name,
    unit: payload.unit,
    eventName: payload.eventName,
    contact: payload.contact,
    venue: payload.venue,
    bookingDate: payload.bookingDate,
    bookingTime: payload.bookingTime,
    duration: payload.duration
  });

  return data;
}

async function cancelBooking() {
  if (!state.currentBookingId) {
    setStatus("No booking found to cancel.", "error");
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

    if (data.success) {
      state.currentStatus = "Cancelled";
      updateSummaryFields();
      hideConfirmation();
      setStatus(`Booking ${state.currentBookingId} cancelled.`, "success");
      await loadUnavailableSlotsForSelectedDate();
    } else {
      setStatus(data.message || "Unable to cancel booking.", "error");
    }
  } catch (error) {
    setStatus("Failed to cancel booking.", "error");
  }
}

function fillConfirmationBox() {
  const text = `${formatDate(state.selectedDate)}, ${state.selectedSlot}`;
  confirmDateTime.textContent = text;
  confirmBookingId.textContent = `Booking ID: ${state.currentBookingId || "-"}`;

  confirmationBox.classList.add("show");
  footerActions.classList.add("show");
}

function resetFormState() {
  state.selectedSlot = null;
  state.currentBookingId = null;
  state.currentStatus = "Draft";
  state.isEditingExistingBooking = false;
  submitBtn.textContent = "Submit Booking";
  hideConfirmation();
  errorText.style.display = "none";
  clearStatus();
  updateSummaryFields();
  renderSlots();
  updateHeader();
}

monthSelect.addEventListener("change", async (e) => {
  state.currentMonth = Number(e.target.value);
  renderCalendar();
  hideConfirmation();
});

yearSelect.addEventListener("change", async (e) => {
  state.currentYear = Number(e.target.value);
  renderCalendar();
  hideConfirmation();
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
  hideConfirmation();
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
  hideConfirmation();
});

document.getElementById("todayBtn").addEventListener("click", async () => {
  const today = new Date();
  state.currentMonth = today.getMonth();
  state.currentYear = today.getFullYear();
  state.selectedDate = today;
  state.selectedSlot = null;
  monthSelect.value = state.currentMonth;
  yearSelect.value = state.currentYear;
  renderCalendar();
  updateHeader();
  hideConfirmation();
  await loadUnavailableSlotsForSelectedDate();
});

[nameInput, unitInput, eventInput].forEach((input) => {
  input.addEventListener("input", updateSummaryFields);
});

document.getElementById("resetBtn").addEventListener("click", () => {
  setTimeout(() => {
    resetFormState();
  }, 0);
});

document.getElementById("changeBookingBtn").addEventListener("click", async () => {
  if (!state.currentBookingId) {
    setStatus("No booking found to change.", "error");
    return;
  }

  state.isEditingExistingBooking = true;
  state.currentStatus = "Pending Update";
  submitBtn.textContent = "Save Changes";
  updateSummaryFields();
  hideConfirmation();
  setStatus(`Editing booking ${state.currentBookingId}. Update the date, slot, or form details, then click Save Changes.`, "info");
  await loadUnavailableSlotsForSelectedDate();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("cancelBookingBtn").addEventListener("click", cancelBooking);

document.getElementById("backBtn").addEventListener("click", () => {
  window.history.back();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!state.selectedDate || !state.selectedSlot) {
    errorText.style.display = "block";
    hideConfirmation();
    return;
  }

  errorText.style.display = "none";

  try {
    submitBtn.disabled = true;
    setStatus(state.isEditingExistingBooking ? "Updating booking..." : "Creating booking...", "info");

    let data;
    if (state.isEditingExistingBooking && state.currentBookingId) {
      data = await updateBooking();
    } else {
      data = await createBooking();
    }

    if (!data.success) {
      setStatus(data.message || "Something went wrong.", "error");
      submitBtn.disabled = false;
      return;
    }

    state.currentBookingId = data.bookingId || state.currentBookingId;
    state.currentStatus = state.isEditingExistingBooking ? "Updated" : "Confirmed";
    state.isEditingExistingBooking = false;
    submitBtn.textContent = "Submit Booking";

    updateSummaryFields();
    fillConfirmationBox();
    setStatus(
      state.currentStatus === "Updated"
        ? `Booking ${state.currentBookingId} updated successfully.`
        : `Booking ${state.currentBookingId} created successfully.`,
      "success"
    );

    await loadUnavailableSlotsForSelectedDate();
    confirmationBox.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus("Failed to save booking. Check your Apps Script URL and deployment settings.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

populateSelectors();
renderCalendar();
renderSlots();
updateHeader();