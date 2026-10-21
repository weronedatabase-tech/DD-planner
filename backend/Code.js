// ==========================================
// ENVIRONMENT CONFIGURATION
// Options: "PROD" or "DEV"
const ENV = "PROD";
// ==========================================

const CONFIG = {
  PROD: {
    SHEET_ID: "1JKHOx-53BbL3XfP1RqYQ7QLmb2vg1q_rlvnXda5ervw",
    SESSION_FOLDER_ID: "1mgHSKjeqsu8X-xtI6lLE53Xj_DIlSnPD",
    BOAT_IMAGE_FOLDER_ID: "1UQuEIA_AvIcjl-1HTVwpfCAHTL-uQDp4"
  },
  DEV: {
    SHEET_ID: "11l1q5YSfAtp897hPvNgb8Ak7DXmJ6l7FJ9mV6QniEDY",
    SESSION_FOLDER_ID: "15E6mRhk-YvukS2uUm00_nPn510JZSoqS",
    BOAT_IMAGE_FOLDER_ID: "1snJP1rpBt9Irxew9_XdxrfrVlZCSOs_F"
  }
};

const ACTIVE = CONFIG[ENV];
const SESSIONS_SHEET_NAME = "Sessions";
const ROSTER_SHEET_NAME = "Roster";
const PRESENCE_TTL_MS = 25000;

