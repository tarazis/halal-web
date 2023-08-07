// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const GOOGLE_MAPS = 'www.google.com/maps'
const emoji = /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

let options = null
let helper = null
let PAGE_BLURRED = false
let ELEMENTS_TO_BLUR = ['img', 'image', 'video', 'iframe', 'canvas', '*[style*="url"]']
let ICONS_TO_BLUR = ['svg', 'span[class*="icon-"]', ':before', ':after']
let ATTR_TO_BLUR_ELEMENT = 'data-element-found-by-dom-scanner'
let ATTR_TO_BLUR_ICON = 'data-icon-found-by-dom-scanner'
let ATTR_TO_BLUR_PSEUDO = 'data-pseudo-found-by-dom-scanner'
let ATTR_TO_REFRESH_NODE = 'data-refresh-node'

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
    style.innerHTML += ICONS_TO_BLUR.length > 0 ? ICONS_TO_BLUR.join(',') +`{ filter: blur(${iconVal}px) !important; }` : ''
    style.innerHTML += `[${ATTR_TO_BLUR_ELEMENT}="true"] { filter: blur(${elementVal}px) !important; }`
    style.innerHTML += `[${ATTR_TO_BLUR_ICON}="true"] { filter: blur(${iconVal}px) !important; }`
    style.innerHTML += '.halal-web-pseudo:before, .halal-web-pseudo:after { filter: blur(0px) !important; }'
    style.innerHTML += `i, span { font-family:Arial, Helvetica, sans-serif !important; }`
    
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
    // disconnect observers
    // myMutationObserver.disconnect()
    // myResizeObserver.disconnect()

    // Make sure body exists
    if (!window.document.body) return;

    // Get all elements and remove all halal web specific attributes and/or event listeners
    // let allElements = document.getElementsByTagName('*')
    // for(var i = 0; i < allElements.length; i++) {
    //     let element = allElements[i]

    //     // Remove halal web attributes
    //     removeAttributes(element)

    //     // unbind halal web event listeners
    //     unbindEventListeners(element)
    // }

    // unbind event listeners for document
    document.removeEventListener('mousemove', (e) => BlurUnBlur(e))
}

