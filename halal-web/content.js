// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const GOOGLE_MAPS = 'www.google.com/maps'

let options = null
let helper = null
let PAGE_BLURRED = false
let ELEMENTS_TO_BLUR = ['img', 'image', 'picture', 'video', 'iframe', 'canvas', '*[style*="url"]', ':host']
let ICONS_TO_BLUR = ['svg', 'span[class*="icon-"]', ':before', ':after']
let ATTR_TO_BLUR_ELEMENT = ['[data-element-found-by-dom-scanner="true"]']
let ATTR_TO_BLUR_ICON = ['[data-icon-found-by-dom-scanner="true"]']
let ATTR_TO_BLUR_PSEUDO = ['[data-pseudo-found-by-dom-scanner="true"]']

// Keeps track of currently unhidden elements
let currently_unhidden_elements = []

function addBlurCSS() {
    let elementVal = options ? options?.blurAmount.element : Helper.initialOptions.blurAmount.element
    let iconVal = options ? options?.blurAmount.icon : Helper.initialOptions.blurAmount.icon

    let style = document.createElement('style')
    style.id = 'blur-css'
    style.innerHTML = ELEMENTS_TO_BLUR.length > 0 ? ELEMENTS_TO_BLUR.join(',') + ` { filter: blur(${elementVal}px) !important; }` : ''
    style.innerHTML += ATTR_TO_BLUR_ELEMENT.length > 0 ? ATTR_TO_BLUR_ELEMENT.join(',') + ` { filter: blur(${elementVal}px) !important; }` : ''
    style.innerHTML += ATTR_TO_BLUR_ICON.length > 0 ? ATTR_TO_BLUR_ICON.join(',') + ` { filter: blur(${iconVal}px) !important; }` : ''
    style.innerHTML += ICONS_TO_BLUR.length > 0 ? ICONS_TO_BLUR.join(',') + `{ filter: blur(${iconVal}px) !important; }` : ''
    style.innerHTML += '.halal-web-pseudo:before, .halal-web-pseudo:after { filter: blur(0px) !important; }'
    let parentElement = document.documentElement
    parentElement.appendChild(style)
}

function removeBlurCSS() {
    let style = document.getElementById('blur-css')
    if (style)
        document.documentElement.removeChild(style)
}


// Scans DOM every 100 ms for new elements to be blurred
const startDOMScanner = () => {
    document.addEventListener('mousemove', (e) => BlurUnBlur(e))

    window.DOMScannerInterval = setInterval(() => {
        triggerDOMScanner()
        document.querySelectorAll('span:before').forEach((el) => {
        })
    }, 500)
}

// Stop DOM scanner
const stopDOMScanner = () => {
    this.clearInterval(window.DOMScannerInterval)
    ELEMENTS_TO_BLUR.concat(ICONS_TO_BLUR).forEach((el) => unbindEventListeners(el)) 
    // TODO: clear mouse move event listener
}

