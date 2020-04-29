function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("start.html").setTitle("CSV -> G-Drive Docs/PDF Merge");
}

function uploadFileToGoogleDrive(data, file, name, email, gDriveUrl) {
  var csvTempFolderID = "1wFPsTesbQXKUUw8X6RlTibuPq7ahpjX_";
  var sessionID = Utilities.getUuid();

  try {
    //evaluate email address
    var emailRegex = /[a-zA-Z0-9_\.\+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-\.]+/;
    if (emailRegex.test(email) == false) {
      writeLog("Name:" + name + " Email:" + email + " SessionID:" + sessionID + " Failure: Invalid Email Address Entered");
      return "Invalid Email Address Entered;          Session ID:" + sessionID;
    }

    //evaluate GDRIVE link
    var gDriveUrlRegex = /^https:\/\/docs.google.com\/document\/d\/[\S]{0,}/;
    if (gDriveUrlRegex.test(gDriveUrl) == false) {
      writeLog("Name:" + name + " Email:" + email + " SessionID:" + sessionID + " Failure: Invalid Google Docs URL Provided");
      return "Invalid Google Docs URL Provided;          SessionID:" + sessionID;
    } else {
      var docIDRegex = /\/d\/(.+)\//;
      var matchDocID = gDriveUrl.match(docIDRegex);
      var docID = matchDocID[1];
      if (docID == null || undefined) {
        writeLog("Name:" + name + " Email:" + email + " SessionID:" + sessionID + " Failure: Google Doc ID Could Not Be Extracted from URL");
        return "Google Doc ID Could Not Be Extracted from URL;          SessionID:" + sessionID;
      }
      //evaluate GDRIVE File Permissions
      try {
        switch (DriveApp.getFileById(docID).getSharingAccess()) {
          case DriveApp.Access.ANYONE:
          case DriveApp.Access.ANYONE_WITH_LINK:
          case DriveApp.Access.PRIVATE:
            break;
          case DriveApp.Access.DOMAIN:
          case DriveApp.Access.DOMAIN_WITH_LINK:
          default:
            writeLog("Name:" + name + " Email:" + email + " SessionID:" + sessionID + " Failure: Bad Google Doc Permissions");
            return "Bad Google Doc Permissions; SessionID:" + sessionID;
        }
      } catch (e) {
        writeLog("Name:" + name + " Email:" + email + " SessionID:" + sessionID + " Failure: Bad Google Doc Permissions");
        return "Bad Google Doc Permissions; SessionID:" + sessionID;
      }
    }

    var contentType = data.substring(5, data.indexOf(";")),
      bytes = Utilities.base64Decode(data.substr(data.indexOf("base64,") + 7)),
      blob = Utilities.newBlob(bytes, contentType, file);
    var tempFolderID = DriveApp.getFolderById(csvTempFolderID)
      .createFolder([name, email].join(" ") + "_" + sessionID)
      .getId();
    var tempFileID = DriveApp.getFolderById(tempFolderID).createFile(blob).getId();
    //Define User Folder & File Instances
    var tempFolder = DriveApp.getFolderById(tempFolderID);
    var tempFile = DriveApp.getFileById(tempFileID);

    //evaluate MIME type
    var supportedExcelFileTypes = ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.template", "application/vnd.ms-excel.sheet.macroEnabled.12", "application/vnd.ms-excel.template.macroEnabled.12"];

    if (tempFile.getMimeType() !== "text/csv" && supportedExcelFileTypes.indexOf(tempFile.getMimeType().toString()) == -1) {
      return "File Mime Type Not Supported = " + tempFile.getMimeType() + "; SessionID:" + sessionID;
    }

    if (supportedExcelFileTypes.indexOf(tempFile.getMimeType().toString()) !== -1) {
      Drive.Files.copy({ mimeType: MimeType.GOOGLE_SHEETS, convert: true, parents: [{ id: tempFolderID }] }, tempFileID);
      var sheets = SpreadsheetApp.openById(DriveApp.getFolderById(tempFolderID).getFilesByType(MimeType.GOOGLE_SHEETS).next().getId()).getSheets();
      var csv = sheets.map(function (sheet) {
        return sheets[0].getDataRange().getValues().reduce(function (csv, row) {return (csv += row.join(",") + "\n");}, "");
      });
      DriveApp.getFolderById(tempFolderID).createFile(tempFile.getName() + ".csv", csv, MimeType.CSV);
      tempFileID = DriveApp.getFolderById(tempFolderID).getFilesByType(MimeType.CSV).next().getId();
    }

    //Copy User Source Doc Into Session Folder
    DriveApp.getFileById(docID).makeCopy(DriveApp.getFileById(docID).getName(), DriveApp.getFolderById(tempFolderID));

    //Begin CSV merge
    var csvCatcher = csvParser(tempFileID, sessionID, tempFolder, 0);
    if (!isNaN(csvCatcher[0])) {
      return ["CONTINUE", csvCatcher[0], sessionID, tempFolderID, tempFileID, csvCatcher[1].toString()];
    }

    //wrap up the resulting PDFs into Zip File and serve download link
    var zipFileID = zipPDF(tempFolderID, sessionID);
    var ZipDownloadUrl = DriveApp.getFileById(zipFileID).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW).getDownloadUrl();

    //Email Download Link
    //MailApp.sendEmail(email, "CSV->PDF Download Link (SessionID: " + sessionID + ")", "Download Link: \r\n" + ZipDownloadUrl + "\r\n\r\n SessionID: " + sessionID);
    
    return ["OK", ZipDownloadUrl, sessionID];
  } catch (f) {
    writeLog(f.toString());
    return f.toString();
  }
}

function uploadFileToGoogleDriveContinue(csvCatcher, sessionID, tempFolderID, tempFileID) {
  try {
    var tempFolder = DriveApp.getFolderById(tempFolderID);

    //Begin CSV merge
    var csvCatcher = csvParser(tempFileID, sessionID, tempFolder, csvCatcher);
    if (!isNaN(csvCatcher[0])) {
      return ["CONTINUE", csvCatcher[0], sessionID, tempFolderID, tempFileID, csvCatcher[1].toString()];
    }
    var zipFileID = zipPDF(tempFolderID, sessionID);

    return ["OK", DriveApp.getFileById(zipFileID).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW).getDownloadUrl(), sessionID];
  } catch (f) {
    writeLog(f.toString());
    return f.toString();
  }
}

function zipPDF(folderID, sessionID) {
  var tempFolderPDFs = DriveApp.getFolderById(folderID).getFilesByType(MimeType.PDF);
  var blobArray = [];
  while (tempFolderPDFs.hasNext()) {
    var tempFolderPDFsfile = tempFolderPDFs.next();
    blobArray.push(tempFolderPDFsfile);
  }
  return DriveApp.getFolderById(folderID).createFile(Utilities.zip(blobArray, sessionID + ".zip")).getId();
}

var logSheet = SpreadsheetApp.openById("1dJI7PrQYcYAstLcy6AOZ9KhdrHF3LQaoNWCrdKfcjJA").getSheetByName("Log"); //output Console Log
function writeLog(string) {
  logSheet.insertRowsAfter(1, 1);
  logSheet.getRange("A2").setValue(Utilities.formatDate(new Date(), "EST", "MM-dd-yyyy'@'HH:mm:ss") + "  " + string);
}

function mimeType() {
  Logger.log(DriveApp.getFileById("1b52BU6TBwIdM1vJh-tqeO3pdCWmtHuVZ_52LtuObuAg").getMimeType());
}

//Derived from https://www.labnol.org/code/19747-google-forms-upload-files