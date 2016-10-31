
import 'package:architecture_demo/services.dart';
import 'package:architecture_demo/globals.dart';
import 'package:architecture_demo/model.dart';


void main() {
  hound = new Watchdog();
  model = new Model.empty();
  undoManager = new UndoManager();


  // Create an empty model
  model.setDataRow(0, {"timestamp" : 34, "text" : "txt"});
  // print (model.getDataRow(0));

  String serialModel = model.serialise();
  model = new Model.fromData(serialModel);

  undoManager.markUndoPoint();

  // print (model.getDataRow(0));


  // var savedModel = model.serialise();
  // var loadedModel = new Model.fromData(savedModel);
  // model = loadedModel;
  // print ("Model loaded");
}
