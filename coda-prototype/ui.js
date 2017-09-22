/*
Copyright (c) 2017 Coda authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
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
    console.log("I made a pull request!");
    dataDiv.addEventListener('click', function () {
        var text = "woof";
        if (isDog)
            text = "meow";
        dataDiv.innerText = text;
        accText += text;
        chrome.storage.local.set({ "text": accText }, () => {
            chrome.storage.local.get((items) => {
                console.log("Items: " + items["text"]);
            });
        });
        isDog = !isDog;
        chrome.storage.local.getBytesInUse((bytesUnUse) => {
            console.log(accText.length);
            console.log("Bytes in use: " + bytesUnUse);
            console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
        });
    }, false);
});
// Data model
class Model {
    serialise() {
        return "modelJSON";
    }
}
class Schema {
    constructor() {
        this.codingSchemes = [];
    }
    serialise() {
        return JSON.stringify(this.codingSchemes);
    }
    static deserialise(jsonData) {
        let s = new Schema();
        var decode = JSON.parse(jsonData);
        for (var entry of decode) {
            s.codingSchemes.push(new SchemaEntry(entry['codingSchemeName'], entry['codes'], entry['shortcuts']));
        }
        return s;
    }
}
class SchemaEntry {
    constructor(codingSchemeName, codes, shortcuts) {
        this.codingSchemeName = codingSchemeName;
        this.codes = codes;
        this.shortcuts = shortcuts;
    }
}
