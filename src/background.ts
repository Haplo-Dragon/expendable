const FOLDER_NAME = "Expendable Bookmarks"
let FOLDER_ID: string
// We'll keep track of expendable bookmarks by their Firefox-assigned id.
const expendable_bookmark_set = new Set<string>()


init_expendable_bookmarks()

function init_expendable_bookmarks() {
    browser.bookmarks.search( {title: FOLDER_NAME})
        .then( items => {
            if (items.length > 0) {
                console.log("Found expendable folder.")
            } else {
                console.log("Expendable bookmarks folder not found, creating...")
                browser.bookmarks.create( {title: FOLDER_NAME} )
            }            
            return browser.bookmarks.getSubTree(items[0].id)
        })
        .then ( items => {            
            console.log("Found subtree, recording ID and adding bookmarks to set...")
            FOLDER_ID = items[0].id
            buildSet(items[0])
            console.log("Expendable bookmark set initialized:")         
            console.log(expendable_bookmark_set)
        })
        .catch ( error => {
            console.log(
                `Couldn't find expendable bookmarks folder (or it was empty): ${error}`)
            console.log(expendable_bookmark_set)
        })
}

function buildSet(bookmark_item: browser.bookmarks.BookmarkTreeNode) {
    // We only want bookmarks, not folders or separators.
    if (bookmark_item.url) {
        console.log(`Initializing bookmark ${bookmark_item.title}`)
        expendable_bookmark_set.add(bookmark_item.id)
    }

    // If it's a folder and has children, we want to add them, too.
    if (bookmark_item.children) {
        for (let child of bookmark_item.children) {
            buildSet(child)
        }
    }
}


function createExpendableBookmark(bookmark_title: string, bookmark_url: string) {
    let bookmark_details = getBookmarkDetails(bookmark_title, bookmark_url)

    browser.bookmarks.create(bookmark_details)
        .then( new_bookmark_node => {
            addExpendableBookmark(new_bookmark_node)
        })
        .catch( error => {
            console.log(`Couldn't create new expendable bookmark: ${error}`)
        })
}

function getBookmarkDetails(bookmark_title: string, bookmark_url: string) {
    let bookmark_details: browser.bookmarks.CreateDetails = {}

    bookmark_details.title = bookmark_title
    bookmark_details.url = bookmark_url
    bookmark_details.parentId = FOLDER_ID

    return bookmark_details
}

function addExpendableBookmark(bookmark: browser.bookmarks.BookmarkTreeNode) {
    expendable_bookmark_set.add(bookmark.id)
    console.log(`Added new expendable bookmark ${bookmark.title}.`)
}

function removeExpendableBookmark(tab: browser.tabs.Tab) {
    console.log(
        `Looking for expendable bookmark in tab ${tab.title} with url ${tab.url}`)
    browser.bookmarks.search( {url: tab.url} )
        .then( bookmark_items => {                        
            return bookmark_items[0]
        })
        
        .then( current_bookmark => {
            if (current_bookmark) {
                console.log("Found bookmark with current tab info:")
                console.log(current_bookmark)
                console.log(
                    `Current bookmark is in expendable set: 
                    ${isExpendable(current_bookmark)}`)
                console.log("Expendable set:")
                console.log(expendable_bookmark_set)
            }
    
            if (isExpendable(current_bookmark)) {
                console.log(
                    `Removing expendable bookmark: ${current_bookmark.title}`)
                expendable_bookmark_set.delete(current_bookmark.id)
                browser.bookmarks.remove(current_bookmark.id)
            }
        })
        .catch( error => {
            console.log("Couldn't remove expendable bookmark: $[error}")
        })
}

function isExpendable(bookmark: browser.bookmarks.BookmarkTreeNode) {
    return expendable_bookmark_set.has(bookmark.id)
}

function handleMessage(message: any) {
    if (message.command === "addExpendableBookmark") {
        createExpendableBookmark(message.title, message.url)
    }
}

function handleOutsideBookmarkCreation(
    id: string,
    bookmark: browser.bookmarks.BookmarkTreeNode) {
    if (bookmark.parentId && bookmark.parentId === FOLDER_ID) {
        addExpendableBookmark(bookmark)
    }    
}

function handleOutsideBookmarkRemoval(
    id: string,
    remove_info: any) {
    if (remove_info.parentId === FOLDER_ID) {
        expendable_bookmark_set.delete(remove_info.node.id)
        console.log(`Removed expendable bookmark ${remove_info.node.title}.`)
    }
}

function handleTabUpdate(tabId: number, changeInfo: any, tab: browser.tabs.Tab) {
    // We're only interested in tabs that have finished loading.
    if (tab.status === "complete") {
        removeExpendableBookmark(tab)
    }
}


// Listen for tab URL changes, filtering the Tab Update events to only the tabs which
// are fully loaded and in the current window.
const filter = {
    properties: new Array<browser.tabs.UpdatePropertyName>("status"),
    windowId: browser.windows.WINDOW_ID_CURRENT

}
browser.tabs.onUpdated.addListener(handleTabUpdate, filter)


// Listen for creation of new bookmarks in the expendable folder.
browser.bookmarks.onCreated.addListener(handleOutsideBookmarkCreation)
// Listen for removal of bookmarks.
browser.bookmarks.onRemoved.addListener(handleOutsideBookmarkRemoval)

// Listen for creation of new bookmarks from the expendable popup.
browser.runtime.onMessage.addListener(handleMessage)

// // Listen for tab switching? Might not be necessary; may cause more problems than
// // it solves.
// browser.tabs.onActivated.addListener(removeExpendableBookmark)


// // OLD REMOVE EXPENDABLE BOOKMARK IMPLEMENTATION
    // browser.tabs.query({active: true, currentWindow:true, status: "complete"})
    //     .then( tabs => {
    //         if (tabs[0]) {
    //             console.log(
    //                 `Looking for expendable bookmark in tab ${tabs[0].title}
    //                  with url ${tabs[0].url}`)
    //             browser.bookmarks.search( {title: tabs[0].title} )
    //                 .then( bookmark_items => {                        
    //                     return bookmark_items[0]
    //                 })
    //                 .then( current_bookmark => {
    //                     if (current_bookmark) {
    //                         console.log("Found bookmark with current tab info:")
    //                         console.log(current_bookmark)
    //                         console.log(
    //                             `Current bookmark is in expendable set: 
    //                             ${isExpendable(current_bookmark)}`)
    //                         console.log("Expendable set:")
    //                         console.log(expendable_bookmark_set)
    //                     }
    //                     if (isExpendable(current_bookmark)) {
    //                         console.log(
    //                             `Removing expendable bookmark:
    //                             ${current_bookmark.title}`)
    //                         expendable_bookmark_set.delete(current_bookmark.id)
    //                         browser.bookmarks.remove(current_bookmark.id)
    //                     }
    //                 })
    //                 .catch( error => {
    //                     console.log("Couldn't remove expendable bookmark: $[error}")
    //                 })
    //         }
    //     })