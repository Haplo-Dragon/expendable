// We'll keep track of the expendable bookmarks folder by its ID, allowing it
// to be moved or renamed if the user wants.
const FOLDER_NAME = "Expendable Bookmarks"
let FOLDER_ID: string

const NOTIFICATION_ICON = "icons/star-expendable-48.png"
const NOTIFICATION_TIMEOUT_MILLISECONDS = 3000

// We'll keep track of expendable bookmarks by their Firefox-assigned id.
const expendable_bookmark_set = new Set<string>()


// Find the expendable bookmarks folder (or create it if it's not present), and
// register any already-existing expendable bookmarks inside it.
init_expendable_bookmarks()

function init_expendable_bookmarks() {
    browser.bookmarks.search( {title: FOLDER_NAME})
        .then( items => {
            if (items.length > 0) {
                // console.log("Found expendable folder.")
            } else {
                // If the expendable folder doesn't exist, we'll create it, then grab
                // its ID.
                // console.log("Expendable bookmarks folder not found, creating...")
                browser.bookmarks.create( {title: FOLDER_NAME} )
                    .then (new_expendable_folder => {
                        FOLDER_ID = new_expendable_folder.id
                    })
            }            
            // If the expendable folder does exist, we'll check it for bookmarks.
            return browser.bookmarks.getSubTree(items[0].id)
        })
        // Record the expendable folder's ID and keep track of any bookmarks in it.
        .then ( items => {            
            // console.log("Found subtree, recording ID and adding bookmarks to set...")            
            FOLDER_ID = items[0].id
            buildSet(items[0])
            
            // console.log("Expendable bookmark set initialized:")         
            // console.log(expendable_bookmark_set)
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
    // Avoid duplicate expendable bookmarks.
    isDuplicate(bookmark_url)
        .then( bookmark_is_duplicate => {
            // If it's a new bookmark (that is, NOT a duplicate), we'll create it.
            if (!bookmark_is_duplicate) {
                let bookmark_details = getBookmarkDetails(bookmark_title, bookmark_url)

                browser.bookmarks.create(bookmark_details)            
                    .catch( error => {
                        console.log(`Couldn't create new expendable bookmark: ${error}`)
                    })
            }
        })
}

function getBookmarkDetails(bookmark_title: string, bookmark_url: string) {
    let bookmark_details: browser.bookmarks.CreateDetails = {}

    bookmark_details.title = bookmark_title
    bookmark_details.url = bookmark_url
    bookmark_details.parentId = FOLDER_ID

    return bookmark_details
}

function isDuplicate(bookmark_url: string) {
    // If the bookmark already exists in the expendables folder, we don't want
    // to create it again.
    return browser.bookmarks.search( {url: bookmark_url})
        // We'll look for a bookmark matching this URL.
        .then( bookmark_items => {
            return bookmark_items[0]
        })
        .then( found_bookmark => {
            // console.log("Checking found bookmark for expendableness...")
            // If that bookmark exists and it's also in the expendable folder, we
            // know it's a duplicate.
            if (found_bookmark && isExpendable(found_bookmark)) {
                // console.log("Already have expendable bookmark here.")
                return true
            }
        })
        .catch( () => {
            // Otherwise, it's not a duplicate and we can continue with expendable
            // bookmark creation.
            return false
        })  
}

function addExpendableBookmark(bookmark: browser.bookmarks.BookmarkTreeNode) {
    // We want to avoid adding duplicate expendable bookmarks.
    if (!expendable_bookmark_set.has(bookmark.id)) {
        expendable_bookmark_set.add(bookmark.id)
        
        // console.log(`Added new expendable bookmark ${bookmark.title}.`)
        
        browser.notifications.create( {
            type: "basic",
            title: "Expendable Bookmark Created!",
            message: `New expendable bookmark created: ${bookmark.title}`,
            iconUrl: NOTIFICATION_ICON
        })
            .then( notification_id => {
                // We'll wipe the notification after a timeout.
                setTimeout(() => 
                    browser.notifications.clear(notification_id),
                    NOTIFICATION_TIMEOUT_MILLISECONDS)
            })
    } else {
        // console.log("Already had an expendable bookmark here.")
    }
}

function removeExpendableBookmark(tab: browser.tabs.Tab) { 
    // Search for a bookmark with the current tab's URL.
    browser.bookmarks.search( {url: tab.url} )
        .then( bookmark_items => {                        
            return bookmark_items[0]
        })
        
        .then( current_bookmark => {
            if (current_bookmark) {
                // console.log("Found bookmark with current tab info:")
                // console.log(current_bookmark.title, current_bookmark.url)
            } else {
                // console.log("Current tab is not bookmarked.")
                return
            }
    
            // If the bookmark exists and is expendable, we'll remove it.
            if (isExpendable(current_bookmark)) {
                // console.log(`Removing expendable bookmark ${current_bookmark.title}`)
                browser.bookmarks.remove(current_bookmark.id)
            } else {
                // console.log("Loaded bookmark is not expendable.")
                return
            }
        })
        .catch( error => {
            if (error) {
                console.log(`Couldn't remove expendable bookmark: ${error}`)
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
    // We only care about bookmarks being created in the expendable folder.
    if (bookmark.parentId === FOLDER_ID) {
        addExpendableBookmark(bookmark)
    }    
}

function handleOutsideBookmarkRemoval(id: string, remove_info: any) {
    // We only care about bookmarks being removed from the expendable folder.
    if (remove_info.parentId === FOLDER_ID) {
        expendable_bookmark_set.delete(remove_info.node.id)        

        browser.notifications.create( {
        type: "basic",
        title: "Expendable Bookmark Removed!",
        message: "",
        iconUrl: NOTIFICATION_ICON
        })
            .then( notification_id => {
                // We'll wipe the notification after a timeout.
                setTimeout( () => 
                    browser.notifications.clear(notification_id),
                    NOTIFICATION_TIMEOUT_MILLISECONDS)
            })
    }
}

function handleOutsideBookmarkMove(bookmark_id: string, move_info: any) {
    // If the bookmark was moved INTO expendable folder, we need to add it.
    if (move_info.parentId === FOLDER_ID) {
        expendable_bookmark_set.add(bookmark_id)
    }

    // If the bookmark was moved OUT of expendable folder, we need to remove it.
    else if (move_info.oldParentId === FOLDER_ID) {
        expendable_bookmark_set.delete(bookmark_id)
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


// Listen for creation of new bookmarks.
browser.bookmarks.onCreated.addListener(handleOutsideBookmarkCreation)
// Listen for removal of bookmarks.
browser.bookmarks.onRemoved.addListener(handleOutsideBookmarkRemoval)
// Listen for bookmarks being moved into/out of the expendable folder.
browser.bookmarks.onMoved.addListener(handleOutsideBookmarkMove)

// Listen for creation of new bookmarks from the expendable popup.
browser.runtime.onMessage.addListener(handleMessage)