function getRelevantMessages()
{
  var threads = GmailApp.search("newer_than:1d AND in:inbox AND from:axisbank.com AND subject:Transaction alert AND -label:axis_processed",0,100);
  var arrToConvert=[];
  for(var i = threads.length - 1; i >=0; i--) {
    arrToConvert.push(threads[i].getMessages());   
  }
  var messages = [];
  for(var i = 0; i < arrToConvert.length; i++) {
    messages = messages.concat(arrToConvert[i]);
  }
  return messages;
}


function parseMessageData(messages)
{
  var records=[];
  if(!messages)
  {
    //messages is undefined or null or just empty
    return records;
  }
  for(var m=0;m<messages.length;m++)
  {
    var text = messages[m].getPlainBody();

    var matches = text.match(/Card no.\s(XX\d+)\sfor\s([A-Z]{3})\s(\d+(?:\.\d+)?)\sat\s(.+?)\son\s*(\d+-\d+-\d+\s\d+:\d+:\d+)/);
    
    if(!matches || matches.length < 6)
    {
      //No matches; couldn't parse continue with the next message
      continue;
    }
    var rec = {};
    rec.currency = matches[2];
    rec.card = matches[1];
    rec.date= matches[5];
    rec.merchant = matches[4];
    rec.amount = matches[3];
    rec.emailHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, text)
        .map(function (byte) {
          return (byte & 0xFF).toString(16);
        })
        .join('');

    
    records.push(rec);
  }
  return records;
}

function getMessagesDisplay()
{
  var templ = HtmlService.createTemplateFromFile('messages');
  templ.messages = getRelevantMessages();
  return templ.evaluate();  
}

function getParsedDataDisplay()
{
  var templ = HtmlService.createTemplateFromFile('parsed');
  templ.records = parseMessageData(getRelevantMessages());
  return templ.evaluate();
}

function saveDataToSheet(records) {
  if (!records || records.length === 0) {
    return; // Skip if records is empty or undefined
  }

  // REPLACE WITH YOUR GOOGLE SHEET URL
  var spreadsheet = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/");
  var sheet = spreadsheet.getSheetByName("Axis");
  
  // Get the existing checksums from the sheet
  var lastRow = sheet.getLastRow();
  var emailChecksumColumn = 7; // Assuming email checksum is in column G
  var existingChecksums = sheet.getRange(1, emailChecksumColumn, lastRow).getValues().flat();

  for (var r = 0; r < records.length; r++) {
    // If the email checksum is not already in the sheet, append the row
    if (existingChecksums.indexOf(records[r].emailHash) === -1) {
      sheet.appendRow([
        records[r].date,
        records[r].card,
        records[r].merchant,
        records[r].amount,
        records[r].currency,
        "",
        records[r].emailHash, // Add the email checksum to the row
      ]);
    }
  }
}

function processTransactionEmails()
{
  var messages = getRelevantMessages();
  var records = parseMessageData(messages);
  saveDataToSheet(records);
  labelMessagesAsDone(messages);
  return true;
}

function labelMessagesAsDone(messages)
{
  var label = 'axis_processed';
  var label_obj = GmailApp.getUserLabelByName(label);
  if(!label_obj)
  {
    label_obj = GmailApp.createLabel(label);
  }
  
  for(var m =0; m < messages.length; m++ )
  {
     label_obj.addToThread(messages[m].getThread() );  
  }
  
}

function doGet()
{
  return getParsedDataDisplay();

  //return getMessagesDisplay();
}
