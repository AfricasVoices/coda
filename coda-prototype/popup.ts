/*
  handler for the UI interactions from the Chrome extension
*/

/// <reference path="typings/chrome/chrome.d.ts" />

document.addEventListener('DOMContentLoaded', function() {
  var checkPageButton = document.getElementById('checkPage');
  checkPageButton.addEventListener('click', function() {

    chrome.tabs.create({url:chrome.extension.getURL("ui.html")});
  }, false);
}, false);