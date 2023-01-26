// background.js

let BLUR_FLAG = true

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ BLUR_FLAG });
});


