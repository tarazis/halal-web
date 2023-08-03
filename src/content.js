// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const GOOGLE_MAPS = 'www.google.com/maps'
const emoji = /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

let options = null
let helper = null
let PAGE_BLURRED = false
let ELEMENTS_TO_BLUR = ['img', 'image', 'picture', 'video', 'iframe', 'canvas', ':host']
let ICONS_TO_BLUR = ['svg', 'span[class*="icon-"]', ':before', ':after']
let ATTR_TO_BLUR_ELEMENT = ['[data-element-found-by-dom-scanner="true"]']
let ATTR_TO_BLUR_ICON = ['[data-icon-found-by-dom-scanner="true"]']
let ATTR_TO_BLUR_PSEUDO = ['[data-pseudo-found-by-dom-scanner="true"]']
let ATTR_TO_BLUR_BACKGROUND = ['[data-background-image-found-by-dom-scanner="true"]']

// Keeps track of currently unhidden elements
let currently_unhidden_elements = []

// Adds style that blurs elements
// Note: this does not blur background images
function addBlurCSS() {
    // grab element and icon blur values from saved options
    let elementVal = options ? options?.blurAmount.element : Helper.initialOptions.blurAmount.element
    let iconVal = options ? options?.blurAmount.icon : Helper.initialOptions.blurAmount.icon

    // dynamically create s style element and append all styles to it
    let style = document.createElement('style')
    style.id = 'blur-css'

    // all styles are added here
    style.innerHTML = ELEMENTS_TO_BLUR.length > 0 ? ELEMENTS_TO_BLUR.join(',') + ` { filter: blur(${elementVal}px) !important; }` : ''
    style.innerHTML += ATTR_TO_BLUR_ELEMENT.length > 0 ? ATTR_TO_BLUR_ELEMENT.join(',') + ` { filter: blur(${elementVal}px) !important; }` : ''
    style.innerHTML += ATTR_TO_BLUR_ICON.length > 0 ? ATTR_TO_BLUR_ICON.join(',') + ` { filter: blur(${iconVal}px) !important; }` : ''
    style.innerHTML += ICONS_TO_BLUR.length > 0 ? ICONS_TO_BLUR.join(',') + `{ filter: blur(${iconVal}px) !important; }` : ''
    style.innerHTML += ATTR_TO_BLUR_BACKGROUND.length > 0 ? ATTR_TO_BLUR_BACKGROUND.join(',') + ` { background: #EFEFEF !important; background-color: #EFEFEF !important; background-image: #EFEFEF !important; color: black;}` : ''
    style.innerHTML += '.halal-web-pseudo:before, .halal-web-pseudo:after { filter: blur(0px) !important; }'
    style.innerHTML += 'i, span { font-family:Arial, Helvetica, sans-serif !important; } *[style*="url"] { visibility: hidden !important; } '
    
    // Append style to document
    let parentElement = document.documentElement
    parentElement.appendChild(style)
}

// Remove style
function removeBlurCSS() {
    let style = document.getElementById('blur-css')
    if (style)
        document.documentElement.removeChild(style)
}


// Scans DOM every time a node is added or changed
const startDOMScanner = () => {
    // Add an event listener to mouse move to detect where it is on the document
    document.addEventListener('mousemove', (e) => BlurUnBlur(e))
    triggerDOMScanner()
}

// Stop DOM scanner
const stopDOMScanner = () => {
    this.clearInterval(window.DOMScannerInterval)
    ELEMENTS_TO_BLUR.concat(ICONS_TO_BLUR).forEach((el) => unbindEventListeners(el)) 
    // TODO: clear mouse move event listener
}

// To do: to better performance, do not traverse nodes twice by keeping  a list of traversed nodes.
function traverseNode(changedNode) {
    // Once node is found to contain a change (addition or mutation)
    // walk all children of the node and test wether this is a change of interest or not.
    // once a change of interest is found, apply to it the scanner algorithm
    // The algorithm is different for each element

    // Create a walker that traverses a node tree starting from the changed node.
    const walker = document.createTreeWalker(changedNode, NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT);

    // loop through each node. After every loop, update node to be the next node in the walker.
    let node;
    while ((node = walker.nextNode())) {

        // 1) Check for emoji and replace it with ''
        // make sure element is a text node so that we only replace text. Otherwise, we would be replacing whole elements that will mess up how the page looks.
        if (node.nodeType == Node.TEXT_NODE) {
            // Grab node value and replace any instance of emojis with ''
            const text = node.nodeValue;
            const newText = text.replace(emoji, '');
            // if text has changed and it did indeed contain an emoji, update nodevalue with the newly replaced text
            if (text !== newText && emoji.test(text)) {
                node.nodeValue = newText;
            }
        }

        // Make sure node is an element so we only replace elements and not other nodes like document and others.
        if(node.nodeType == Node.ELEMENT_NODE) {
            // Check for the rest of elements of interest
            // we could have continued with using 'node' without assigning it to another variable.. but this was old code so I kept it the same.
            let scannedElement = node

            // 2) Check for background image by accessing element property then give it an attribute 'backgroundImageFoundByDomScanner'
            let elementBGStyle = window.getComputedStyle(scannedElement).getPropertyValue('background-image')

            // Reached here.
            let pseudoElementIconFound = false;
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
                    // Save blur level for each element after the blur css is applied.
                    // This will be later used when blurring/unblurring elements
                    // This why when we blur/unblur elements we won't need to distinguish wether it's an icon or normal element
                    scannedElement.halalWebFilter = scannedElement.style.filter
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
                    } else if(elementBGStyle != 'none') {
                        scannedElement.dataset.backgroundImageFoundByDomScanner = true
                    } else {
                        scannedElement.dataset.elementFoundByDomScanner = true
                    }
                }
            }
        }
    }
}

