// constants
// This is the structure of 'options'
const initialOptions = {
    halalWebOptions: true,
    whitelistedDomains : [],
    blurAmount: {
      element: 40,
      icon: 5
    }
}

class Helper {

    // getters
    static get initialOptions() {
        return initialOptions;
    }

    // Get options from storage api
    getOptions = async (init=false) => {
        var self = this
        return new Promise(function(resolve, reject) {
            if(chrome.storage == null || chrome.storage == 'undefined') {
                // TODO: reject or resolve
                resolve(initialOptions)
            }

            chrome.storage.sync.get(['options'], async (res) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    reject(chrome.runtime.lastError.message);
                } else {
                    // if halalWebOptions has never been initialized (returns null), then initialize based on the above constant 'initialOptions'
                    // then set it to the chrome storage, which will remember it locally and per profile as well
                    if((!res?.options || !res?.options?.halalWebOptions) && init) {
                        self.setOptions(initialOptions).then((res) => {
                            resolve(initialOptions)
                        }).catch(() => {
                            reject()
                        })
                    } else {
                        // if options has already been used, return options
                        resolve(res?.options);
                    }
                }
            });
        });
    }

     async setOptions(newOptions) {
        return new Promise(function(resolve, reject) {
            if(chrome.storage == null || chrome.storage == 'undefined') {
                reject()
            }
            chrome.storage.sync.set({'options' : newOptions }, (res) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    reject(chrome.runtime.lastError.message);
                } else {
                    console.log('Added new option!')
                    resolve(res?.options);
                }
            });
        });
    }

    async removeOptions() {
        return new Promise(function(resolve, reject) {
            chrome.storage.sync.remove('options', (res) => {
                if(chrome.storage == null || chrome.storage == 'undefined') {
                    reject()
                }
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    reject(chrome.runtime.lastError.message);
                } else {
                    console.log('removed options!')
                    resolve()
                }
            });
        });
    }

}