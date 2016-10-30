/// <reference path="typings/chrome/chrome.d.ts" />
var accText = "";
document.addEventListener('DOMContentLoaded', function () {
    var dataDiv = document.getElementById('data');
    dataDiv.innerHTML = "woof";
    var doge = true;
    dataDiv.addEventListener('click', function () {
        var text = "woof";
        if (doge)
            text = "meow";
        dataDiv.innerText = text;
        accText += text;
        chrome.storage.local.set({ "text": accText }, function () {
            chrome.storage.local.get(function (items) {
                console.log("Items: " + items["text"]);
            });
        });
        doge = !doge;
        chrome.storage.local.getBytesInUse(function (bytesUnUse) {
            console.log(accText.length);
            console.log("Bytes in use: " + bytesUnUse);
            console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
        });
    }, false);
    // document.getElementById('storageData').innerHTML =
    // print ( chrome.storage.local.QUOTA_BYTES );
    // + "<br /> InUse: " + bytesUnUse
    // print (bytesUnUse.toString());
});
