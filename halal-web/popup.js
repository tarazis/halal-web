// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Initialize extension popup form fields, values, and adds event listeners to elements.
let options = null
let hostname = null
let pathname = null

function popupInit() {
    let whitelistBtn = getBtn('whitelist-domain-btn')
    let dangerlistBtn = getBtn('dangerlist-domain-btn')
    let blurBtn = getBtn('blur-button')
    let domainP = getBtn('domain')

    // Get page hostname and path and update popup accordingly
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getPageUrl" }, (url) => {
            // get url details
            hostname = url.hostname
            pathname = url.pathname
            domainP.innerHTML = hostname

            // update popup if url is whitelisted
            let whitelistedDomains = []
            chrome.storage.sync.get(['whitelistedDomains']).then((res) => {
                if(res.whitelistedDomains) {
                    whitelistedDomains = res.whitelistedDomains
                }

                // domain whitelisted, change text of whitelist button
                if(whitelistedDomains.includes(hostname)) {
                    websiteIsWhitelisted()
                } else {
                    websiteIsDangerlisted()
                }
        
            })
        })
    });

    // Add event listener to whitelist domain
    whitelistBtn.addEventListener('click', async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'whitelistDomain' }, (res) => {
            websiteIsWhitelisted()
        })
    })

    // Add event listener to danger list domain
    dangerlistBtn.addEventListener('click', async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'dangerlistDomain' }, (res) => {
            websiteIsDangerlisted()

        })
    })

    // Add a click listener to blur/unblur button to be notified when a user clicks the button
    // Then send a message to content.js telling it to blur or unblur the page
    // Note: content.js is the web page specific script which has access to the DOM of the web page
    blurBtn.addEventListener("click", async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, { action: 'blurUnblurPage' })
    });

}

function websiteIsWhitelisted() {
    getBtn('whitelist-domain-btn').style.setProperty('display', 'none')
    getBtn('dangerlist-domain-btn').style.setProperty('display', 'inline-block')
    getBtn('domain').style.setProperty('color', '#1ED760')
}

function websiteIsDangerlisted() {
    getBtn('dangerlist-domain-btn').style.setProperty('display', 'none')
    getBtn('whitelist-domain-btn').style.setProperty('display', 'inline-block')
    getBtn('domain').style.setProperty('color', 'red')
}

function getBtn(id) {
    return document.getElementById(id)
}

popupInit()
