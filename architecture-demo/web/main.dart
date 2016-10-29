import 'dart:html';
import 'dart:async';
import 'dart:convert';

Model activeModel;
Watchdog hound;

void main() {
  print ("Hello null");
  hound = new Watchdog();

  // Create an empty model
  var model = new Model.empty();
  activeModel = model;
  model.setDataRow(0, {"timestamp" : 34, "text" : "txt"});

  var savedModel = model.serialise();
  var loadedModel = new Model.fromData(savedModel);
  activeModel = loadedModel;
  print ("Model loaded");
}

class Model {
  Map<int, Map> _data = {};

  Map getDataRow(int rowID) {
    return _data[rowID];
  }

  setDataRow(int rowId, Map data) {
    _data[rowId] = data;
  }

  String serialise() {
    // Replace the index structures with strings
    Map<String, Map> serialiseData = {};
    _data.forEach((k, v) {
      serialiseData["$k"] = v;
    });

    return JSON.encode(serialiseData);
  }

  Model.fromData(String data) {
    Map<String, Map> serialisedData = JSON.decode(data);

    serialisedData.forEach((k, v) {
      _data[int.parse(k)] = v;
    });
  }

  Model.empty() { }
}

class Watchdog {
  Timer timer;

  Watchdog() {

    timer = new Timer.periodic(new Duration(seconds: 10), (_) => tick());
    print ("Watchdog timer started");
  }

  tick() {
    print ("Saving model");
    print (activeModel.serialise());
  }
}

class InstrumentationService{
  String userUUID;
  int sequenceId = 0;
  String sessionID;

  InstrumentationService(this.userUUID) {
  }

  _recordMessage(String message) {
    print ("$userUUID:$sequenceId:$message");

    sequenceId++;
  }

  recordAction(String actionName, List<String> arguments) {
    _recordMessage(JSON.encode(
      {"ActionName": actionName, "Arguments" : arguments}));
  }

  recordPerf(String name, int time) {
    _recordMessage(JSON.encode(
      {"PerfName": name, "Time":time }
    ));
  }
}
