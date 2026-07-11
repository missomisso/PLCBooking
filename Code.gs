const SHEET_NAME = 'Bookings';
const COUNTER_KEY = 'BOOKING_COUNTER';
const ADMIN_EMAILS = ['lim_kian_seng@defence.gov.sg','plcbookingportal@gmail.com'];
const TIMEZONE = 'Asia/Singapore';

function doGet(e) {
  try {
    const action = normalize(e.parameter.action);

    if (!action) {
      return jsonOutput({ success: false, message: 'Missing action parameter.' });
    }

    ensureSheetExists();

    switch (action) {
      case 'createBooking':
        return withLock(function () { return createBooking(e); });
      case 'updateBooking':
        return withLock(function () { return updateBooking(e); });
      case 'cancelBooking':
        return withLock(function () { return cancelBooking(e); });
      case 'getSlots':
        return getSlots(e);
      case 'getBooking':
        return getBooking(e);
      case 'listBookings':
        return listBookings(e);
      default:
        return jsonOutput({ success: false, message: 'Invalid action.' });
    }
  } catch (error) {
    return jsonOutput({
      success: false,
      message: error.message || 'Unexpected error.'
    });
  }
}

/* -------------------------
   ONE-TIME RESET DO NOT USE UNLESS YOU WANT TO CLEAR DATA FROM THE SHEET
------------------------- */

function setupFreshBookingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  } else {
    sheet.clearContents();
    sheet.clearFormats();
  }

  sheet.getRange(1, 1, 1, 12).setValues([[
    'Timestamp',
    'Booking ID',
    'Rank & Name',
    'Unit',
    'Contact',
    'Email',
    'Event Name',
    'Venue',
    'Booking Date',
    'Booking Time',
    'Duration',
    'Status'
  ]]);

  // Format Booking Date and Booking Time columns as plain text so
  // Google Sheets never auto-converts them into Date objects.
  sheet.getRange('I:J').setNumberFormat('@');

  PropertiesService.getScriptProperties().setProperty(COUNTER_KEY, '0');
}

/* -------------------------
   Main actions
------------------------- */

function createBooking(e) {
  validateRequiredFields(e);

  const booking = buildBookingFromParams(e, {
    bookingId: generateBookingId(),
    status: 'Confirmed'
  });

  if (isSlotTaken(booking.bookingDate, booking.bookingTime, booking.venue, booking.duration, '')) {
    return jsonOutput({
      success: false,
      message: 'This slot overlaps with an existing booking for this venue.'
    });
  }

  const duplicateCheck = isDuplicatePersonBooking(
    booking.bookingDate,
    booking.bookingTime,
    booking.duration,
    booking.email,
    booking.contact,
    ''
  );

  if (duplicateCheck.duplicate) {
    return jsonOutput({
      success: false,
      message:
        'This person already has another active booking overlapping this date and time. Existing booking: ' +
        duplicateCheck.booking.bookingId
    });
  }

  getSheet().appendRow(bookingToRow(booking));
  SpreadsheetApp.flush();
  trySendEmails('created', booking);

  return jsonOutput({
    success: true,
    bookingId: booking.bookingId,
    booking: booking,
    message: 'Booking created successfully.'
  });
}

function updateBooking(e) {
  validateRequiredFields(e);

  const bookingId = normalize(e.parameter.bookingId);
  if (!bookingId) {
    return jsonOutput({ success: false, message: 'Missing booking ID.' });
  }

  const existing = findBookingRowById(bookingId);
  if (!existing) {
    return jsonOutput({ success: false, message: 'Booking ID not found.' });
  }

  if (isCancelled(existing.booking.status)) {
    return jsonOutput({ success: false, message: 'Cancelled bookings cannot be updated.' });
  }

  const booking = buildBookingFromParams(e, {
    bookingId: bookingId,
    status: 'Updated'
  });

  if (isSlotTaken(booking.bookingDate, booking.bookingTime, booking.venue, booking.duration, bookingId)) {
    return jsonOutput({
      success: false,
      message: 'This slot overlaps with another existing booking.'
    });
  }

  const duplicateCheck = isDuplicatePersonBooking(
    booking.bookingDate,
    booking.bookingTime,
    booking.duration,
    booking.email,
    booking.contact,
    bookingId
  );

  if (duplicateCheck.duplicate) {
    return jsonOutput({
      success: false,
      message:
        'This person already has another active booking overlapping this date and time. Existing booking: ' +
        duplicateCheck.booking.bookingId
    });
  }

  getSheet().getRange(existing.rowIndex, 1, 1, 12).setValues([bookingToRow(booking)]);
  SpreadsheetApp.flush();
  trySendEmails('updated', booking);

  return jsonOutput({
    success: true,
    bookingId: booking.bookingId,
    booking: booking,
    message: 'Booking updated successfully.'
  });
}