/**
 * API ROUTER
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const data = payload.data || {};
    let result = null;

    // Acquire script lock for mutating operations to prevent race conditions
    // during concurrent multi-user collaborative editing
    const isWriteAction =
      action.startsWith("save") ||
      action.startsWith("delete") ||
      action === "applySessionDelta";

    if (isWriteAction) {
      lockAcquired = lock.tryLock(12000);
      if (!lockAcquired) {
        throw new Error("Server is syncing another collaborator's edit. Please retry.");
      }
    }

    switch (action) {
      case "getRosterData":
        result = getRosterData();
        break;
      case "saveMember":
        result = saveMember(data);
        break;
      case "deleteMember":
        result = deleteMember(data);
        break;
      case "listSessions":
        result = listSessions();
        break;
      case "loadSessionFile":
      case "loadSession":
        result = loadSessionFromSheet(data);
        break;
      case "checkSessionExists":
        result = checkSessionExists(data);
        break;
      case "saveSessionToDrive":
      case "saveSessionToSheet":
        result = saveSessionToSheet(data.dateStr, data.jsonContent, data.updatedBy);
        break;
      case "applySessionDelta":
        result = applySessionDelta(data);
        break;
      case "deleteSession":
        result = deleteSessionFromSheet(data);
        break;
      case "syncState":
        result = syncState(data);
        break;
      case "saveBoatImageToDrive":
        result = saveBoatImageToDrive(data.base64Data, data.filename);
        break;
      default:
        throw new Error("Unknown Action: " + action);
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        data: result
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: err.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (lockAcquired) {
      try {
        SpreadsheetApp.flush();
      } catch (e) {}
      lock.releaseLock();
    }
  }
}

// ==========================================
// SESSIONS SHEET SETUP & MIGRATION
// ==========================================

function getOrCreateSessionsSheet(ss) {
  const spreadsheet = ss || SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  let sheet = spreadsheet.getSheetByName(SESSIONS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SESSIONS_SHEET_NAME);
    const headers = [
      "Session Date",
      "Display Date",
      "Updated At",
      "Version",
      "Updated By",
      "Attendance Count",
      "Boats Summary",
      "Attendance List",
      "Session JSON"
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

    // Automatically migrate any legacy JSON session files from Google Drive into the Google Sheet
    try {
      migrateLegacyDriveSessions(sheet);
    } catch (e) {}
  }
  return sheet;
}

function formatDateDisplay(rawDate) {
  if (!rawDate) return "";
  try {
    const parts = String(rawDate).split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM yyyy (E)");
    }
  } catch (e) {}
  return String(rawDate);
}

function normalizeDateCell(cellVal) {
  if (!cellVal) return "";
  if (Object.prototype.toString.call(cellVal) === "[object Date]") {
    return Utilities.formatDate(cellVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(cellVal).trim().replace(/^'/, "");
}

function buildBoatsSummary(boats) {
  if (!Array.isArray(boats) || boats.length === 0) return "0 boats";
  return boats
    .map(function (b, i) {
      const seated = (b.seats || []).filter(function (s) {
        return !!s.occupant;
      }).length;
      return "Boat " + (i + 1) + " (" + (b.type || "standard") + "): " + seated + " seated";
    })
    .join(" | ");
}

function migrateLegacyDriveSessions(sheet) {
  if (!ACTIVE.SESSION_FOLDER_ID) return;
  const folder = DriveApp.getFolderById(ACTIVE.SESSION_FOLDER_ID);
  const files = folder.getFiles();
  const rowsToAppend = [];

  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName();
    if (name.indexOf(".json") > -1) {
      const dateStr = name.replace(".json", "").trim();
      try {
        const rawJson = f.getBlob().getDataAsString();
        const parsed = JSON.parse(rawJson || "{}");
        const attendance = Array.isArray(parsed.attendance) ? parsed.attendance : [];
        const boats = Array.isArray(parsed.boats) ? parsed.boats : [];
        const updatedAt = f.getLastUpdated() ? f.getLastUpdated().toISOString() : new Date().toISOString();
        const canonical = {
          date: dateStr,
          attendance: attendance,
          boats: boats,
          version: 1,
          updatedAt: updatedAt,
          updatedBy: "Migrated from Drive"
        };
        rowsToAppend.push([
          "'" + dateStr,
          formatDateDisplay(dateStr),
          updatedAt,
          1,
          "Drive Migration",
          attendance.length,
          buildBoatsSummary(boats),
          attendance.join(", "),
          JSON.stringify(canonical)
        ]);
      } catch (err) {}
    }
  }

  if (rowsToAppend.length > 0) {
    rowsToAppend.sort(function (a, b) {
      return String(b[0]).localeCompare(String(a[0]));
    });
    sheet.getRange(2, 1, rowsToAppend.length, 9).setValues(rowsToAppend);
  }
}

// ==========================================
// ROSTER LOGIC (WITH CACHE & VERSIONING)
// ==========================================

function getRosterData() {
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  if (range.getNumRows() <= 1) return [];
  const data = range.getValues();
  data.shift();
  const roster = data
    .map(function (row, i) {
      return {
        rowIndex: i + 2,
        name: row[0] ? String(row[0]).trim() : "",
        type: row[1] ? String(row[1]).trim() : "Paddler",
        gender: row[2] ? String(row[2]).trim() : "M",
        weight: Number(row[3]) || 0,
        side: row[4] ? String(row[4]).trim() : "Any",
        active: row[5] !== false,
        volunteers: row[6] ? String(row[6]).trim() : ""
      };
    })
    .filter(function (r) {
      return r.name !== "";
    });

  // Update script cache for fast collaborative sync
  try {
    const cache = CacheService.getScriptCache();
    cache.put("dd_roster_data", JSON.stringify(roster), 21600);
    if (!cache.get("dd_roster_version")) {
      cache.put("dd_roster_version", String(Date.now()), 21600);
    }
  } catch (e) {}

  return roster;
}

function bumpRosterCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove("dd_roster_data");
    cache.put("dd_roster_version", String(Date.now()), 21600);
  } catch (e) {}
}

function saveMember(member) {
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  let sheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ROSTER_SHEET_NAME);
    sheet
      .getRange(1, 1, 1, 7)
      .setValues([["Name", "Type", "Gender", "Weight", "Side", "Active", "Linked Members"]]);
  }
  if (sheet.getLastColumn() < 7) sheet.getRange(1, 7).setValue("Linked Members");

  const range = sheet.getDataRange();
  const values = range.getValues();
  let targetRowIndex = -1;

  if (
    member.rowIndex &&
    !String(member.rowIndex).startsWith("TEMP_") &&
    !String(member.rowIndex).startsWith("LOCAL_") &&
    !isNaN(parseInt(member.rowIndex, 10))
  ) {
    targetRowIndex = parseInt(member.rowIndex, 10) - 1;
  } else {
    // Also check if a member with the same name already exists to prevent duplicates on concurrent creates
    for (let idx = 1; idx < values.length; idx++) {
      if (String(values[idx][0]).trim().toLowerCase() === String(member.name).trim().toLowerCase()) {
        targetRowIndex = idx;
        break;
      }
    }
    if (targetRowIndex === -1) {
      targetRowIndex = values.length;
      values.push(["", "", "", "", "", "", ""]);
    }
  }

  if (targetRowIndex < 1 || targetRowIndex >= values.length) {
    targetRowIndex = values.length;
    values.push(["", "", "", "", "", "", ""]);
  }

  values[targetRowIndex][0] = member.name;
  values[targetRowIndex][1] = member.type;
  values[targetRowIndex][2] = member.gender;
  values[targetRowIndex][3] = member.weight;
  values[targetRowIndex][4] = member.side;
  values[targetRowIndex][5] = member.active !== false;
  values[targetRowIndex][6] = member.volunteers || "";

  const linkedNames = member.volunteers
    ? member.volunteers
        .split(",")
        .map(function (s) {
          return s.trim();
        })
        .filter(function (s) {
          return s;
        })
    : [];
  const myName = member.name;

  for (let i = 1; i < values.length; i++) {
    if (i === targetRowIndex) continue;
    const otherName = String(values[i][0]).trim();
    let otherLinks = values[i][6]
      ? String(values[i][6])
          .split(",")
          .map(function (s) {
            return s.trim();
          })
          .filter(function (s) {
            return s;
          })
      : [];
    let modified = false;

    if (linkedNames.includes(otherName)) {
      if (!otherLinks.includes(myName)) {
        otherLinks.push(myName);
        modified = true;
      }
    } else if (otherLinks.includes(myName)) {
      otherLinks = otherLinks.filter(function (n) {
        return n !== myName;
      });
      modified = true;
    }

    if (modified) values[i][6] = otherLinks.join(",");
  }

  const maxCols = Math.max(sheet.getLastColumn(), 7);
  const outputValues = values.map(function (row) {
    while (row.length < maxCols) row.push("");
    return row.slice(0, maxCols);
  });

  sheet.getRange(1, 1, outputValues.length, outputValues[0].length).setValues(outputValues);
  bumpRosterCache();
  return "Saved";
}

function deleteMember(rowIndex) {
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  if (rowIndex && rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
    sheet.deleteRow(Number(rowIndex));
    bumpRosterCache();
    return "Deleted";
  }
  throw new Error("Invalid row index");
}

// ==========================================
// GOOGLE SHEET SESSION STORAGE & SYNC
// ==========================================

function listSessions() {
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = getOrCreateSessionsSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  const sessionList = [];
  const seenDates = {};
  const cache = CacheService.getScriptCache();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rawDate = normalizeDateCell(row[0]);
    if (!rawDate || seenDates[rawDate]) continue;
    seenDates[rawDate] = true;

    const displayDate = row[1] ? String(row[1]) : formatDateDisplay(rawDate);
    const updatedAt = row[2] ? String(row[2]) : "";
    const version = Number(row[3]) || 1;
    const updatedBy = row[4] ? String(row[4]) : "";
    const attendanceCount = Number(row[5]) || 0;
    const boatsSummary = row[6] ? String(row[6]) : "";
    const sessionJson = row[8] ? String(row[8]) : "";

    if (sessionJson) {
      try {
        cache.put("dd_session_" + rawDate, sessionJson, 21600);
      } catch (e) {}
    }

    sessionList.push({
      id: rawDate,
      name: displayDate,
      rawDate: rawDate,
      updatedAt: updatedAt,
      version: version,
      updatedBy: updatedBy,
      attendanceCount: attendanceCount,
      boatsSummary: boatsSummary,
      sessionJson: sessionJson
    });
  }

  return sessionList.sort(function (a, b) {
    return b.rawDate.localeCompare(a.rawDate);
  });
}

function findSessionRowIndex(sheet, dateOrId) {
  const target = String(dateOrId).replace(".json", "").trim();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < colA.length; i++) {
    if (normalizeDateCell(colA[i][0]) === target) {
      return i + 2; // 1-indexed sheet row
    }
  }
  return -1;
}

function loadSessionFromSheet(dateOrId) {
  const target = String(dateOrId).replace(".json", "").trim();
  const cache = CacheService.getScriptCache();
  const cached = cache.get("dd_session_" + target);
  if (cached) {
    return cached;
  }

  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = getOrCreateSessionsSheet(ss);
  const rowIndex = findSessionRowIndex(sheet, target);

  if (rowIndex !== -1) {
    const rowValues = sheet.getRange(rowIndex, 1, 1, 9).getValues()[0];
    const jsonStr = rowValues[8] ? String(rowValues[8]) : "";
    if (jsonStr) {
      try {
        cache.put("dd_session_" + target, jsonStr, 21600);
        cache.put("dd_active_session_date", target, 21600);
      } catch (e) {}
      return jsonStr;
    }
  }

  // Fallback: check if dateOrId is a legacy Google Drive file ID
  try {
    const legacyContent = DriveApp.getFileById(target).getBlob().getDataAsString();
    if (legacyContent) {
      const parsed = JSON.parse(legacyContent);
      if (parsed && parsed.date) {
        saveSessionToSheet(parsed.date, legacyContent, "Legacy Import");
      }
      return legacyContent;
    }
  } catch (e) {}

  throw new Error("Session not found in Google Sheet: " + target);
}

function checkSessionExists(dateStr) {
  const target = String(dateStr).replace(".json", "").trim();
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = getOrCreateSessionsSheet(ss);
  return findSessionRowIndex(sheet, target) !== -1;
}

function saveSessionToSheet(dateStr, jsonContent, updatedBy) {
  const cleanDate = String(dateStr).replace(".json", "").trim();
  if (!cleanDate) throw new Error("Missing session date");

  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = getOrCreateSessionsSheet(ss);
  const rowIndex = findSessionRowIndex(sheet, cleanDate);

  let parsed = {};
  try {
    parsed = typeof jsonContent === "string" ? JSON.parse(jsonContent) : jsonContent;
  } catch (e) {
    parsed = { date: cleanDate, attendance: [], boats: [] };
  }

  let nextVersion = (Number(parsed.version) || 0) + 1;
  if (rowIndex !== -1) {
    const currentVersion = Number(sheet.getRange(rowIndex, 4).getValue()) || 0;
    nextVersion = Math.max(nextVersion, currentVersion + 1);
  }

  const nowIso = new Date().toISOString();
  const author = updatedBy || parsed.updatedBy || "Collaborator";
  const attendance = Array.isArray(parsed.attendance) ? parsed.attendance : [];
  const boats = Array.isArray(parsed.boats) ? parsed.boats : [];

  const canonicalObj = {
    date: cleanDate,
    attendance: attendance,
    boats: boats,
    version: nextVersion,
    updatedAt: nowIso,
    updatedBy: author
  };
  const canonicalJson = JSON.stringify(canonicalObj);

  const rowData = [
    "'" + cleanDate,
    formatDateDisplay(cleanDate),
    nowIso,
    nextVersion,
    author,
    attendance.length,
    buildBoatsSummary(boats),
    attendance.join(", "),
    canonicalJson
  ];

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, 9).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  try {
    const cache = CacheService.getScriptCache();
    cache.put("dd_session_" + cleanDate, canonicalJson, 21600);
    cache.put("dd_active_session_date", cleanDate, 21600);
  } catch (e) {}

  return canonicalObj;
}

function deleteSessionFromSheet(dateOrId) {
  const cleanDate = String(dateOrId).replace(".json", "").trim();
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = getOrCreateSessionsSheet(ss);
  const rowIndex = findSessionRowIndex(sheet, cleanDate);
  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
    try {
      const cache = CacheService.getScriptCache();
      cache.remove("dd_session_" + cleanDate);
    } catch (e) {}
    return { deleted: true, date: cleanDate };
  }
  return { deleted: false, date: cleanDate };
}

/**
 * Atomic collaborative delta application on the authoritative Google Sheet session
 */
