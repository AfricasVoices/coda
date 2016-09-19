import 'dart:io';
import 'dart:convert';

import 'package:av_datastructures/dataset.dart';
import 'package:av_datastructures/events.dart';
import 'package:av_datastructures/sessions.dart';

const String seperator = ';';

Dataset importOriginalDataset(String inputPath) {
  Dataset dataset = new Dataset();

  List<String> lines = new File(inputPath).readAsLinesSync();
  lines.removeAt(0); // Drop the header row
  // subscriber_;message_body;timestamp_;type

  for (String ln in lines) {
    try {
      List<String> dataElements = ln.split(seperator);
      String subscriber = dataElements.length > 0 ? dataElements[0] : null;
      String message = dataElements.length > 1 ? dataElements[1] : null;
      String timestamp = dataElements.length > 2 ? dataElements[2] : null;
      timestamp = _fixTimestampFormat(timestamp);
      String type = dataElements.length > 3 ? dataElements[3] : null;

      // Subscriber -> sessionId
      dataset.sessions.putIfAbsent(subscriber, () => new Session(subscriber, []));

      // Setup the event for this message
      RawEvent event = new RawEvent("message", timestamp, null, message);

      // Decorate with the type
      event.decorate("type", type);

      dataset.sessions[subscriber].events.add(event);
    } catch (e, st) {
      print (ln);
      print ("$e \n $st");
    }
  }

  // Walk over the datastructure fixing up the event names
  for (Session s in dataset.sessions.values) {
    // Fix this not working because of their stupid month first timestamp
    s.events.sort((e1, e2) => e1.timestamp.compareTo(e2.timestamp));
    int i = 0;
    for (RawEvent e in s.events) {
      e.name = "${e.name}_$i";
      i++;
    }
  }

  return dataset;
}

Dataset csvImport(String csvPath) {
  Dataset dataset = new Dataset();

  List<String> dataLines = new File(csvPath).readAsLinesSync();

  String headerRow = dataLines.removeAt(0);
  List<String> headerItems = headerRow.split(";");
  int colCount = headerItems.length;

  String elementFor(List<String> elements, String name) {
    int indexOfName = headerItems.indexOf(name);
    return elements[indexOfName];
  }

  for (String ln in dataLines) {

    List<String> elements = ln.split(seperator);

    Session session = new Session(
      elementFor(elements, "sessionId"), []);
    print ("Session: ${session.id}");
    dataset.sessions[session.id] = session;

    RawEvent workingEvent;

    int lastTimestampIndex = 1;
    for (int i = lastTimestampIndex; i < colCount; i++) {
      if (headerItems[i].endsWith("_timestamp")) {
        // We've completed the previous event
        if (workingEvent != null && workingEvent.data != "") session.events.add(workingEvent);

        lastTimestampIndex = i;

        String timestamp = elements[i];
        i++; // Skip to data
        String data = elements[i];

        print ("name: ${headerItems[i]}");
        print ("timestamp: $timestamp");
        print ("data: $data");

        workingEvent = new RawEvent(headerItems[i], timestamp, null, data);
        continue;
      }

      // Otherwise we're dealing with a decoration
      String headerName = headerItems[i];
      String decorationValue = elements[i];

      if (decorationValue == "") continue;

      String decorationName = headerName.substring(workingEvent.name.length + 1);

      print ("Decorating: $decorationName -> $decorationValue");
      workingEvent.decorate(decorationName, decorationValue);
    }

    if (workingEvent.data == "") continue;
    session.events.add(workingEvent);
  }

  return dataset;
}

Dataset jsonImport(String jsonPath) {
  Dataset dataset = new Dataset();

  var datasetJson = JSON.decode(new File(jsonPath).readAsStringSync());
  Map sessionMap = datasetJson;
  for (var sessionId in sessionMap.keys) {
    dataset.sessions.putIfAbsent(sessionId, () => new Session(sessionId, []));

    List eventsList = sessionMap[sessionId]["events"];
    for (var eventMap in eventsList) {
      String name = eventMap["name"];
      String timestamp = eventMap["timestamp"];
      String data = eventMap["data"];

      var event = new RawEvent(name, timestamp, null, data);
      for (var decorationName in eventMap["decorations"].keys) {
        event.decorate(decorationName, eventMap["decorations"][decorationName]);
      }

      dataset.sessions[sessionId].events.add(event);
    }
  }

  return dataset;
}


