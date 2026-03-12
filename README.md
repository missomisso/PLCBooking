# PLC Football Field Booking

Built with:

- **HTML**
- **CSS**
- **Vanilla JavaScript**
- **Google Sheets + Google Apps Script** as the backend
- ready to deploy as a **static site on Vercel**

This project lets users:

- select a date from a calendar
- choose a time slot
- enter booking details
- submit a booking to Google Sheets
- change an existing booking
- cancel an existing booking
- automatically block slots that are already booked

---

## Features

### Frontend
- clean single-page booking flow
- calendar-based date selection
- selectable 2-hour time slots
- booking form with:
  - Email
  - Rank
  - Name
  - Unit
  - Event Name
  - Contact Number
- live booking summary
- confirmation panel after successful booking

### Backend
- stores bookings in **Google Sheets**
- generates a unique **Booking ID**
- supports:
  - **Create booking**
  - **Update booking**
  - **Cancel booking**
  - **Get unavailable slots**
- prevents double booking of the same date + time slot

---

## Project Structure

```bash
project/
├── index.html
├── style.css
├── script.js
├── Code.gs
└── appsscript.jsonCourt
