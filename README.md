# PLC Football Field Booking System

A simple booking system for the **PLC Football Field** built with:

- **Frontend:** HTML + Tailwind CSS + JavaScript
- **Backend:** Google Apps Script
- **Database:** Google Sheets
- **Email:** MailApp via Google Apps Script

This project lets users:

- view available booking slots
- create a booking
- update an existing booking
- cancel a booking
- prevent double booking
- view all bookings for a selected day
- contact a booking holder by email from the booking table

---

## Features

### Booking workflow
- Calendar-based date selection
- 24-hour time slots
- Booking summary panel
- Booking confirmation display
- Existing booking lookup by **Booking ID + Email**
- Edit and cancel booking support

### Validation
- No double booking for the same:
  - venue
  - date
  - time
- Cancelled bookings free up the slot again
- Same person cannot keep duplicate active bookings at the same date/time
- Email format validation
- Backend locking with `LockService` to reduce race conditions

### Booking data
Each booking stores:

- Booking ID
- Rank & Name
- Unit
- Contact Number
- Email
- Event Name
- Venue
- Booking Date
- Booking Time
- Duration
- Status

### Booking ID format
Booking IDs are sequential:

- `BK0001`
- `BK0002`
- `BK0003`

### All Bookings table
The All Bookings section shows:

- Status
- Date
- Time
- Rank & Name
- Unit
- Contact
- Event
- Venue
- Contact button

The **Contact** button opens the user's email client using `mailto:`.

---

## Project Structure

```text
project-folder/
├── index.html
├── script.js
└── README.md
