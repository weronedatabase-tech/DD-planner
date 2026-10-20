# Different Dragons Planner

A modern React & TypeScript dragon boat seating planner and roster management application rewritten from the imported vanilla JavaScript project.

## Features

- **Team Roster Management**:
  - Full CRUD operations for Paddlers and Volunteers with side preferences (Left/Right/Any), weights (kg), and gender.
  - Reciprocal linked member relationships (e.g., pairing specific paddlers with volunteers).
- **Session Attendance Tracking**:
  - Date picking and calendar session tracking.
  - Load existing saved sessions or start a new session.
  - Group attendance toggling for Paddlers and Volunteers.
- **Visual Boat Planning & Seating**:
  - Standard (20-paddler) and Small (10-paddler) dragon boat layouts with Coach/Drum and Steer positions.
  - Interactive drag-and-drop seating from attendee pool to boats, between boats, and back to pool.
  - Click-to-assign modal for quick seat assignment and removal.
  - Linked group visualization and unlinked volunteer grouping in the pool.
- **Smart Auto-Balancing**:
  - **Stability (L/R)** mode: Balances total weight evenly between port and starboard sides.
  - **Rocket (Engine Room)** mode: Concentrates heavy paddle power in center rows.
  - Preserves locked drummer and helm seats while keeping linked pairs together and honoring side preferences.
  - Real-time boat weight statistics (Left weight, Right weight, and balance difference indicator).
- **Export & Storage**:
  - 3x high-resolution boat layout canvas generation with color-coded seats.
  - Google Drive upload integration with fallback local image preview.
  - Multi-level Undo & Redo (up to 20 states).
  - Debounced autosave (2s) to Google Sheets / Apps Script backend with offline local storage cache.
- **Dark Mode**:
  - Full light/dark theme toggle with persistent preference.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Port**: Port 3000 on `0.0.0.0`
