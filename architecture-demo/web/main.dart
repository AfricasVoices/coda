
import 'package:architecture_demo/services.dart';
import 'package:architecture_demo/globals.dart';
import 'package:architecture_demo/model.dart';


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
