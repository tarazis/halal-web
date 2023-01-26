// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// When the 'blur' button is clicked, send a 'blur' action to content script
document.getElementById('blur').addEventListener("click", async () => {
    console.log('sending message to content..')
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'blur' })
});

// When 'unblur' button is clicked, send a 'unblur' action to content script
document.getElementById('unblur').addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'unblur' })
});




// // Initialize button with user's preferred color
// // This is a button
// let changeColor = document.getElementById("changeColor");
// let colorChanged = false;

// chrome.storage.sync.get("color", ({ color }) => {
//   changeColor.style.backgroundColor = color;
// });

// // When the button is clicked, inject setPageBackgroundColor into current page
// changeColor.addEventListener("click", async () => {
//     let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     chrome.storage.local.set({
//         colorChanged: colorChanged
//     }, () => {
//             chrome.scripting.executeScript({
//                 target: { tabId: tab.id },
//                 func: setPageBackgroundColor,
//             });
//     });

//     // Once color is changed, toggle flag
//     toggleColorChange()
// });
  
// // The body of this function will be executed as a content script inside the
// // current page
// function setPageBackgroundColor() {
//     let colorChangedFlag
//     let backgroundColor
//     console.log('hey 1')

//     chrome.storage.local.get('colorChanged', function (items) {
//         console.log('hey 2')

//         colorChangedFlag = items.colorChanged
//         chrome.storage.local.remove('colorChanged');
//     });
//     console.log('hey 3')

//     chrome.storage.sync.get("color", ({ color }) => {
//         console.log('hey 4')

//         backgroundColor = colorChangedFlag ? 'transparent' : color
//         document.body.style.backgroundColor = backgroundColor;
//     });
// }

// // monitor everytime background color changes
// function toggleColorChange() {
//     colorChanged = !colorChanged
// }