function applySessionDelta(payload) {
  const dateStr = String(payload.date || "").trim();
  if (!dateStr) throw new Error("Missing session date for delta");

  let currentObj = null;
  try {
    const raw = loadSessionFromSheet(dateStr);
    currentObj = JSON.parse(raw);
  } catch (e) {
    currentObj = {
      date: dateStr,
      attendance: [],
      boats: [],
      version: 0
    };
  }

  let attendance = Array.isArray(currentObj.attendance) ? currentObj.attendance.map(String) : [];
  let boats = Array.isArray(currentObj.boats) ? currentObj.boats : [];
  const ops = Array.isArray(payload.ops) ? payload.ops : payload.op ? [payload.op] : [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op || !op.type) continue;

    if (op.type === "TOGGLE_ATTENDANCE") {
      const name = String(op.memberName);
      if (op.isChecked) {
        if (!attendance.includes(name)) attendance.push(name);
      } else {
        attendance = attendance.filter(function (n) {
          return n !== name;
        });
        boats = boats.map(function (b) {
          return {
            id: b.id,
            type: b.type,
            seats: (b.seats || []).map(function (s) {
              return s.occupant === name ? Object.assign({}, s, { occupant: null }) : s;
            })
          };
        });
      }
    } else if (op.type === "TOGGLE_GROUP") {
      const names = Array.isArray(op.memberNames) ? op.memberNames.map(String) : [];
      if (op.isChecked) {
        names.forEach(function (n) {
          if (!attendance.includes(n)) attendance.push(n);
        });
      } else {
        attendance = attendance.filter(function (n) {
          return !names.includes(n);
        });
        boats = boats.map(function (b) {
          return {
            id: b.id,
            type: b.type,
            seats: (b.seats || []).map(function (s) {
              return s.occupant && names.includes(s.occupant)
                ? Object.assign({}, s, { occupant: null })
                : s;
            })
          };
        });
      }
    } else if (op.type === "ADD_BOAT") {
      const newBoat = op.boat;
      if (newBoat) {
        const exists = boats.some(function (b) {
          return b.id && b.id === newBoat.id;
        });
        if (!exists) boats.push(newBoat);
      }
    } else if (op.type === "REMOVE_BOAT") {
      boats = boats.filter(function (b, idx) {
        if (op.boatId && b.id) return b.id !== op.boatId;
        return idx !== op.boatIndex;
      });
    } else if (op.type === "ASSIGN_SEAT") {
      const memberName = op.memberName;
      const targetBoatId = op.targetBoatId;
      const targetBoatIndex = op.targetBoatIndex;
      const targetRole = op.targetRole;
      const targetRow = op.targetRow;
      const targetSide = op.targetSide;
      const swapOccupant = op.swapWithOccupant;

      // Find previous seat of memberName in case of seat-to-seat swap
      let prevBoatIdx = -1;
      let prevSeatIdx = -1;
      boats.forEach(function (b, bIdx) {
        (b.seats || []).forEach(function (s, sIdx) {
          if (s.occupant === memberName) {
            prevBoatIdx = bIdx;
            prevSeatIdx = sIdx;
          }
        });
      });

      // Clear memberName from any existing seat
      boats.forEach(function (b) {
        (b.seats || []).forEach(function (s) {
          if (s.occupant === memberName) s.occupant = null;
        });
      });

      // Place memberName in target seat
      boats.forEach(function (b, bIdx) {
        const isTargetBoat = (targetBoatId && b.id === targetBoatId) || bIdx === targetBoatIndex;
        if (!isTargetBoat) return;
        (b.seats || []).forEach(function (s) {
          const isMatch = targetRole
            ? s.role === targetRole
            : Number(s.row) === Number(targetRow) && s.side === targetSide;
          if (isMatch) {
            const displaced = s.occupant;
            s.occupant = memberName;
            if (displaced && swapOccupant && prevBoatIdx !== -1 && prevSeatIdx !== -1) {
              boats[prevBoatIdx].seats[prevSeatIdx].occupant = displaced;
            }
          }
        });
      });
    } else if (op.type === "RETURN_TO_POOL") {
      const targetName = op.memberName;
      boats.forEach(function (b) {
        (b.seats || []).forEach(function (s) {
          if (s.occupant === targetName) s.occupant = null;
        });
      });
    } else if (op.type === "SET_BOATS") {
      if (Array.isArray(op.boats)) {
        boats = op.boats;
      }
    } else if (op.type === "SET_FULL_STATE") {
      if (op.state) {
        attendance = Array.isArray(op.state.attendance) ? op.state.attendance : attendance;
        boats = Array.isArray(op.state.boats) ? op.state.boats : boats;
      }
    }
  }

  const nextState = {
    date: dateStr,
    attendance: attendance,
    boats: boats,
    version: Number(currentObj.version) || 0
  };

  if (payload.clientId) {
    updatePresenceInternal(payload);
  }

  const saved = saveSessionToSheet(dateStr, JSON.stringify(nextState), payload.updatedBy || payload.clientName);
  return {
    session: saved,
    activeUsers: getActiveUsersInternal()
  };
}