// To do: to better performance, do not traverse nodes twice by keeping  a list of traversed nodes.
function traverseNode(mutationRecord, mutation = false) {
    // if mutation is false (default), changeRecord is the actual changed node
    let changedNode = mutationRecord

    // Once node is found to contain a change (addition or mutation)
    // walk all children of the node and test wether this is a change of interest or not.
    // once a change of interest is found, apply to it the scanner algorithm
    // The algorithm is different for each element

    // Create a walker that traverses a node tree starting from the changed node.
    let searchOption = NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT

    // When observation is for mutated nodes (not added nor removed), then only look for text to remove emoji. This greatly improves performance.
    if(mutation) searchOption = NodeFilter.SHOW_TEXT

    // if mutation is true
    // if(mutation) {
    //     // if mutation is true, change record is the mutation record and not the mutated node.
    //     if(mutationRecord.type == 'attributes') {
    //         // do not do tree wlaker
    //     } else if(mutationRecord.type == 'characterData') {
    //         // do not do tree walker
    //     } else {
    //         // Do tree walker

    //     }
    // }

    // let rootNode = changedNode.parentElement || changedNode
    
    const walker = document.createTreeWalker(changedNode, searchOption);
    // loop through each node. After every loop, update node to be the next node in the walker.

    // counter for the loop
    let j = 0
    while (walker.nextNode()) {
        // If first iteration and not mutation, start with previous node (which is really the root node)
        // mutation is excepted here because we only traverse the root node if it was added. otherwise, we ar eonly concerened with children
        // TODO: refactor code to just always start with root node instead of having to specifically call previous node.
        if(j == 0 && !mutation) walker.previousNode()

        let node = walker.currentNode

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
            let elementIdentified = false;

            // 2) Check for background image by accessing element property
            //    if so, stamp it with elementFound attribute
            let elementBGStyle = window.getComputedStyle(scannedElement).getPropertyValue('background-image')

            if(elementBGStyle != 'none') {
                $(scannedElement).attr(ATTR_TO_BLUR_ELEMENT, true)
                elementIdentified = true
            }
            
            // 3) Check if element has pseudo before/after attached to it
            //    The check is done by first getting computed style ::before/::after to know if either exists
            //    Then checking the 'content' property for either of them. If it's not 'none' then pseudo element exists and has 'content'
            //    if so, stamp it with pseudo attribute. This stamps the element which contains the ::before/::after    
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

            if(pseudoElementIconFound && !$(scannedElement).attr(ATTR_TO_BLUR_PSEUDO)) {
                $(scannedElement).attr(ATTR_TO_BLUR_PSEUDO, true)
                elementIdentified = true
            }

            // 4) Check if element is in element_blur
            //    if so, stamp it with elementFound attribute
            if(scannedElement.matches(ELEMENTS_TO_BLUR.join(',')) && !$(scannedElement).attr(ATTR_TO_BLUR_ELEMENT)) {
                // check if iframe
                //    if so, add mouse enter/leave events since iframes do not detect mouse events inside of them due to security reasons.
                //    and stamp it with elementFound
                if(scannedElement.nodeName == 'IFRAME') {
                    scannedElement.addEventListener('mouseenter', (e) => BlurUnBlur(e))
                    scannedElement.addEventListener('mouseLeave', (e) => BlurUnBlur(e))
                }
                $(scannedElement).attr(ATTR_TO_BLUR_ELEMENT, true)
                elementIdentified = true
            }

            // 5) Check if element is in icon_blur
            //    if so, stamp it with iconFound attribute
            if(scannedElement.matches(ICONS_TO_BLUR.join(',')) && !$(scannedElement).attr(ATTR_TO_BLUR_ICON)) {
                $(scannedElement).attr(ATTR_TO_BLUR_ICON, true)
                elementIdentified = true
            }

            // TODO: uncomment if you need to incorprate shadowroots within this algorithm. Currently they are just being hidden using resize observer
            // 6) check if element is shadow root
            //    if so, set display to inline. This is to fix a bug where some websites separate the display of shadow root from its contents
            //   and stamp it with elementFound
            if(scannedElement.shadowRoot && !$(scannedElement).attr(ATTR_TO_BLUR_ELEMENT)) {
                scannedElement.style.setProperty('display', 'inline', 'important')
                $(scannedElement).attr(ATTR_TO_BLUR_ELEMENT, true)
                elementIdentified = true
            }

            // Modify properties for each identified scanned element
            if(elementIdentified) {
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
            }
        }
        j++
    }
}

