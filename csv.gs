function csvParser(fileID, sessionID, tempFolder) {
    var data = Utilities.parseCsv(DriveApp.getFileById(fileID).getBlob().getDataAsString());
    for (r = 1; r < data.length; r++) { //start parsing on 2nd line of CSV
        var record = [];
        for (p = 0; p < data[r].length; p++) { //start parsing in 1st position
            record.push(data[r][p]);
        }
        recordInjector(record, fileID, sessionID, tempFolder);
    }
    writeLog('File Parse [Successful]: FileID=' + fileID + ' SessionID=' + sessionID);
}

function recordInjector(record, fileID, sessionID, tempFolder) {
    try {
        var sourceTemplate = tempFolder.getFilesByName(record[0]).next();
        var newDocument = sourceTemplate.makeCopy(record[0] + '_' + record[2] + '_' + Utilities.formatDate(new Date(), "EST", "MM-dd-yyyy"), tempFolder).getId();
        var template = DocumentApp.openById(newDocument);
        for (i = 0, s = 1; i < record.length; i++, s++) {
            try {
                template.getBody().replaceText('{0' + s.toString() + '}', record[i]);
                template.getHeader().replaceText('{0' + s.toString() + '}', record[i]);
                template.getFooter().replaceText('{0' + s.toString() + '}', record[i]);
            } catch (e) {
              writeLog('Record Injection Error1: ' + e + ' SessionID:'+ sessionID);
            }
        }
        template.saveAndClose();
        tempFolder.createFile(template).getAs('application/pdf');
        writeLog('File Injection [Successful]: FileID=' + fileID + ' SessionID=' + sessionID);
    } catch (e) {
      writeLog('Record Injection Error2: ' + e + ' SessionID:'+ sessionID);
    }
}