// ==========================================
// REAL-TIME PRESENCE & COLLABORATIVE POLLING
// ==========================================

function updatePresenceInternal(info) {
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get("dd_presence_map");
    const map = raw ? JSON.parse(raw) : {};
    const now = Date.now();

    // Prune stale users
    Object.keys(map).forEach(function (k) {
      if (now - (map[k].lastSeen || 0) > PRESENCE_TTL_MS) {
        delete map[k];
      }
    });

    if (info && info.clientId) {
      map[info.clientId] = {
        clientId: info.clientId,
        name: info.clientName || "Coach",
        color: info.clientColor || "#3b82f6",
        activeTab: info.activeTab || "planning",
        sessionDate: info.sessionDate || null,
        selectedSeat: info.selectedSeat || null,
        lastSeen: now
      };
    }

    cache.put("dd_presence_map", JSON.stringify(map), 120);
    return Object.keys(map).map(function (k) {
      return map[k];
    });
  } catch (e) {
    return [];
  }
}

function getActiveUsersInternal() {
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get("dd_presence_map");
    if (!raw) return [];
    const map = JSON.parse(raw);
    const now = Date.now();
    const active = [];
    Object.keys(map).forEach(function (k) {
      if (now - (map[k].lastSeen || 0) <= PRESENCE_TTL_MS) {
        active.push(map[k]);
      }
    });
    return active;
  } catch (e) {
    return [];
  }
}

