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
        // .then( new_bookmark_node => {
        //     // addExpendableBookmark(new_bookmark_node)
        // })
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
    
    browser.notifications.create( {
        type: "basic",
        title: "Expendable Bookmark Created!",
        message: `New expendable bookmark created: ${bookmark.title}`
    })
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
                console.log(current_bookmark.title, current_bookmark.url)
            }
    
            if (isExpendable(current_bookmark)) {
                // expendable_bookmark_set.delete(current_bookmark.id)
                console.log(`Removing expendable bookmark ${current_bookmark.title}`)
                browser.bookmarks.remove(current_bookmark.id)
            }
        })
        .catch( error => {
            if (error) {
                console.log("Couldn't remove expendable bookmark: ${error}")
            } else {
                console.log("Loaded tab is not expendable.")
            }
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
    console.log(`Outside bookmark created: ${bookmark.title} at ${bookmark.url}`)
    if (bookmark.parentId === FOLDER_ID) {
        console.log("Bookmark was created in expendable folder!")
        addExpendableBookmark(bookmark)
    }    
}

function handleOutsideBookmarkRemoval(id: string, remove_info: any) {
    if (remove_info.parentId === FOLDER_ID) {
        expendable_bookmark_set.delete(remove_info.node.id)        

        browser.notifications.create( {
        type: "basic",
        title: "Expendable Bookmark Removed!",
        message: ""
        })
    }
}

function handleOutsideBookmarkMove(bookmark_id: string, move_info: any) {
    // If the bookmark was moved INTO expendable folder, we need to add it.
    if (move_info.parentId === FOLDER_ID) {
        expendable_bookmark_set.add(bookmark_id)
        console.log("New bookmark moved into expendable folder.")
    }

    // If the bookmark was moved OUT of expendable folder, we need to remove it.
    else if (move_info.oldParentId === FOLDER_ID) {
        expendable_bookmark_set.delete(bookmark_id)
        console.log("Bookmark moved out of expendable folder.")
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
// Listen for bookmarks being moved into/out of the expendable folder.
browser.bookmarks.onMoved.addListener(handleOutsideBookmarkMove)

// Listen for creation of new bookmarks from the expendable popup.
browser.runtime.onMessage.addListener(handleMessage)