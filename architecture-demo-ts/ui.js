/*
    Demo of interacting with Chrome local storage from TypeScript and
    a Chrome extension.
*/
// Globals
var watchdog;
var model;
var schema;
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
        if (isDog)
            text = "meow";
        dataDiv.innerText = text;
        accText += text;
        chrome.storage.local.set({ "text": accText }, function () {
            chrome.storage.local.get(function (items) {
                console.log("Items: " + items["text"]);
            });
        });
        isDog = !isDog;
        chrome.storage.local.getBytesInUse(function (bytesUnUse) {
            console.log(accText.length);
            console.log("Bytes in use: " + bytesUnUse);
            console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
        });
    }, false);
});
// Data model
var Model = (function () {
    function Model() {
    }
    Model.prototype.serialise = function () {
        return "modelJSON";
    };
    return Model;
}());
var Schema = (function () {
    function Schema() {
        this.codingSchemes = [];
    }
    Schema.prototype.serialise = function () {
        return JSON.stringify(this.codingSchemes);
    };
    Schema.deserialise = function (jsonData) {
        var s = new Schema();
        var decode = JSON.parse(jsonData);
        for (var _i = 0, decode_1 = decode; _i < decode_1.length; _i++) {
            var entry = decode_1[_i];
            s.codingSchemes.push(new SchemaEntry(entry['codingSchemeName'], entry['codes'], entry['shortcuts']));
        }
        return s;
    };
    return Schema;
}());
var SchemaEntry = (function () {
    function SchemaEntry(codingSchemeName, codes, shortcuts) {
        this.codingSchemeName = codingSchemeName;
        this.codes = codes;
        this.shortcuts = shortcuts;
    }
    return SchemaEntry;
}());
// Services 
var Watchdog = (function () {
    function Watchdog() {
        console.log("Watchdog ctor");
        var f = this.tick;
        setInterval(function () { f(); }, 500);
    }
    Watchdog.prototype.tick = function () {
        console.log("Watchdog tick");
    };
    return Watchdog;
}());
var UndoManager = (function () {
    function UndoManager() {
        this.pointer = 0;
        this.modelUndoStack = [];
        this.schemaUndoStack = [];
    }
    UndoManager.prototype.markUndoPoint = function () {
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
    };
    UndoManager.prototype.canUndo = function () { return this.pointer != 0; };
    UndoManager.prototype.canRedo = function () {
        return this.pointer
            != this.modelUndoStack.length - 1 && this.modelUndoStack.length != 0;
    };
    UndoManager.prototype.undo = function () {
        if (!this.canUndo())
            return;
        this.pointer--;
        model = this.modelUndoStack[this.pointer];
        schema = this.schemaUndoStack[this.pointer];
    };
    UndoManager.prototype.redo = function () {
        if (!this.canRedo())
            return;
        this.pointer++;
        model = this.modelUndoStack[this.pointer];
        schema = this.schemaUndoStack[this.pointer];
    };
    UndoManager.MAX_UNDO_LEVELS = 50;
    return UndoManager;
}());