// Observer document for any nodes that get added or changed or when document size changes
// Bind event listeners to targeted elements
function triggerDOMScanner() {
    // Observe document nodes
    // let observer = new MutationObserver((mutations) => {
    //     mutations.forEach((mutation) => {
    //         // Note: each added node can have multiple child nodes; this is why we have to traverse it
    //         // To do: to better performance, do not traverse nodes twice by keeping  a list of traversed nodes.
    //         mutation.addedNodes.forEach((addedNode) => {
    //             traverseNode(addedNode)
    //         })

    //         // Do the same for mutated nodes
    //         if (mutation.oldValue != null) {
    //             let mutatedNode = mutation.target
    //             traverseNode(mutatedNode)
    //         }
    //     })
    // })

    // Observe document nodes
    const myMutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Note: each added node can have multiple child nodes; this is why we have to traverse it
            // To do: to better performance, do not traverse nodes twice by keeping  a list of traversed nodes.
            mutation.addedNodes.forEach((addedNode) => {
                traverseNode(addedNode)
            })

            // Do the same for mutated nodes
            if (mutation.oldValue != null) {
                // let mutatedNode = mutation.target
                // traverseNode(mutatedNode, true)
                traverseNode(mutation, true)
            }
        })
    })
    
        // Config defines what the observer observes... I observe here everything. It might affect performance a bit.
        var config = {attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true, childList: true, subtree: true }
        
        myMutationObserver.observe(document, config)

        // resize observer detects when new elements gets added to document element changing its size
        // This observer is only invoked to find shadowroots since there is no way to detect them by scanning the dom tree
        // The only way to detect shadow roots is either to know the exact element or to detect appearance change on the webpage using this observer
        // Once the observer detects an appearance change, we scan all DOM nodes to find the shadow root and we hide it.
        // Apply resize observer on shadowroot and iframe because they are not easily detected by mutation observer due to security reasons.
        // const resizeObserver = new ResizeObserver(entries => {
        //         let allElements = document.getElementsByTagName('*')
        //         for (var i = 0; i < allElements.length; i++) {
        //             if(allElements[i].shadowRoot) {
        //                 // allElements[i].style.setProperty('display', 'none', 'important')
        //                 allElements[i].setAttribute('halal-web', false)
        //                 allElements[i].setAttribute('halal-web', true)
        //             }

        //             if(allElements[i].nodeName == 'IFRAME') {
        //                 // mutate object
        //                 allElements[i].parentElement?.setAttribute('halal-web', false)
        //                 allElements[i].parentElement?.setAttribute('halal-web', true)
        //             } 
        //         }
        // });

    // resize observer detects when new elements gets added to document element changing its size
    // This observer is only invoked to find shadowroots since there is no way to detect them by scanning the dom tree
    // The only way to detect shadow roots is either to know the exact element or to detect appearance change on the webpage using this observer
    // Once the observer detects an appearance change, we scan all DOM nodes to find the shadow root and we hide it.
    // Apply resize observer on shadowroot and iframe because they are not easily detected by mutation observer due to security reasons.
    const myResizeObserver = new ResizeObserver(entries => {
        let allElements = document.getElementsByTagName('*')
        for (var i = 0; i < allElements.length; i++) {
            if(allElements[i].shadowRoot) {
                allElements[i].style.setProperty('display', 'none', 'important')
                // $(allElements[i]).attr(ATTR_TO_REFRESH_NODE, true)
                // $(allElements[i]).removeAttr(ATTR_TO_REFRESH_NODE)
            }

            if(allElements[i].nodeName == 'IFRAME') {
                // mutate object
                // $(allElements[i].parentElement)?.attr(ATTR_TO_REFRESH_NODE, true)
                // $(allElements[i].parentElement)?.removeAttr(ATTR_TO_REFRESH_NODE)
            } 
        }
    });


    // myResizeObserver.observe(document.documentElement)

        // should I refresh all nodes? or how does it work.
        // refreshDOM()
}

// function refreshElement() {

// }

// Refresh dom by adding/removing an attribute which will trigger observers all over again
function refreshDOM() {
    let allElements = document.getElementsByTagName('*')
    for (var i = 0; i < allElements.length; i++) {
        let element = allElements[i]
        $(element).attr(ATTR_TO_REFRESH_NODE, true)
        $(element).attr(ATTR_TO_REFRESH_NODE, false)
    }

}

// returns array of halal web attributes
function getHalalWebAttributes() {
    return (ATTR_TO_BLUR_ELEMENT + ',' + ATTR_TO_BLUR_ICON + ',' + ATTR_TO_BLUR_PSEUDO  + ',' + ATTR_TO_REFRESH_NODE).split(',')
}

// Remove all Halal web attributes
function removeAttributes(element) {
    // get all attributes
    let attributes = getHalalWebAttributes()
    console.log(attributes)

    // for each attribute, if the element has it, remove it
    attributes.forEach((attr) => {
        if($(element).attr(attr)) {
            $(element).removeAttr(attr)
        }
    })
}

function unbindEventListeners(element) {
    // element.style.setProperty('filter', 'blur(0px)', '!important')
    element.style.pointerEvents = element.defaultPointerEvents
    if(element.nodeName == 'IFRAME') {
        element.removeEventListener('mouseenter', (e) => BlurUnBlur(e))
        element.removeEventListener('mouseLeave', (e) => BlurUnBlur(e))
    }

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
        if($(el).attr(ATTR_TO_BLUR_ELEMENT) || $(el).attr(ATTR_TO_BLUR_ICON) || $(el).attr(ATTR_TO_BLUR_PSEUDO)) {
            // if ctrl and alt key are pressed then unhide
            if(e.ctrlKey && e.altKey) {
                // pseudo elements unhide using css classes because their properties cannot be dynamically accessed.
                if($(el).attr(ATTR_TO_BLUR_PSEUDO)) {
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

    // Remove blur css
    removeBlurCSS()

    // Stop DOM scanner
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