// Bind event listeners to targeted elements
function triggerDOMScanner() {

    // Make sure body exists
    if (!window.document.body) return;

    begin = performance.now();

    // Get all elements in body
    let els = window.document.body.querySelectorAll('*')

    // Loop through elements
    els.forEach((el) => {
        let scannedElement = el
        // Get element background image property
        let elementBGStyle = window.getComputedStyle(scannedElement).getPropertyValue('background-image')

        // Find pseudo elements with content != none
        // and mark their parent element for later processing
        let pseudoElementIconFound = false;
        // let pseudoElement = window.getComputedStyle(scannedElement, '::before') || window.getComputedStyle(scannedElement, '::after')
        let pseudoElementBefore = window.getComputedStyle(scannedElement, '::before')
        let pseudoElementAfter = window.getComputedStyle(scannedElement, '::after')
        
        if(pseudoElementBefore != null || pseudoElementAfter != null) {
            let contentBefore = pseudoElementBefore.getPropertyValue('content')
            let contentAfter = pseudoElementAfter.getPropertyValue('content')
            if(contentBefore != 'none' || contentAfter != 'none') {
                pseudoElementIconFound = true
            }
        }

        // if element is in 'elements to blur' or if it has a background image:
        if (scannedElement.matches(ELEMENTS_TO_BLUR.concat(ICONS_TO_BLUR).join(',')) || elementBGStyle != 'none' || scannedElement.shadowRoot || pseudoElementIconFound) {
            if(!scannedElement.dataset.elementFoundByDomScanner && !scannedElement.dataset.iconFoundByDomScanner && !scannedElement.dataset.pseudoFoundByDomScanner) {
                // Save default filter
                scannedElement.defaultFilter = scannedElement.style.filter
                // Save default pointer event
                scannedElement.defaultPointerevents = scannedElement.style.pointerEvents
                // This is orgingally addded because some elements have pointer-events: none; which 
                // prevents mousemove event to detect the element.
                // The solution is to apply pointer-events: auto; to all elements.
                // If this causes an issue, we can instead apply this only to elements with "pointer events: none;"
                scannedElement.style.setProperty('pointer-events', 'auto')

                // This is done because some shadow root elements use display: content, which removes all the children
                // of the shadow root and puts them somewhere else on the DOM tree. As a result, the children of the shadow root
                // do not get blurred along with the shadow root itself. Note: we can only blur the shadow root element only and not its children due to security reasons.
                // Forcing display to be inline at all times ensures that the shadowroot elements will always be children of the shadow root and
                // so they will be blurred by blurring the shadow root element itself.
                if(scannedElement.shadowRoot) {
                    scannedElement.style.setProperty('display', 'inline', 'important')
                }

                // Due to security reasons, iframes do not trigger mouse events. However, they trigger mouse enter and leave.
                if(scannedElement.nodeName == 'IFRAME') {
                    scannedElement.addEventListener('mouseenter', (e) => BlurUnBlur(e))
                    scannedElement.addEventListener('mouseLeave', (e) => BlurUnBlur(e))
                }

                // it could have both icon and pseudoelement
                if(scannedElement.matches(ICONS_TO_BLUR.join(',')) || pseudoElementIconFound) {
                    if(pseudoElementIconFound) {
                        scannedElement.dataset.pseudoFoundByDomScanner = true
                    } else {
                        scannedElement.dataset.iconFoundByDomScanner = true
                    }
                } else {
                    scannedElement.dataset.elementFoundByDomScanner = true
                }
            }
        }
    })
    end = performance.now();

    firstResult = end - begin;
    // console.log('time: ', firstResult)
}

function unbindEventListeners(elName) {
    // Make sure body exists
    if (!window.document.body) return;

    let els = window.document.body.querySelectorAll(ATTR_TO_BLUR_ELEMENT.concat(ATTR_TO_BLUR_ICON).concat(ATTR_TO_BLUR_PSEUDO).join(','))

    els.forEach((el) => {
        el.style.filter = el.defaultFilter
        // Does this properly defaults the pointe event? or do I need 'setProperty?'
        el.style.pointerEvents = el.defaultPointerEvents
        el.elementFoundByDomScanner = false;
        el.iconFoundByDomScanner = false;
    })
}

function BlurUnBlur(e) {
    // retrieve ALL hovered-on elements
    let hoveredOnElements = document.elementsFromPoint(e.clientX, e.clientY)

    // hide any previously revealed element, except those that are still hovered on
    currently_unhidden_elements.forEach((el) => {
        // if currently unhidden element is NOT hovered on, hide it.
        if (!hoveredOnElements.includes(el)) {

            if(el.classList.contains('halal-web-pseudo-unhide')) {
                el.classList.remove('halal-web-pseudo-unhide')
            }
            // Element is not hovered on, so hide it.
            el.style.filter = el.defaultFilter

            // Element is now hidden, so remove element from 'currently unhidden elements'
            const elIndex = currently_unhidden_elements.indexOf(el)

            // Remove element from 'currently unhidden elements' array
            if (elIndex > -1 ) currently_unhidden_elements.splice(elIndex, 1)
        }
    })


    // Unhide all hovered-on elements, marked with 'foundByDomScanner'
    hoveredOnElements.forEach((el) => {
        if(el.shadowRoot) {
        }

        if(el.dataset.elementFoundByDomScanner || el.dataset.iconFoundByDomScanner || el.dataset.pseudoFoundByDomScanner) {
            if(e.ctrlKey && e.altKey) {
                if(el.dataset.pseudoFoundByDomScanner) {
                    el.classList.add('halal-web-pseudo-unhide')
                }
                el.style.setProperty('filter', 'blur(0px)', 'important')
                currently_unhidden_elements.push(el)
            }
        }
    })
}