function cancelBooking(e) {
  const bookingId = normalize(e.parameter.bookingId);
  if (!bookingId) {
    return jsonOutput({ success: false, message: 'Missing booking ID.' });
  }

  const existing = findBookingRowById(bookingId);
  if (!existing) {
    return jsonOutput({ success: false, message: 'Booking ID not found.' });
  }

  if (isCancelled(existing.booking.status)) {
    return jsonOutput({
      success: true,
      bookingId: bookingId,
      booking: existing.booking,
      message: 'Booking is already cancelled.'
    });
  }

  const cancelledBooking = Object.assign({}, existing.booking, {
    timestamp: new Date(),
    status: 'Cancelled'
  });

  getSheet().getRange(existing.rowIndex, 1, 1, 12).setValues([bookingToRow(cancelledBooking)]);
  SpreadsheetApp.flush();
  trySendEmails('cancelled', cancelledBooking);

  return jsonOutput({
    success: true,
    bookingId: bookingId,
    booking: cancelledBooking,
    message: 'Booking cancelled successfully.'
  });
}

function getSlots(e) {
  const bookingDate = normalizeDateValue(e.parameter.bookingDate);
  const venue = normalize(e.parameter.venue);
  const excludeBookingId = normalize(e.parameter.excludeBookingId);

  if (!bookingDate) {
    return jsonOutput({ success: true, bookedSlots: [] });
  }

  const bookings = getAllBookings();
  const bookedSlots = [];

  bookings
    .filter(function (booking) {
      return booking.bookingDate === bookingDate &&
             (!venue || booking.venue === venue) &&
             !isCancelled(booking.status) &&
             booking.bookingId !== excludeBookingId;
    })
    .forEach(function (booking) {
      // Expand each booking into every hourly slot it covers,
      // so the frontend blocks the full duration, not just the start time.
      const start = toMinutes(normalizeBookingTime(booking.bookingTime));
      const end = start + parseDurationMinutes(booking.duration);

      for (var m = start; m < end; m += 60) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        bookedSlots.push(hh + ':' + mm);
      }
    });

  return jsonOutput({
    success: true,
    bookedSlots: unique(bookedSlots)
  });
}

function getBooking(e) {
  const bookingId = normalize(e.parameter.bookingId);
  const email = normalize(e.parameter.email).toLowerCase();

  if (!bookingId) {
    return jsonOutput({ success: false, message: 'Missing booking ID.' });
  }

  const existing = findBookingRowById(bookingId);
  if (!existing) {
    return jsonOutput({ success: false, message: 'Booking not found.' });
  }

  if (email && normalize(existing.booking.email).toLowerCase() !== email) {
    return jsonOutput({ success: false, message: 'Booking ID and email do not match.' });
  }

  return jsonOutput({
    success: true,
    booking: existing.booking
  });
}