csvExport(Dataset dataset, String datasetPath) {
  var file = new File(datasetPath);

  // Compute header row
  List<String> headerItems = [];
  headerItems.add("sessionId");

  // Messages
  for (Session session in dataset.sessions.values) {
    for (RawEvent e in session.events) {
      if (!headerItems.contains(e.name)) {
        headerItems.add("${e.name}_timestamp");
        headerItems.add(e.name);
      }

      for (String decorationName in e.decorations.keys) {
        String mangledDecorationName = "${e.name}_$decorationName";
        if (!headerItems.contains(mangledDecorationName)) {
          int indexOfMessage = headerItems.indexOf(e.name);
          headerItems.insert(indexOfMessage + 1, mangledDecorationName);
        }
      }
    }
  }

  // Populate data rows
  List<List<String>> dataRows = [];

  for (Session session in dataset.sessions.values) {
    // Populate the row with empties
    List<String> row = new List<String>.filled(headerItems.length, "");
    dataRows.add(row);

    row[headerItems.indexOf("sessionId")] = session.id;

    for (RawEvent e in session.events) {
      String name = e.name;
      row[headerItems.indexOf(name)] = e.data;
      row[headerItems.indexOf('${e.name}_timestamp')] = e.timestamp;

      for (String decorationName in e.decorations.keys) {
        String mangledDecorationName = "${e.name}_$decorationName";
        row[headerItems.indexOf(mangledDecorationName)] = e.decorations[decorationName].value;
      }
    }
  }

  StringBuffer sb = new StringBuffer();
  sb.writeln(headerItems.join(seperator));

  for (List<String> rowItems in dataRows) {
    sb.writeln(rowItems.join(seperator));
  }

  file.writeAsStringSync(sb.toString());
}

jsonExport(Dataset dataset, String outputPath) {

  Map datasetMap = {};
  for (var sessionId in dataset.sessions.keys) {
    Map sessionMap = {};

    var session = dataset.sessions[sessionId];
    for (var event in session.events) {
      Map eventMap = {};

      Map decorationMap = {};
      for (var decorationName in event.decorations.keys) {
        decorationMap[decorationName] = "${event.decorationForName(decorationName).value}";
      }
      eventMap["decorations"] = decorationMap;

      eventMap["name"] = event.name;
      eventMap["timestamp"] = event.timestamp;
      eventMap["data"] = event.data;

      sessionMap.putIfAbsent("events", () => []);
      sessionMap["events"].add(eventMap);
    }

    datasetMap[sessionId] = sessionMap;
  }

  String encoded = JSON.encode(datasetMap);
  new File(outputPath).writeAsStringSync(encoded);
}


main(List<String> args) {
  if (args.length != 3) {
    _printHelpText();
    exit(1);
  }

  String inputPath = args[1];
  String outputPath = args[2];

  switch (args[0].toLowerCase()) {
    case "raw2json":
      print ("Converting raw to json format");
      var dataset = importOriginalDataset(inputPath);
      jsonExport(dataset, outputPath);
      break;
    case "json2csv":
      print ("Converting from json to csv format");
      var dataset = jsonImport(inputPath);
      csvExport(dataset, outputPath);
      break;
    case "csv2json":
      print ("Converting from csv to json format");
      var dataset = csvImport(inputPath);
      jsonExport(dataset, outputPath);
      break;
    default:
      print ("Unknown action: ${args[0]}");
      _printHelpText();
      exit(1);
  }


}

// Support utils for silly data format

String _fixTimestampFormat(String timestamp) {
  // Rationalise the timestamp
  int month = int.parse(timestamp.split("/")[0]);
  int day = int.parse(timestamp.split("/")[1]);
  int year = int.parse(timestamp.split("/")[2].split(" ")[0]) + 2000;
  int hour = int.parse(timestamp.split(":")[0].split(" ")[1]);
  int min = int.parse(timestamp.split(":")[1]);
  return new DateTime(year, month, day, hour, min).toString();
}

_printHelpText() {
  print ("Usage: dart tools.dart action input_path output_path");
  print ("Currently supported actions:");
  print ("\traw2json");
  print ("\tjson2csv");
  print ("\tcsv2json");
}
