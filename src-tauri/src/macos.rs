/// Enables native window tiling options in the macOS Window menu.
///
/// This adds system-provided items like "Move & Resize" with tiling shortcuts
/// to the Window menu. Requires macOS Sequoia (15.0+) for full support.
///
/// Must be called after the Window menu is created with title "Window".
pub fn configure_window_menu() {
    unsafe {
        use objc2::{class, msg_send, runtime::AnyObject};
        use objc2_foundation::NSString;

        let app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        let main_menu: *mut AnyObject = msg_send![app, mainMenu];

        if main_menu.is_null() {
            log::warn!("Main menu not found, cannot configure Window menu");
            return;
        }

        // Find Windows menu
        let window_title = NSString::from_str("Window");
        let window_menu_item: *mut AnyObject = msg_send![main_menu, itemWithTitle: &*window_title];

        if !window_menu_item.is_null() {
            let submenu: *mut AnyObject = msg_send![window_menu_item, submenu];
            // MacOS automatically adds tiling options to Window menu
            let _: () = msg_send![app, setWindowsMenu: submenu];
        }
    }
}
