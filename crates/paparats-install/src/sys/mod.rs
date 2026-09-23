//! The platform layer: every Windows API call of the crate, and the only place `unsafe` is
//! allowed (see `windows.rs`: one `SAFETY` comment per block). Other platforms get stubs that
//! report the real strategies as unsupported.

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub(crate) use self::windows::*;

#[cfg(not(windows))]
mod stub;
#[cfg(not(windows))]
pub(crate) use self::stub::*;

/// Shell known folders the installer needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum KnownFolder {
    /// `%LOCALAPPDATA%`.
    LocalAppData,
    /// The current user's Start-menu programs (`%APPDATA%\Microsoft\Windows\Start Menu\Programs`).
    Programs,
    /// `%SystemRoot%\System32`.
    System,
}

/// What the installer needs to know about an MSI before running it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MsiInfo {
    /// `ProductCode` from the Property table (`{GUID}`).
    pub product_code: String,
    /// Word Count bit 3 of the summary information: "elevated privileges are not required", i.e.
    /// the package installs per user without UAC.
    pub per_user_capable: bool,
}
