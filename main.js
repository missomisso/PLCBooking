const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxnZoACAnTQMGBXR7Wk5yp8tZCl1O8JXv9O6gxcB9Bbk6VP3bAIz9ihzWEoEY2eG2mw6Q/exec";

const mainBookingsTableBody = document.getElementById("mainBookingsTableBody");
const mainSelectedDateLabel = document.getElementById("mainSelectedDateLabel");
const mainBookingsDateFilter = document.getElementById("mainBookingsDateFilter");
const mainVenueFilter = document.getElementById("mainVenueFilter");
const mainBookingsSearchInput = document.getElementById("mainBookingsSearchInput");
const mainBookingsStatusFilter = document.getElementById("mainBookingsStatusFilter");
const mainRefreshBookingsBtn = document.getElementById("mainRefreshBookingsBtn");
const mainClearFiltersBtn = document.getElementById("mainClearFiltersBtn");
const mainStatusText = document.getElementById("mainStatusText");

let mainAllBookings = [];

function mainSetStatus(message, type = "info") {
  if (!mainStatusText) return;
  mainStatusText.textContent = message;

  if (type === "success") {
    mainStatusText.className = "mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700";
  } else if (type === "error") {
    mainStatusText.className = "mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700";
  } else {
    mainStatusText.className = "mb-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700";
  }
}

function mainClearStatus() {
  if (!mainStatusText) return;
  mainStatusText.textContent = "";
  mainStatusText.className = "hidden mb-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  return formatDisplayDate(new Date(year, month - 1, day));
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

  const subject = encodeURIComponent(`PLC Booking Enquiry - ${booking.venue || ""}`);
  const body = encodeURIComponent(
    `Hi ${booking.rankName || ""},\n\nI’m contacting you regarding your booking for ${booking.venue || ""} on ${formatIsoDateToDisplay(booking.bookingDate || "")} at ${normalizeTimeString(booking.bookingTime || "")}.\n\nRegards,`
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
  const url = new URL(APPS_SCRIPT_URL);
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

function renderMainBookingsTable() {
  if (!mainBookingsTableBody) return;

  let bookings = [...mainAllBookings];

  const dateFilter = mainBookingsDateFilter ? mainBookingsDateFilter.value : "";
  const venueFilter = mainVenueFilter ? mainVenueFilter.value : "";
  const searchTerm = mainBookingsSearchInput ? mainBookingsSearchInput.value.trim().toLowerCase() : "";
  const statusFilter = mainBookingsStatusFilter ? mainBookingsStatusFilter.value.trim().toLowerCase() : "";

  if (dateFilter) {
    bookings = bookings.filter((booking) => booking.bookingDate === dateFilter);
    if (mainSelectedDateLabel) {
      mainSelectedDateLabel.textContent = `Showing bookings for ${formatIsoDateToDisplay(dateFilter)}.`;
    }
  } else {
    if (mainSelectedDateLabel) {
      mainSelectedDateLabel.textContent = "Showing all bookings. Filter by date, venue, search term, or status.";
    }
  }

  if (venueFilter) {
    bookings = bookings.filter((booking) => booking.venue === venueFilter);
  }

  if (searchTerm) {
    bookings = bookings.filter((booking) => {
      const haystack = [
        booking.rankName,
        booking.unit,
        booking.eventName,
        booking.contact,
        booking.venue
      ].join(" ").toLowerCase();

      return haystack.includes(searchTerm);
    });
  }

  if (statusFilter) {
    bookings = bookings.filter((booking) =>
      String(booking.status || "").toLowerCase() === statusFilter
    );
  }

  bookings.sort((a, b) => {
    const aKey = `${a.bookingDate || ""} ${normalizeTimeString(a.bookingTime || "")}`;
    const bKey = `${b.bookingDate || ""} ${normalizeTimeString(b.bookingTime || "")}`;
    return aKey.localeCompare(bKey);
  });

  if (!bookings.length) {
    mainBookingsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">
          No bookings found.
        </td>
      </tr>
    `;
    return;
  }

  mainBookingsTableBody.innerHTML = bookings.map((booking) => `
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
}

async function loadMainBookings() {
  const data = await apiRequest({
    action: "listBookings"
  });

  if (!data.success) {
    throw new Error(data.message || "Failed to load bookings.");
  }

  mainAllBookings = Array.isArray(data.bookings) ? data.bookings : [];
  renderMainBookingsTable();
}

if (mainBookingsDateFilter) mainBookingsDateFilter.addEventListener("change", renderMainBookingsTable);
if (mainVenueFilter) mainVenueFilter.addEventListener("change", renderMainBookingsTable);
if (mainBookingsSearchInput) mainBookingsSearchInput.addEventListener("input", renderMainBookingsTable);
if (mainBookingsStatusFilter) mainBookingsStatusFilter.addEventListener("change", renderMainBookingsTable);

if (mainRefreshBookingsBtn) {
  mainRefreshBookingsBtn.addEventListener("click", async () => {
    try {
      mainSetStatus("Refreshing bookings...", "info");
      await loadMainBookings();
      mainClearStatus();
    } catch (error) {
      mainSetStatus(error.message || "Failed to refresh bookings.", "error");
    }
  });
}

if (mainClearFiltersBtn) {
  mainClearFiltersBtn.addEventListener("click", () => {
    if (mainBookingsDateFilter) mainBookingsDateFilter.value = "";
    if (mainVenueFilter) mainVenueFilter.value = "";
    if (mainBookingsSearchInput) mainBookingsSearchInput.value = "";
    if (mainBookingsStatusFilter) mainBookingsStatusFilter.value = "";
    renderMainBookingsTable();
  });
}

(async function init() {
  try {
    await loadMainBookings();
  } catch (error) {
    mainSetStatus(error.message || "Failed to load bookings.", "error");
  }
})();