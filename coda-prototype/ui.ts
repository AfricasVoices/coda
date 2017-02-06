/*
    Demo of interacting with Chrome local storage from TypeScript and
    a Chrome extension.
*/

// Globals
var watchdog : Watchdog;
var model : Model;
var schema : Schema;


var accText = "";

document.addEventListener('DOMContentLoaded', function () {
    var dataDiv = document.getElementById('data');

    dataDiv.innerHTML = "woof";
    var isDog = true;
    console.log("About to call ctor");
    watchdog = new Watchdog();
    console.log("ctor call done");
    

    dataDiv.addEventListener('click', function () {
        var text = "woof";
        if (isDog) text = "meow";
        dataDiv.innerText = text;

        accText += text;
        chrome.storage.local.set({"text" : accText}, () => {
            chrome.storage.local.get((items) => {
                console.log("Items: " + items["text"]);
            });
        });

        isDog = !isDog;

        chrome.storage.local.getBytesInUse((bytesUnUse: number) => {
            console.log(accText.length);
        console.log("Bytes in use: " + bytesUnUse);
        console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
        });
    }, false);
});


// Data model

class Model {
    schema : Schema;

    serialise() : string {
        return "modelJSON";
    }

}

class Schema {
    codingSchemes : Array<SchemaEntry>;

    constructor() {
        this.codingSchemes = [];
    }

    serialise() : string {
        return JSON.stringify(this.codingSchemes);
    }

    static deserialise(jsonData : string) : Schema {
        let s : Schema = new Schema();

        var decode = JSON.parse(jsonData);
        for (var entry of decode) {
            s.codingSchemes.push(
                new SchemaEntry(
                    entry['codingSchemeName'],
                    entry['codes'],
                    entry['shortcuts']
                )
            );
        }
        return s;
    }
}

class SchemaEntry {
    codingSchemeName : string;
    codes : Array<string>;
    shortcuts : Array<string>;

    constructor(codingSchemeName : string,
        codes : Array<string>, shortcuts : Array<string>) {
        this.codingSchemeName = codingSchemeName;
        this.codes = codes;
        this.shortcuts = shortcuts;
    }
}

// Services 

class Watchdog {
    constructor() {
        console.log("Watchdog ctor");

        var f = this.tick;
        setInterval(function() { f() }, 500);
    }
    tick() {
        console.log("Watchdog tick");
    }
}


class UndoManager {

  static MAX_UNDO_LEVELS = 50;
  pointer : number = 0;
  modelUndoStack : Array<Model>  = [];
  schemaUndoStack : Array<Schema> = [];

  markUndoPoint() {
    while (this.pointer >= this.modelUndoStack.length - 1) {
      // We we're at the top of the stack
      this.modelUndoStack.pop();
      this.schemaUndoStack.pop();
    }

    this.modelUndoStack.push(model);
    this.schemaUndoStack.push(schema);

    if (this.modelUndoStack.length > UndoManager.MAX_UNDO_LEVELS) {
      this.modelUndoStack.splice(0, 1);
      this.schemaUndoStack.splice(0, 1);
    }
  }

   canUndo() : boolean { return this.pointer != 0; }
   canRedo() : boolean { return this.pointer 
       != this.modelUndoStack.length - 1 && this.modelUndoStack.length != 0; }


  undo() {
    if (!this.canUndo()) return;

    this.pointer--;
    model = this.modelUndoStack[this.pointer];
    schema = this.schemaUndoStack[this.pointer];
  }

  redo() {
    if (!this.canRedo()) return;

    this.pointer++;
    model = this.modelUndoStack[this.pointer];
    schema = this.schemaUndoStack[this.pointer];
  }
}
