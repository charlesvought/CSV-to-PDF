function csvParser(fileID, sessionID, tempFolder, rNumber) {
  var data = Utilities.parseCsv(DriveApp.getFileById(fileID).getBlob().getDataAsString());
  var totalRecords = data.length;
  for (var r = rNumber, counter = 0; r < totalRecords; r++) { //start parsing on 1st line of CSV
    counter += 1;
    if (counter == 10) {
      return [r, Math.round((r / totalRecords) * 100)];
    }
    var record = [];
    for (p = 0; p < data[r].length; p++) { //start parsing in 1st position
      record.push(data[r][p]);
    }

    recordInjector(record, r + 1, fileID, sessionID, tempFolder);
  }
  return "ParseComplete";
}

function recordInjector(record, r, fileID, sessionID, tempFolder) {
  try {
    var sourceTemplate = tempFolder.getFilesByName(record[0]).next();
    var newDocument = sourceTemplate.makeCopy(record[0] + "_" + record[2] + "_" + Utilities.formatDate(new Date(), "EST", "MM-dd-yyyy") + "_" + r, tempFolder).getId();
    var template = DocumentApp.openById(newDocument);
    for (var i = 0, s = 1; i < record.length; i++, s++) {
      try {
        template.getBody().replaceText("{" + s.toString() + "\d*}", record[i]);
        template.getHeader().replaceText("{" + s.toString() + "\d*}", record[i]);
        template.getFooter().replaceText("{" + s.toString() + "\d*}", record[i]);
        writeLog("{" + s.toString() + "}");
      } catch (e) {
        writeLog("Record Injection Error1: " + e + " SessionID:" + sessionID);
      }
    }
    template.saveAndClose();
    tempFolder.createFile(template).getAs("application/pdf");
  } catch (e) {
    writeLog("Record Injection Error2: " + e + " SessionID:" + sessionID);
  }
}