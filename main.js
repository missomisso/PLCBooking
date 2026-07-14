const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwpFuNMN38yWBRnucBVXOtXILMWCyzBTDQa5y945_o4pBXycL0ZAQvbiOBcsx-CZOpxlg/exec";

const mainRefreshBookingsBtn = document.getElementById("mainRefreshBookingsBtn");
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

async function loadMainBookings() {
  const data = await apiRequest({
    action: "listBookings"
  });

  if (!data.success) {
    throw new Error(data.message || "Failed to load bookings.");
  }

  mainAllBookings = Array.isArray(data.bookings) ? data.bookings : [];

  if (typeof window.refreshBookingCalendar === "function") {
    window.refreshBookingCalendar();
  }
}

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

(async function init() {
  try {
    await loadMainBookings();
  } catch (error) {
    mainSetStatus(error.message || "Failed to load bookings.", "error");
  }
})();
