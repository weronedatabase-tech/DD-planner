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

/**
 * API ROUTER
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const data = payload.data;
    let result = null;

    // Only lock for write operations to prevent race conditions
    // Read operations (get/list) should happen concurrently for speed
    if (action.startsWith('save') || action.startsWith('delete')) {
      // Try to get lock for 10 seconds
      lockAcquired = lock.tryLock(10000); 
      if (!lockAcquired) {
        throw new Error("Server is busy. Please try again.");
      }
    }

    switch (action) {
      case 'getRosterData':
        result = getRosterData();
        break;
      case 'saveMember':
        result = saveMember(data);
        break;
      case 'deleteMember':
        result = deleteMember(data);
        break;
      case 'listSessions':
        result = listSessions();
        break;
      case 'loadSessionFile':
        result = loadSessionFile(data);
        break;
      case 'checkSessionExists':
        result = checkSessionExists(data);
        break;
      case 'saveSessionToDrive':
        result = saveSessionToDrive(data.dateStr, data.jsonContent);
        break;
      case 'saveBoatImageToDrive':
        result = saveBoatImageToDrive(data.base64Data, data.filename);
        break;
      default:
        throw new Error("Unknown Action: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      data: result 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

// ==========================================
// CORE LOGIC
// ==========================================

function getRosterData() {
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = ss.getSheetByName('Roster');
  if (!sheet) return [];
  const range = sheet.getDataRange();
  if (range.getNumRows() <= 1) return [];
  const data = range.getValues();
  data.shift();
  return data.map((row, i) => ({
    rowIndex: i + 2,
    name: row[0] ? String(row[0]).trim() : "",
    type: row[1] ? String(row[1]).trim() : "",
    gender: row[2],
    weight: row[3],
    side: row[4],
    active: row[5],
    volunteers: row[6] ? String(row[6]).trim() : ""
  })).filter(r => r.name !== "");
}

function saveMember(member) {
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = ss.getSheetByName('Roster');
  if (sheet.getLastColumn() < 7) sheet.getRange(1, 7).setValue("Linked Members");

  const range = sheet.getDataRange();
  const values = range.getValues();
  let targetRowIndex = -1;

  if (member.rowIndex && !String(member.rowIndex).startsWith("TEMP_") && !isNaN(parseInt(member.rowIndex))) {
    targetRowIndex = parseInt(member.rowIndex) - 1;
  } else {
    targetRowIndex = values.length;
    values.push(["", "", "", "", "", "", ""]);
  }

  if (targetRowIndex < 0) targetRowIndex = values.length;

  values[targetRowIndex][0] = member.name;
  values[targetRowIndex][1] = member.type;
  values[targetRowIndex][2] = member.gender;
  values[targetRowIndex][3] = member.weight;
  values[targetRowIndex][4] = member.side;
  values[targetRowIndex][5] = member.active;
  values[targetRowIndex][6] = member.volunteers;

  const linkedNames = member.volunteers ? member.volunteers.split(',').map(s => s.trim()).filter(s => s) : [];
  const myName = member.name;

  for (let i = 1; i < values.length; i++) {
    if (i === targetRowIndex) continue;
    const otherName = String(values[i][0]).trim();
    let otherLinks = values[i][6] ? String(values[i][6]).split(',').map(s => s.trim()).filter(s => s) : [];
    let modified = false;

    if (linkedNames.includes(otherName)) {
      if (!otherLinks.includes(myName)) {
        otherLinks.push(myName);
        modified = true;
      }
    } else if (otherLinks.includes(myName)) {
      otherLinks = otherLinks.filter(n => n !== myName);
      modified = true;
    }

    if (modified) values[i][6] = otherLinks.join(',');
  }

  const maxCols = Math.max(sheet.getLastColumn(), 7);
  const outputValues = values.map(row => {
    while(row.length < maxCols) row.push("");
    return row.slice(0, maxCols);
  });

  sheet.getRange(1, 1, outputValues.length, outputValues[0].length).setValues(outputValues);
  return "Saved";
}

function deleteMember(rowIndex) {
  const ss = SpreadsheetApp.openById(ACTIVE.SHEET_ID);
  const sheet = ss.getSheetByName('Roster');
  if (rowIndex && rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
    sheet.deleteRow(rowIndex);
    return "Deleted";
  }
  throw new Error("Invalid row index");
}

function listSessions() {
  const folder = DriveApp.getFolderById(ACTIVE.SESSION_FOLDER_ID);
  const files = folder.getFiles();
  const fileList = [];
  while (files.hasNext()) {
    let f = files.next();
    if (f.getName().indexOf('.json') > -1) {
      let rawName = f.getName().replace('.json', '');
      let displayDate = rawName;
      try {
        let parts = rawName.split('-');
        let d = new Date(parts[0], parts[1]-1, parts[2]);
        displayDate = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM yyyy (E)");
      } catch(e) {}
      fileList.push({ id: f.getId(), name: displayDate, rawDate: rawName });
    }
  }
  return fileList.sort((a,b) => b.rawDate.localeCompare(a.rawDate));
}

function loadSessionFile(fileId) {
  return DriveApp.getFileById(fileId).getBlob().getDataAsString();
}

function checkSessionExists(dateStr) {
  const folder = DriveApp.getFolderById(ACTIVE.SESSION_FOLDER_ID);
  const fileName = dateStr + ".json";
  const files = folder.getFilesByName(fileName);
  return files.hasNext();
}

function saveSessionToDrive(dateStr, jsonContent) {
  const folder = DriveApp.getFolderById(ACTIVE.SESSION_FOLDER_ID);
  const fileName = dateStr + ".json";
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) { 
    files.next().setContent(jsonContent); 
    return "Updated"; 
  } else { 
    folder.createFile(fileName, jsonContent, MimeType.PLAIN_TEXT); 
    return "Created"; 
  }
}

function saveBoatImageToDrive(base64Data, filename) {
  const folder = DriveApp.getFolderById(ACTIVE.BOAT_IMAGE_FOLDER_ID);
  const existingFiles = folder.getFilesByName(filename);
  while (existingFiles.hasNext()) { existingFiles.next().setTrashed(true); }
  
  const data = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(data, MimeType.JPEG, filename);
  const file = folder.createFile(blob);
  
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(err) {}
  
  return { id: file.getId(), name: filename };
}