function listBookings(e) {
  const venue = normalize(e.parameter.venue);
  let bookings = getAllBookings();

  if (venue) {
    bookings = bookings.filter(function (booking) {
      return booking.venue === venue;
    });
  }

  bookings.sort(function (a, b) {
    const aKey = a.bookingDate + ' ' + a.bookingTime;
    const bKey = b.bookingDate + ' ' + b.bookingTime;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  return jsonOutput({
    success: true,
    bookings: bookings
  });
}

/* -------------------------
   Validation
------------------------- */

function validateRequiredFields(e) {
  const required = [
    'rankName',
    'unit',
    'contact',
    'email',
    'eventName',
    'venue',
    'bookingDate',
    'bookingTime',
    'duration'
  ];

  for (var i = 0; i < required.length; i++) {
    const field = required[i];
    if (!normalize(e.parameter[field])) {
      throw new Error('Missing required field: ' + field);
    }
  }

  if (!isValidEmail(normalize(e.parameter.email))) {
    throw new Error('Invalid email address.');
  }

  if (parseDurationMinutes(normalize(e.parameter.duration), -1) <= 0) {
    throw new Error('Invalid duration.');
  }
}

function isSlotTaken(bookingDate, bookingTime, venue, duration, excludeBookingId) {
  const bookings = getAllBookings();
  const normalizedDate = normalizeDateValue(bookingDate);
  const newStart = toMinutes(normalizeBookingTime(bookingTime));
  const newEnd = newStart + parseDurationMinutes(duration);

  for (var i = 0; i < bookings.length; i++) {
    const booking = bookings[i];

    if (booking.venue !== venue) continue;
    if (normalizeDateValue(booking.bookingDate) !== normalizedDate) continue;
    if (isCancelled(booking.status)) continue;
    if (booking.bookingId === excludeBookingId) continue;

    const existingStart = toMinutes(normalizeBookingTime(booking.bookingTime));
    const existingEnd = existingStart + parseDurationMinutes(booking.duration);

    // Interval overlap: new starts before existing ends AND existing starts before new ends
    if (newStart < existingEnd && existingStart < newEnd) {
      return true;
    }
  }

  return false;
}

function isDuplicatePersonBooking(bookingDate, bookingTime, duration, email, contact, excludeBookingId) {
  const bookings = getAllBookings();
  const normalizedDate = normalizeDateValue(bookingDate);
  const normalizedEmail = normalize(email).toLowerCase();
  const normalizedContact = normalize(contact);
  const newStart = toMinutes(normalizeBookingTime(bookingTime));
  const newEnd = newStart + parseDurationMinutes(duration);

  for (var i = 0; i < bookings.length; i++) {
    const booking = bookings[i];

    if (normalizeDateValue(booking.bookingDate) !== normalizedDate) continue;
    if (isCancelled(booking.status)) continue;
    if (booking.bookingId === excludeBookingId) continue;

    const sameEmail = normalize(booking.email).toLowerCase() === normalizedEmail;
    const sameContact = normalize(booking.contact) === normalizedContact;
    if (!sameEmail && !sameContact) continue;

    const existingStart = toMinutes(normalizeBookingTime(booking.bookingTime));
    const existingEnd = existingStart + parseDurationMinutes(booking.duration);

    if (newStart < existingEnd && existingStart < newEnd) {
      return {
        duplicate: true,
        booking: booking
      };
    }
  }

  return {
    duplicate: false,
    booking: null
  };
}

/* -------------------------
   Time / duration helpers
------------------------- */

function toMinutes(timeStr) {
  const parts = String(timeStr || '').split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);

  if (isNaN(hours) || isNaN(minutes)) return 0;

  return hours * 60 + minutes;
}

function parseDurationMinutes(duration, fallbackMinutes) {
  // Handles values like "2", "2 hours", "2h", "1.5", "1.5 hrs"
  const num = parseFloat(String(duration || '').replace(/[^\d.]/g, ''));

  if (isNaN(num) || num <= 0) {
    return typeof fallbackMinutes === 'number' ? fallbackMinutes : 60;
  }

  return num * 60;
}

function isCancelled(status) {
  return normalize(status).toLowerCase() === 'cancelled';
}

/* -------------------------
   Data normalization
------------------------- */

function normalizeBookingTime(value) {
  const raw = normalize(value);

  if (!raw) return '';

  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = tryParseDate(raw);
  if (parsed) {
    return Utilities.formatDate(parsed, TIMEZONE, 'HH:mm');
  }

  return raw;
}

function normalizeDateValue(value) {
  const raw = normalize(value);

  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = tryParseDate(raw);
  if (parsed) {
    return Utilities.formatDate(parsed, TIMEZONE, 'yyyy-MM-dd');
  }

  return raw;
}

function tryParseDate(value) {
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {}

  return null;
}

/* -------------------------
   Sheet helpers
------------------------- */

function ensureSheetExists() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, 12).setValues([[
      'Timestamp',
      'Booking ID',
      'Rank & Name',
      'Unit',
      'Contact',
      'Email',
      'Event Name',
      'Venue',
      'Booking Date',
      'Booking Time',
      'Duration',
      'Status'
    ]]);
    sheet.getRange('I:J').setNumberFormat('@');
  }
}

function getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Bookings sheet not found.');
  return sheet;
}

function getAllBookings() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  return values.map(rowToBooking);
}

function findBookingRowById(bookingId) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

  for (var i = 0; i < values.length; i++) {
    const booking = rowToBooking(values[i]);
    if (booking.bookingId === bookingId) {
      return {
        rowIndex: i + 2,
        booking: booking
      };
    }
  }

  return null;
}

