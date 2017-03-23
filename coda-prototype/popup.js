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
/*
 handler for the UI interactions from the Chrome extension
 */
/// <reference path="typings/chrome/chrome.d.ts" />
document.addEventListener('DOMContentLoaded', function () {
    var checkPageButton = document.getElementById('checkPage');
    checkPageButton.addEventListener('click', function () {
        // on every startup of CODA, check if storage is expired, i.e. more than 30 days have passed since last edit
        // if yes, clear storage
        function isExpired(a, b) {
            var _MS_PER_DAY = 1000 * 60 * 60 * 24;
            // a and b are javascript Date objects
            function dateDiffInDays(a, b) {
                // Discard the time and time-zone information.
                let utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
                let utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
                return Math.floor((utc2 - utc1) / _MS_PER_DAY);
            }
            return (30 <= dateDiffInDays(a, b));
        }
        function launch() {
            // http://stackoverflow.com/a/36000860
            chrome.tabs.query({}, function (tabs) {
                var doFlag = true;
                for (var i = tabs.length - 1; i >= 0; i--) {
                    console.log(tabs[i].url);
                    if (tabs[i].url === "chrome-extension://" + chrome.runtime.id + "/ui.html") {
                        // Coda is already open!
                        doFlag = false;
                        break;
                    }
                }
                if (!doFlag) {
                    // already open, so focus first on the window and then on the tab
                    chrome.windows.update(tabs[i].windowId, { "focused": true }, () => {
                        chrome.tabs.update(tabs[i].id, { active: true });
                    });
                }
                else {
                    // initialize new Coda
                    chrome.tabs.create({ url: chrome.extension.getURL("ui.html") });
                }
            });
        }
        chrome.storage.local.get("lastEdit", (editObj) => {
            console.log(editObj);
            editObj["lastEdit"] = new Date(JSON.parse(editObj["lastEdit"]));
            console.log(editObj["lastEdit"]);
            if (Object.prototype.toString.call(editObj["lastEdit"]) === "[object Date]") {
                if (!isNaN((editObj["lastEdit"]).getTime())) {
                    // date is in valid format
                    if (isExpired(new Date(), editObj["lastEdit"])) {
                        new Promise(function (resolve, reject) {
                            chrome.storage.local.remove(["dataset", "schemes"], () => {
                                let error = chrome.runtime.lastError;
                                if (error) {
                                    reject(new Error(error.message));
                                }
                                else {
                                    resolve();
                                }
                            });
                        }).then(() => {
                            console.log("Cleared expired storage");
                            launch();
                        }).catch(error => console.log(error));
                    }
                    else {
                        launch();
                    }
                }
            }
        });
    }, false);
    var clearCacheButton = document.getElementById('clearCache');
    clearCacheButton.addEventListener('click', function () {
        chrome.storage.local.remove(["dataset", "schemes"], () => {
            var error = chrome.runtime.lastError;
            if (error) {
                console.log(error);
            }
            else {
                console.log("Storage cleared!");
                chrome.storage.local.getBytesInUse((bytesUnUse) => {
                    console.log(accText.length);
                    console.log("Bytes in use: " + bytesUnUse);
                    console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
                });
                chrome.tabs.query({}, function (tabs) {
                    var doFlag = true;
                    for (var i = tabs.length - 1; i >= 0; i--) {
                        console.log(tabs[i].url);
                        if (tabs[i].url === "chrome-extension://" + chrome.runtime.id + "/ui.html") {
                            // Coda is already open!
                            doFlag = false;
                            break;
                        }
                    }
                    if (!doFlag) {
                        // already open, so close the open tab first
                        // todo PROMPT TO EXPORT data before wiping cache in the existing tab
                        chrome.tabs.remove([tabs[i].id], () => {
                            chrome.tabs.create({ url: chrome.extension.getURL("ui.html") });
                        });
                    }
                    else {
                        chrome.tabs.create({ url: chrome.extension.getURL("ui.html") });
                    }
                });
            }
        });
    });
}, false);