function syncState(payload) {
  const activeUsers = updatePresenceInternal(payload);
  const cache = CacheService.getScriptCache();

  const activeSessionDate = payload.sessionDate || cache.get("dd_active_session_date") || null;
  const knownSessionVersion = Number(payload.knownSessionVersion) || 0;
  const knownRosterVersion = String(payload.knownRosterVersion || "");

  let currentRosterVersion = cache.get("dd_roster_version") || "";
  let rosterData = null;

  if (!currentRosterVersion || currentRosterVersion !== knownRosterVersion) {
    const cachedRoster = cache.get("dd_roster_data");
    if (cachedRoster && currentRosterVersion) {
      rosterData = JSON.parse(cachedRoster);
    } else {
      rosterData = getRosterData();
      currentRosterVersion = cache.get("dd_roster_version") || String(Date.now());
    }
  }

  let sessionObj = null;
  if (activeSessionDate) {
    try {
      const rawSession = loadSessionFromSheet(activeSessionDate);
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        const serverVer = Number(parsed.version) || 1;
        if (serverVer > knownSessionVersion || payload.forceSessionFetch) {
          sessionObj = parsed;
        }
      }
    } catch (e) {}
  }

  return {
    activeUsers: activeUsers,
    activeSessionDate: activeSessionDate,
    rosterVersion: currentRosterVersion,
    roster: rosterData,
    session: sessionObj
  };
}

// ==========================================
// IMAGE EXPORT TO DRIVE
// ==========================================

function saveBoatImageToDrive(base64Data, filename) {
  const folder = DriveApp.getFolderById(ACTIVE.BOAT_IMAGE_FOLDER_ID);
  const existingFiles = folder.getFilesByName(filename);
  while (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }

  const data = Utilities.base64Decode(base64Data.split(",")[1]);
  const blob = Utilities.newBlob(data, MimeType.JPEG, filename);
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {}

  return { id: file.getId(), name: filename };
}