function rowToBooking(row) {
  return {
    timestamp: row[0],
    bookingId: normalize(row[1]),
    rankName: normalize(row[2]),
    unit: normalize(row[3]),
    contact: normalize(row[4]),
    email: normalize(row[5]),
    eventName: normalize(row[6]),
    venue: normalize(row[7]),
    bookingDate: normalizeDateValue(row[8]),
    bookingTime: normalizeBookingTime(row[9]),
    duration: normalize(row[10]),
    status: normalize(row[11])
  };
}

function bookingToRow(booking) {
  return [
    booking.timestamp || new Date(),
    booking.bookingId,
    booking.rankName,
    booking.unit,
    booking.contact,
    booking.email,
    booking.eventName,
    booking.venue,
    normalizeDateValue(booking.bookingDate),
    normalizeBookingTime(booking.bookingTime),
    booking.duration,
    booking.status
  ];
}

function buildBookingFromParams(e, overrides) {
  const booking = {
    timestamp: new Date(),
    bookingId: normalize(e.parameter.bookingId),
    rankName: normalize(e.parameter.rankName),
    unit: normalize(e.parameter.unit),
    contact: normalize(e.parameter.contact),
    email: normalize(e.parameter.email),
    eventName: normalize(e.parameter.eventName),
    venue: normalize(e.parameter.venue),
    bookingDate: normalizeDateValue(e.parameter.bookingDate),
    bookingTime: normalizeBookingTime(e.parameter.bookingTime),
    duration: normalize(e.parameter.duration),
    status: normalize(e.parameter.status)
  };

  return Object.assign(booking, overrides || {});
}

/* -------------------------
   Email
------------------------- */

function trySendEmails(type, booking) {
  try {
    sendBookingEmails(type, booking);
  } catch (error) {
    console.error('Email sending failed: ' + error.message);
  }
}

function sendBookingEmails(type, booking) {
  const subjectMap = {
    created: 'Booking Confirmed',
    updated: 'Booking Updated',
    cancelled: 'Booking Cancelled'
  };

  const actionLabel = subjectMap[type] || 'Booking Notification';
  const subject = actionLabel + ' - ' + booking.bookingId;

  const userBody =
    'Hello ' + booking.rankName + ',\n\n' +
    'Your booking has been processed.\n\n' +
    'Booking ID: ' + booking.bookingId + '\n' +
    'Venue: ' + booking.venue + '\n' +
    'Date: ' + booking.bookingDate + '\n' +
    'Time: ' + booking.bookingTime + '\n' +
    'Duration: ' + booking.duration + '\n' +
    'Event: ' + booking.eventName + '\n' +
    'Status: ' + booking.status + '\n';

  const adminBody =
    'A booking has been processed.\n\n' +
    'Booking ID: ' + booking.bookingId + '\n' +
    'Rank & Name: ' + booking.rankName + '\n' +
    'Unit: ' + booking.unit + '\n' +
    'Contact: ' + booking.contact + '\n' +
    'Email: ' + booking.email + '\n' +
    'Event: ' + booking.eventName + '\n' +
    'Venue: ' + booking.venue + '\n' +
    'Date: ' + booking.bookingDate + '\n' +
    'Time: ' + booking.bookingTime + '\n' +
    'Status: ' + booking.status;

  if (booking.email) {
    MailApp.sendEmail({
      to: booking.email,
      subject: subject,
      body: userBody,
      name: 'PLC Booking System'
    });
  }

  if (ADMIN_EMAILS.length > 0) {
    MailApp.sendEmail({
      to: ADMIN_EMAILS.join(','),
      subject: '[Admin] ' + subject,
      body: adminBody,
      name: 'PLC Booking System'
    });
  }
}

/* -------------------------
   Utilities
------------------------- */

function withLock(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    return callback();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function generateBookingId() {
  const props = PropertiesService.getScriptProperties();
  const current = Number(props.getProperty(COUNTER_KEY) || '0') + 1;
  props.setProperty(COUNTER_KEY, String(current));
  return 'BK' + String(current).padStart(4, '0');
}

function normalize(value) {
  return String(value || '').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function unique(arr) {
  const seen = {};
  const result = [];

  for (var i = 0; i < arr.length; i++) {
    const value = arr[i];
    if (!seen[value]) {
      seen[value] = true;
      result.push(value);
    }
  }

  return result;
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
