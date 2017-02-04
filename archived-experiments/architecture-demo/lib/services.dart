import 'dart:async';
import 'globals.dart';
import 'dart:convert';
import 'model.dart';

class Watchdog {
  Timer timer;

  Watchdog() {

    timer = new Timer.periodic(new Duration(seconds: 10), (_) => tick());
    print ("Watchdog timer started");
  }

  tick() {
    print ("Saving model");
    print (model.serialise());
  }
}

// TODO Add Epoch time

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

class UndoManager {

  static const MAX_UNDO_LEVELS = 50;
  int pointer = 0;
  List<Model> modelUndoStack = [];
  List<Schema> schemaUndoStack = [];

  void markUndoPoint() {
    while (pointer >= modelUndoStack.length - 1) {
      // We we're at the top of the stack
      modelUndoStack.removeLast();
      schemaUndoStack.removeLast();
    }

    modelUndoStack.add(model);
    schemaUndoStack.add(schema);

    if (modelUndoStack.length > MAX_UNDO_LEVELS) {
      modelUndoStack.removeAt(0);
      schemaUndoStack.removeAt(0);
    }
  }

  bool get canUndo => pointer != 0;
  bool get canRedo => pointer != modelUndoStack.length - 1 && modelUndoStack.length != 0;


  void undo() {
    if (!canUndo) return;

    pointer--;
    model = modelUndoStack[pointer];
    schema = schemaUndoStack[pointer];
  }

  void redo() {
    if (!canRedo) return;

    pointer++;
    model = modelUndoStack[pointer];
    schema = schemaUndoStack[pointer];
  }
}
