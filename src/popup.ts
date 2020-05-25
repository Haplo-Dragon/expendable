const nameText = document.getElementById("Name") as HTMLInputElement
let current_tab: browser.tabs.Tab

// Send message to background script to create a new expendable bookmark with
// the given title.
function createBookmark() {    
    browser.runtime.sendMessage({
        command: "addExpendableBookmark",
        title: nameText.value,
        url: current_tab.url
        })
}

let add_button = document.getElementById("btn-add")
if (add_button) {
    add_button.addEventListener("click", createBookmark)
}

function updateTab(tabs: browser.tabs.Tab[]) {
    if (tabs[0]) {
        current_tab = tabs[0]
        if (tabs[0].title) {
            nameText.value = tabs[0].title
        }
    }
}

// Update the active tab when the toolbar button is clicked.
browser.tabs.query({currentWindow: true, active: true})
    .then(updateTab)
    .catch( error => {
        console.log(`Couldn't get current tab: ${error}`)
    })