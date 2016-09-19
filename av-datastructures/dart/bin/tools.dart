import 'dart:io';
import 'dart:convert';

import 'package:av_datastructures/dataset.dart';
import 'package:av_datastructures/events.dart';
import 'package:av_datastructures/sessions.dart';

const String split = ';';

Dataset importOriginalDataset(String inputPath) {
  Dataset dataset = new Dataset();

  List<String> lines = new File(inputPath).readAsLinesSync();
  lines.removeAt(0); // Drop the header row
  // subscriber_;message_body;timestamp_;type

  for (String ln in lines) {
    try {
      List<String> dataElements = ln.split(split);
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
  // // var outFile = new File(datasetPath);
  //
  // // Compute columns
  //
  // // Sort the sessions in the dataset
  // var sessionIds = dataset.sessions.keys.map(int.parse).toList()..sort();
  // for (var sessionId in sessionIds) {
  //   var session = dataset.sessions["$sessionId"];
  //
  // }
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
