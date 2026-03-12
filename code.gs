const SHEET_NAME = 'Bookings';

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();

    if (!action) {
      return jsonOutput({
        success: false,
        message: 'Missing action parameter.'
      });
    }

    ensureSheetExists();

    switch (action) {
      case 'createBooking':
        return createBooking(e);
      case 'updateBooking':
        return updateBooking(e);
      case 'cancelBooking':
        return cancelBooking(e);
      case 'getSlots':
        return getSlots(e);
      default:
        return jsonOutput({
          success: false,
          message: 'Invalid action.'
        });
    }
  } catch (error) {
    return jsonOutput({
      success: false,
      message: error.message
    });
  }
}

function ensureSheetExists() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Timestamp',
      'Booking ID',
      'Email',
      'Rank',
      'Name',
      'Unit',
      'Event Name',
      'Contact',
      'Venue',
      'Booking Date',
      'Booking Time',
      'Duration',
      'Status'
    ]);
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME);
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateBookingId() {
  const now = new Date();
  const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  const random = Math.floor(100 + Math.random() * 900);
  return `BK-${stamp}-${random}`;
}

function normalize(value) {
  return String(value || '').trim();
}

function createBooking(e) {
  const sheet = getSheet();
  const bookingDate = normalize(e.parameter.bookingDate);
  const bookingTime = normalize(e.parameter.bookingTime);

  validateRequiredFields(e);

  if (isSlotTaken(bookingDate, bookingTime, '')) {
    return jsonOutput({
      success: false,
      message: 'This slot is already booked.'
    });
  }

  const bookingId = generateBookingId();

  sheet.appendRow([
    new Date(),
    bookingId,
    normalize(e.parameter.email),
    normalize(e.parameter.rank),
    normalize(e.parameter.name),
    normalize(e.parameter.unit),
    normalize(e.parameter.eventName),
    normalize(e.parameter.contact),
    normalize(e.parameter.venue),
    bookingDate,
    bookingTime,
    normalize(e.parameter.duration),
    'Confirmed'
  ]);

  return jsonOutput({
    success: true,
    bookingId: bookingId,
    message: 'Booking created successfully.'
  });
}

function updateBooking(e) {
  const sheet = getSheet();
  const bookingId = normalize(e.parameter.bookingId);
  const bookingDate = normalize(e.parameter.bookingDate);
  const bookingTime = normalize(e.parameter.bookingTime);

  validateRequiredFields(e);

  if (!bookingId) {
    return jsonOutput({
      success: false,
      message: 'Missing booking ID.'
    });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonOutput({
      success: false,
      message: 'No bookings found.'
    });
  }

  if (isSlotTaken(bookingDate, bookingTime, bookingId)) {
    return jsonOutput({
      success: false,
      message: 'This slot is already booked by another booking.'
    });
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowIndex = i + 2;
    const rowBookingId = normalize(values[i][1]);

    if (rowBookingId === bookingId) {
      sheet.getRange(rowIndex, 1, 1, 13).setValues([[
        new Date(),
        bookingId,
        normalize(e.parameter.email),
        normalize(e.parameter.rank),
        normalize(e.parameter.name),
        normalize(e.parameter.unit),
        normalize(e.parameter.eventName),
        normalize(e.parameter.contact),
        normalize(e.parameter.venue),
        bookingDate,
        bookingTime,
        normalize(e.parameter.duration),
        'Updated'
      ]]);

      return jsonOutput({
        success: true,
        bookingId: bookingId,
        message: 'Booking updated successfully.'
      });
    }
  }

  return jsonOutput({
    success: false,
    message: 'Booking ID not found.'
  });
}

function cancelBooking(e) {
  const sheet = getSheet();
  const bookingId = normalize(e.parameter.bookingId);

  if (!bookingId) {
    return jsonOutput({
      success: false,
      message: 'Missing booking ID.'
    });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonOutput({
      success: false,
      message: 'No bookings found.'
    });
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowIndex = i + 2;
    const rowBookingId = normalize(values[i][1]);

    if (rowBookingId === bookingId) {
      sheet.getRange(rowIndex, 13).setValue('Cancelled');
      sheet.getRange(rowIndex, 1).setValue(new Date());

      return jsonOutput({
        success: true,
        bookingId: bookingId,
        message: 'Booking cancelled successfully.'
      });
    }
  }

  return jsonOutput({
    success: false,
    message: 'Booking ID not found.'
  });
}

function getSlots(e) {
  const sheet = getSheet();
  const bookingDate = normalize(e.parameter.bookingDate);
  const excludeBookingId = normalize(e.parameter.excludeBookingId);

  if (!bookingDate) {
    return jsonOutput({
      success: true,
      bookedSlots: []
    });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonOutput({
      success: true,
      bookedSlots: []
    });
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const bookedSlots = [];

  values.forEach((row) => {
    const rowBookingId = normalize(row[1]);
    const rowDate = normalize(row[9]);
    const rowTime = normalize(row[10]);
    const rowStatus = normalize(row[12]);

    const isActive = rowStatus !== 'Cancelled';

    if (
      rowDate === bookingDate &&
      isActive &&
      rowBookingId !== excludeBookingId
    ) {
      bookedSlots.push(rowTime);
    }
  });

  return jsonOutput({
    success: true,
    bookedSlots: bookedSlots
  });
}

function isSlotTaken(bookingDate, bookingTime, excludeBookingId) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return false;

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowBookingId = normalize(values[i][1]);
    const rowDate = normalize(values[i][9]);
    const rowTime = normalize(values[i][10]);
    const rowStatus = normalize(values[i][12]);

    if (
      rowDate === bookingDate &&
      rowTime === bookingTime &&
      rowStatus !== 'Cancelled' &&
      rowBookingId !== excludeBookingId
    ) {
      return true;
    }
  }

  return false;
}

function validateRequiredFields(e) {
  const required = [
    'email',
    'rank',
    'name',
    'unit',
    'eventName',
    'contact',
    'venue',
    'bookingDate',
    'bookingTime',
    'duration'
  ];

  for (let i = 0; i < required.length; i++) {
    const field = required[i];
    if (!normalize(e.parameter[field])) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}