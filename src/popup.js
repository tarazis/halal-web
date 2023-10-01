// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Note 1: Currently 'options' is accessible by invoking google storage api let options = await helper.getOptions()
 * This is because there is no way to have a global variable accessible from all scripts of the extension
 * 
 * Note 2: Currently, 'options' gets updated in the content page only for consistency 
 */

// Initialize extension popup form fields, values, and adds event listeners to elements.
let hostname = null
let pathname = null
let helper = null
let options = null
let locked = true
let whitelistBtn, dangerlistBtn, blurBtn, lockBtn, elementBlurSlider, iconBlurSlider, elementBlurText, iconBlurText

async function popupInit() {
    console.log('heey')
    helper = new Helper()
    whitelistBtn = getById('whitelist-domain-btn')
    dangerlistBtn = getById('dangerlist-domain-btn')
    blurBtn = getById('blur-button')
    lockBtn = getById('lock-button')
    elementBlurSlider = getById('blur-level-elements')
    iconBlurSlider = getById('blur-level-icons')
    elementBlurText = getById('elementBlurAmt')
    iconBlurText = getById('iconBlurAmt')

    // Initialize options if first time
    options = await helper.getOptions(true)
    console.log('hey')

    /* populate UIs: */

    // Populate blur levels
    populateBlurLevels()

    // Populate whitelist
    populateWhitelistUrl()

    /* Event listeners: */

    // Add event listener to whitelist domain
    whitelistBtn.addEventListener('click', async () => {
        await sendMessageToContent('whitelistDomain')
        websiteIsWhitelisted()
    })

    // Add event listener to danger list domain
    dangerlistBtn.addEventListener('click', async () => {
        await sendMessageToContent('dangerlistDomain')
        websiteIsDangerlisted()
    })

    // Add a click listener to blur/unblur button to be notified when a user clicks the button
    // Then send a message to content.js telling it to blur or unblur the page
    // Note: content.js is the web page specific script which has access to the DOM of the web page
    blurBtn.addEventListener("click", async () => { await sendMessageToContent('blurUnblurPage')});

    // update slider text and options object with new value
    // TODO: put into method
    elementBlurSlider.addEventListener('change', async () => {
        consoleLog('element slider moved!')
        let newValue = elementBlurSlider.value

        // update popup accordingly
        elementBlurText.value = newValue + 'px'

        // update options
        options.blurAmount.element = newValue

        // Reflect blur on content page
        await sendMessageToContent('updateBlurElement', newValue)
    })

    // update slider text and options object with new value
    // (TODO: only update options in content page)
    iconBlurSlider.addEventListener('change', async () => {
        let newValue = iconBlurSlider.value

        // update popup accordingly
        iconBlurText.value = newValue + 'px'

        // update options
        options.blurAmount.icon = newValue

        // Reflect blur on content page
        await sendMessageToContent('updateBlurIcon', newValue)
    })

    // Lock all buttons by default
    lockButtons(true)

    // disable hover unblur by default
    await sendMessageToContent('lockHover', true)

    // Add event listener to lock button in order to lock/unlock blurring
    // Only unlock buttons and hover if user confirms
    lockBtn.addEventListener("click", async () => {
        // If button was unchecked, ask user for confirmation.
        if(!lockBtn.checked) {
            ConfirmDialog('!! HARAM CONTENT MAY APPEAR !!');
        } else {
            // If button was just checked, then lock buttons and hover
            lockButtons(true)
            await sendMessageToContent('lockHover', true)
        }
    })

}

async function handleLockConfirmation(response) {
    // If user proceeds, then unlock popup buttons and hover
    if (response) {
        lockButtons(false)
        await sendMessageToContent('lockHover', false)
        // If user does not proceed, recheck button and do nothing (buttons will be locked by default)
    } else {
        lockBtn.checked = true
    }
}
function ConfirmDialog(message) {
    $('<div></div>').appendTo('body')
      .html('<div><p>' + message + '</p><p>Proceed?</p></div>')
      .dialog({
        modal: true,
        title: '!! HARAM WARNING !!',
        zIndex: 10000,
        autoOpen: true,
        width: 'auto',
        resizable: false,
        buttons: {
          Yes: function() {
            $(this).dialog("close");
            handleLockConfirmation(true)
          },
          No: function() {  
            $(this).dialog("close");
            handleLockConfirmation(false)
          }
        },
        close: function(event, ui) {
          $(this).remove();
        }
      });
}


function lockButtons(value) {
    blurBtn.disabled = value
    elementBlurSlider.disabled = value
    iconBlurSlider.disabled = value
    whitelistBtn.disabled = value
    dangerlistBtn.disabled = value
}
async function populateBlurLevels() {
    let elementBlurSlider = getById('blur-level-elements')
    let iconBlurSlider = getById('blur-level-icons')
    let elementBlurText = getById('elementBlurAmt')
    let iconBlurText = getById('iconBlurAmt')

    // Get current blur amount and populate popup
    let blurElVal = options.blurAmount?.element
    let blurIconVal = options.blurAmount?.icon

    // set blur amount in popup
    elementBlurSlider.value = blurElVal
    elementBlurText.value = blurElVal + 'px'
    iconBlurSlider.value = blurIconVal
    iconBlurText.value = blurIconVal + 'px'
}

async function populateWhitelistUrl() {
    let url = await sendMessageToContent('getPageUrl')
    let domainP = getById('domain')

    // get url details
    hostname = url.hostname
    pathname = url.pathname
    domainP.innerHTML = hostname

    // domain whitelisted, change text of whitelist button
    if(options.whitelistedDomains.includes(hostname)) {
        websiteIsWhitelisted()
    } else {
        websiteIsDangerlisted()
    }
}

function websiteIsWhitelisted() {
    getById('whitelist-domain-btn').style.setProperty('display', 'none')
    getById('dangerlist-domain-btn').style.setProperty('display', 'inline-block')
    getById('domain').style.setProperty('color', '#1ED760')
}

function websiteIsDangerlisted() {
    getById('dangerlist-domain-btn').style.setProperty('display', 'none')
    getById('whitelist-domain-btn').style.setProperty('display', 'inline-block')
    getById('domain').style.setProperty('color', 'red')
}

function getById(id) {
    return document.getElementById(id)
}

async function sendMessageToContent(message, value) {
    let [tab] = await chrome.tabs?.query({ active: true, currentWindow: true });
    // the key 'action' here is optionally chosen. could have named it 'message' or anything else. 
    return await chrome.tabs?.sendMessage(tab.id, { action: message, value})
}

// send a message to content script
async function consoleLog(message) {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'consoleLog', message })
}

popupInit()
