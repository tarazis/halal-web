// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

let ELEMENTS_TO_BLUR = ['img', 'image', 'picture', 'video', 'iframe', 'canvas','div[style*="url"]', 'span[style*="url"]', 'a[style*="url"]', 'li[style*="url"]', ':host']
let ICONS_TO_BLUR = ['svg', 'i', 'span[class*="icon-"]', ':before', ':after']
let ATTR_TO_BLUR_ELEMENT = ['[data-element-found-by-dom-scanner="true"]']
let ATTR_TO_BLUR_ICON = ['[data-icon-found-by-dom-scanner="true"]']

const BLUR_LENGTH = 40;
const BLUR_LENGTH_MINI = 3;
// Keeps track of currently unhidden elements
let currently_unhidden_elements = []
function addBlurCSS() {
    let style = document.createElement('style')
    style.id = 'blur-css'
    style.innerHTML = ELEMENTS_TO_BLUR.length > 0 ? ELEMENTS_TO_BLUR.join(',') + ` { filter: blur(${BLUR_LENGTH}px) !important; }` : ''
    style.innerHTML += ATTR_TO_BLUR_ELEMENT.length > 0 ? ATTR_TO_BLUR_ELEMENT.join(',') + ` { filter: blur(${BLUR_LENGTH}px) !important; }` : ''
    style.innerHTML += ATTR_TO_BLUR_ICON.length > 0 ? ATTR_TO_BLUR_ICON.join(',') + ` { filter: blur(0.2rem) !important; }` : ''

    style.innerHTML += ICONS_TO_BLUR.length > 0 ? ICONS_TO_BLUR.join(',') + '{ filter: blur(0.2rem) !important; }' : ''
    style.innerHTML += '.halal-web-pseudo:before, .halal-web-pseudo:after { filter: blur(0px) !important; }'
    let parentElement = document.head ? document.head : document.documentElement
    parentElement.appendChild(style)
}

function removeBlurCSS() {
    let style = document.getElementById('blur-css')
    if (style) document.head.removeChild(style)
    // unblurBackgroundImages()
}


// Scans DOM every 100 ms for new elements to be blurred
const startDOMScanner = () => {
    document.addEventListener('mousemove', (e) => BlurUnBlur(e))

    window.DOMScannerInterval = setInterval(() => {
        triggerDOMScanner()
        document.querySelectorAll('span:before').forEach((el) => {
            // console.log(el)
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
    // console.log('DOM triggered')

    // Loop through elements
    els.forEach((el) => {
        let scannedElement = el
        // Get element background image property
        let elementBGStyle = window.getComputedStyle(scannedElement).getPropertyValue('background-image')

        let pseudoElement = window.getComputedStyle(el, '::before') || window.getComputedStyle(el, '::after')

        if(pseudoElement != 'none') {
            let content = pseudoElement.getPropertyValue('content')
            let background = pseudoElement.getPropertyValue('background')
            // check all types of ::before
            if(content != 'none' || background != 'none') {
                // console.log('pseudo found: ')
                // console.log(content)
                // console.log(background)
                // console.log(pseudoElement)
                // console.log('--------')
            }
            // console.log('I found a pseudo selector!\n')
            // console.log(pseudoElement.getPropertyValue('content'))
            // pseudoSelector.style.cssText = "filter: blur(0px) !important;"
        }

        // if element is in 'elements to blur' or if it has a background image:
        if (scannedElement.matches(ELEMENTS_TO_BLUR.concat(ICONS_TO_BLUR).join(',')) || elementBGStyle != 'none' || scannedElement.shadowRoot) {
            if(!scannedElement.dataset.elementFoundByDomScanner && !scannedElement.dataset.iconFoundByDomScanner) {
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
                if(scannedElement.matches(ICONS_TO_BLUR.join(','))) {
                    scannedElement.dataset.iconFoundByDomScanner = true
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

    let els = window.document.body.querySelectorAll(ATTR_TO_BLUR_ELEMENT.concat(ATTR_TO_BLUR_ICON).join(','))

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
            // console.log(el)
        }

        if(el.dataset.elementFoundByDomScanner || el.dataset.iconFoundByDomScanner) {
            if(e.ctrlKey && e.altKey) {
                el.style.setProperty('filter', 'blur(0px)', 'important')
                currently_unhidden_elements.push(el)
            }
        }
    })
}

chrome.storage.local.get('BLUR_FLAG', data => {
    addBlurCSS()
    startDOMScanner()
})

window.onbeforeunload = () => stopDOMScanner()


chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request) {
            console.log('action is to ', request.action)
            switch (request.action) {
                
                case 'blur':
                    addBlurCSS()
                    break;

                case 'unblur':
                    removeBlurCSS()
                    break;
            }
        }
    }
);