// Observer document for any nodes that get added or changed
// Bind event listeners to targeted elements
function triggerDOMScanner() {
        // Observe document nodes
        let observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Note: each added node can have multiple child nodes; this is why we have to traverse it
                // To do: to better performance, do not traverse nodes twice by keeping  a list of traversed nodes.
                mutation.addedNodes.forEach((addedNode) => {
                    traverseNode(addedNode)
                })
    
                // Do the same for mutated nodes
                if (mutation.oldValue != null) {
                    let mutatedNode = mutation.target
                    traverseNode(mutatedNode)
                }
            })
        })
    
        // Config defines what the observer observes... I observe here everything. It might affect performance a bit.
        var config = {attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true, childList: true, subtree: true }
    
        observer.observe(document, config)
}

function unbindEventListeners(elName) {
    // Make sure body exists
    if (!window.document.body) return;

    let els = window.document.body.querySelectorAll(ATTR_TO_BLUR_ELEMENT.concat(ATTR_TO_BLUR_ICON).concat(ATTR_TO_BLUR_PSEUDO).concat(ATTR_TO_BLUR_BACKGROUND).join(','))

    els.forEach((el) => {
        // el.style.filter = el.halalWebFilter
        el.style.setProperty('filter', 'blur(0px)', '!important')
        // Does this properly defaults the pointe event? or do I need 'setProperty?'
        el.style.pointerEvents = el.defaultPointerEvents
        el.elementFoundByDomScanner = false;
        el.iconFoundByDomScanner = false;
        // el.dataset.backgroundImageFoundByDomScanner = false;
    })
}

// Blur or Unblur specific elements when hovered/unhovered on 
function BlurUnBlur(e) {
    // retrieve ALL hovered-on elements
    let hoveredOnElements = document.elementsFromPoint(e.clientX, e.clientY)

    // hide any previously revealed element, except those that are still hovered on
    currently_unhidden_elements.forEach((el) => {
        // if currently unhidden element is NOT hovered on, hide it.
        if (!hoveredOnElements.includes(el)) {

            // If element is a pseudo element, hide it by toggling a css class
            // this is needed because there is no way in javascript to dynamically change the filter property of pseudo elements
            if(el.classList.contains('halal-web-pseudo-unhide')) {
                el.classList.remove('halal-web-pseudo-unhide')
            }
            // hide it
            el.style.filter = el.halalWebFilter

            // Element is now hidden, so remove element from 'currently unhidden elements'
            const elIndex = currently_unhidden_elements.indexOf(el)
            if (elIndex > -1 ) currently_unhidden_elements.splice(elIndex, 1)
        }
    })


    // Unhide all hovered-on elements, marked with 'foundByDomScanner'
    hoveredOnElements.forEach((el) => {
        if(el.dataset.elementFoundByDomScanner || el.dataset.iconFoundByDomScanner || el.dataset.pseudoFoundByDomScanner) {
            // if ctrl and alt key are pressed then unhide
            if(e.ctrlKey && e.altKey) {
                // pseudo elements unhide using css classes because their properties cannot be dynamically accessed.
                if(el.dataset.pseudoFoundByDomScanner) {
                    el.classList.add('halal-web-pseudo-unhide')
                }
                // other elements other than pseudo are unhidden by accessing their property
                el.style.setProperty('filter', 'blur(0px)', 'important')
                // keep track of unhidden elements
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

    // Dynamically add blurring css (note: this does not blur background images because they are dynamic in nature)
    addBlurCSS()

    // Start dom scanner which scans the dom every time a new node is added and/or changed
    // This is needed to blur background images as well as bind event listeners to allow blur/unblur of specific element
    startDOMScanner()

    // toggle blurred flag
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

// If google maps url is found, exempt 'canvas' from being blurred
// this will keep everything blurred except for the actual map
// this is done exceptionally since google maps is used a lot.
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
    // Initialize helper class, which contains helper functions and accesses google storage
    helper = new Helper()

    // Retrieve halal options from google api
    options = await helper.getOptions(true)

    // Blur page if domain is not white listed
    if (!isDomainWhitelisted()) {
        // force whitelist google maps (only exempts canvas from being blurred) since it's used a lot.
        whitelistGoogleMaps()

        // if page is not blurred already, then blur it.
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