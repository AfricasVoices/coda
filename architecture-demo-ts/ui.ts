/*
    Demo of interacting with Chrome local storage from TypeScript and
    a Chrome extension.
*/


/// <reference path="typings/chrome/chrome.d.ts" />

var accText = "";

document.addEventListener('DOMContentLoaded', function () {
    var dataDiv = document.getElementById('data');

    dataDiv.innerHTML = "woof";
    var isDog = true;
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