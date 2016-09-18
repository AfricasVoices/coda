import 'dart:io';

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

DataSet csvImport(String csvPath) {

}

DataSet jsonImport(String jsonPath) {

}


csvExport(Dataset dataset, String datasetPath) {
  // var outFile = new File(datasetPath);

  // Compute columns

  // Sort the sessions in the dataset
  var sessionIds = dataset.sessions.keys.map(int.parse).toList()..sort();
  for (var sessionId in sessionIds) {
    var session = dataset.sessions["$sessionId"];

  }


}

jsonExport(Dataset dataset, String outputpath) {

}


main(List<String> args) {
  var dataset = importOriginalDataset(args[0]);
  csvExport(dataset, null);
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