function blurUnblurPage() {
    console.log('page is blurred: ' + PAGE_BLURRED)
    if (PAGE_BLURRED) {
        unblurPage()
    } else {
        blurPage()
    }
}

function blurPage() {
    console.log('blurring....')
    addBlurCSS()
    startDOMScanner()
    PAGE_BLURRED = !PAGE_BLURRED
}

function unblurPage() {
    console.log('removing blur...')
    removeBlurCSS()
    stopDOMScanner()
    PAGE_BLURRED = !PAGE_BLURRED
}

function isDomainWhitelisted() {
    let domainsArray = options?.whitelistedDomains
    return domainsArray?.length > 0 && domainsArray.includes(window.location.hostname)
}

function getPageUrl() {
    return window.location
}

async function whitelistDomain() {
    let domainToWhitelist = window.location.hostname

    // Grab whitelisted domains from storage
    // push new domain to whitelistedDomains
    if(!options?.whitelistedDomains.includes(domainToWhitelist)) {
        options.whitelistedDomains.push(domainToWhitelist)
    }

    // Add domain to whitelisted domains
    updateOptions(options)
    if (PAGE_BLURRED) unblurPage()
}

async function dangerlistDomain() {
    let domainToDangerlist = window.location.hostname
    // Remove domain from whitelistedDomains
    let domainIndex = options.whitelistedDomains.indexOf(domainToDangerlist)
    if (domainIndex > -1 ) options.whitelistedDomains.splice(domainIndex, 1)

    // Add domain to whitelisted domains
    updateOptions(options)

    if (!PAGE_BLURRED) blurPage()

}

function whitelistGoogleMaps() {
    if((window.location.hostname + window.location.pathname).startsWith(GOOGLE_MAPS)){
        ELEMENTS_TO_BLUR.splice(ELEMENTS_TO_BLUR.indexOf('canvas'), 1)
    }
}

async function updateCssBlur () {
    removeBlurCSS()
    addBlurCSS(options?.blurAmount?.element, options?.blurAmount?.icon)
}

async function updateBlurElement (value) {
    console.log('entered updateBlurElement')
    if(!isDomainWhitelisted()) {
        options.blurAmount.element = value
        await updateOptions()
        updateCssBlur(options)
    }
}

async function updateBlurIcon (value) {
    console.log('entered updateBlurIcon')
    if(!isDomainWhitelisted()) {
        console.log(options)
        options.blurAmount.icon = value
        console.log(options)
        await updateOptions()
        updateCssBlur(options)
    }
}

async function updateOptions() {
    await helper.setOptions(options)
    options = await helper.getOptions()
}

// Initialize web page
async function init() {
    // remove options and see if it initializes properly and if it returns the initialization variable
    helper = new Helper()

    // Initialize options if needed then retrieve from google api
    options = await helper.getOptions(true)

    // Blur page if domain is not white listed
    if (!isDomainWhitelisted()) {
        whitelistGoogleMaps()
        if (!PAGE_BLURRED) blurPage()
    } 
}

init()  
window.onbeforeunload = () => stopDOMScanner()

// Receive and respond to messages from the extension popup here
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request) {
            switch (request.action) {
                case 'updateBlurIcon':
                    updateBlurIcon(request.value)
                    break;
                case 'updateBlurElement':
                    updateBlurElement(request.value)
                    break;
                case 'consoleLog':
                    console.log(request.message)
                    break
                case 'blurUnblurPage':
                    blurUnblurPage()
                    break;
                case 'getPageUrl':
                    sendResponse(getPageUrl())
                    break;

                case 'whitelistDomain':
                    whitelistDomain()
                    break;
                case 'dangerlistDomain':
                    dangerlistDomain()
                    break;
            }
        }
    }
);