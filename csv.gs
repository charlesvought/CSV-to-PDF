function csvParser(tempFileID, sessionID, tempFolderID, recordNumber, useHeadersFlag, headersReturn) {
    var data = Utilities.parseCsv(DriveApp.getFileById(tempFileID).getBlob().getDataAsString());
    var totalRecords = data.length;
    
    for (counter = 0; recordNumber < totalRecords; recordNumber++) { //start parsing on 1st line of CSV
      counter += 1;
      if (counter == 10) {
        return [recordNumber, Math.round((recordNumber / totalRecords) * 100), headers];
      }
      
      var recordArray = []; //reset the record array after every loop
 
      for (var p = 0; p < data[recordNumber].length; p++) { //start parsing in 1st position
        recordArray.push(data[recordNumber][p].trim());
      }
      
      if (useHeadersFlag == true && recordNumber == 0) {
        var headers = recordArray;
      } else if (headersReturn !== undefined && recordNumber > 0) {
        var headers = headersReturn;
        recordInjector(recordArray, recordNumber, sessionID, tempFolderID, headers);
      } else {
        recordInjector(recordArray, recordNumber, sessionID, tempFolderID, headers);
      }
    }
    
    return "ParseComplete";
  }
  
  function recordInjector(recordArray, recordNumber, sessionID, tempFolderID, headers) {
    try {
      var sourceTemplate = DriveApp.getFolderById(tempFolderID).getFilesByName(recordArray[0]).next();
    } catch (e) {
      writeLog("Template Name = " + recordArray[0] + " does not match name of supplied Google Doc template." + "SessionID = " + sessionID);
      DriveApp.getFolderById(tempFolderID).createFile("Record" + Number(recordNumber+1).toString() + "Error_" + sessionID, "Template Name = " + recordArray[0] + " does not match name of supplied Google Doc template.", MimeType.PDF);
      return;
    }
      if (headers == undefined) {
        var newDocument = sourceTemplate.makeCopy(recordArray[0] + "_" + Utilities.formatDate(new Date(), "EST", "MM-dd-yyyy") + "_" + Number(recordNumber+1).toString(), DriveApp.getFolderById(tempFolderID)).getId();
        var template = DocumentApp.openById(newDocument);
        for (var i = 0, s = 1; i < recordArray.length-1; i++, s++) {
        try {
          template.getBody().replaceText("{" + s.toString() + "\d*}", recordArray[i]);
          template.getHeader().replaceText("{" + s.toString() + "\d*}", recordArray[i]);
          template.getFooter().replaceText("{" + s.toString() + "\d*}", recordArray[i]);
          } catch (e) {
            writeLog("Record Injection w/o headers: " + e + " sessionID:" + sessionID);
          }
        }
      } else { //data with headers
        var newDocument = sourceTemplate.makeCopy(recordArray[0] + "_" + Utilities.formatDate(new Date(), "EST", "MM-dd-yyyy") + "_" + recordNumber, DriveApp.getFolderById(tempFolderID)).getId();
        var template = DocumentApp.openById(newDocument);
        for (var i = 0; i < recordArray.length-1; i++) {
          try {
            template.getBody().replaceText("{" + headers[i] + "}", recordArray[headers.indexOf(headers[i])]);
            template.getHeader().replaceText("{" + headers[i] + "}", recordArray[headers.indexOf(headers[i])]);
            template.getFooter().replaceText("{" + headers[i] + "}", recordArray[headers.indexOf(headers[i])]);
          } catch (e) {
            writeLog("Record Injection w/ Headers: " + e + " sessionID:" + sessionID);
          }
        }      
      }
      template.saveAndClose();
      DriveApp.getFolderById(tempFolderID).createFile(template).getAs("application/pdf");
   }