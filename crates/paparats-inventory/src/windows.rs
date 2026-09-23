//! The Windows sources of the real scan: the registry through `winreg` and MSIX packages through
//! `Windows.Management.Deployment.PackageManager` (`windows` crate). Both APIs are safe wrappers;
//! this crate has no `unsafe` code.

use std::io;
use std::path::PathBuf;

use windows::ApplicationModel::Package;
use windows::Management::Deployment::{PackageManager, PackageTypes};
use windows::core::HSTRING;
use winreg::enums::{
    HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY, RegType,
};
use winreg::{RegKey, RegValue};

use crate::source::{
    MsixPackage, PackageSource, RegData, RegKeyData, RegRoot, RegistryReader, SourceError,
    filetime_to_system,
};

/// The registry of this PC, read-only.
#[derive(Debug, Clone, Copy, Default)]
pub struct WinRegistry;

impl RegistryReader for WinRegistry {
    fn subkeys(&self, root: RegRoot, path: &str) -> Result<Vec<RegKeyData>, SourceError> {
        let (hive, flags) = match root {
            RegRoot::CurrentUser => (HKEY_CURRENT_USER, KEY_READ),
            RegRoot::LocalMachine => (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_64KEY),
            RegRoot::LocalMachine32 => (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_32KEY),
        };
        let parent = match RegKey::predef(hive).open_subkey_with_flags(path, flags) {
            Ok(key) => key,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(source) => {
                return Err(SourceError::Registry {
                    root,
                    path: path.to_owned(),
                    source,
                });
            }
        };
        let mut keys = Vec::new();
        // A subkey that vanishes or denies access mid-scan is skipped, not fatal.
        for name in parent.enum_keys().filter_map(Result::ok) {
            let Ok(key) = parent.open_subkey_with_flags(&name, flags) else {
                continue;
            };
            let last_write = key.query_info().ok().and_then(|info| {
                let ft = &*info.last_write_time;
                filetime_to_system(
                    (u64::from(ft.dwHighDateTime) << 32) | u64::from(ft.dwLowDateTime),
                )
            });
            let values = key
                .enum_values()
                .filter_map(Result::ok)
                .map(|(name, value)| (name, convert(&value)))
                .collect();
            keys.push(RegKeyData {
                name,
                last_write,
                values,
            });
        }
        Ok(keys)
    }
}

fn convert(value: &RegValue<'_>) -> RegData {
    let bytes: &[u8] = &value.bytes;
    match value.vtype {
        RegType::REG_SZ | RegType::REG_EXPAND_SZ => RegData::String(utf16(bytes)),
        RegType::REG_DWORD => bytes
            .get(..4)
            .and_then(|b| <[u8; 4]>::try_from(b).ok())
            .map_or(RegData::Other, |b| RegData::Dword(u32::from_le_bytes(b))),
        RegType::REG_QWORD => bytes
            .get(..8)
            .and_then(|b| <[u8; 8]>::try_from(b).ok())
            .map_or(RegData::Other, |b| RegData::Qword(u64::from_le_bytes(b))),
        RegType::REG_BINARY => RegData::Binary(bytes.to_vec()),
        _ => RegData::Other,
    }
}

/// UTF-16LE bytes up to the first NUL (an odd trailing byte is dropped).
fn utf16(bytes: &[u8]) -> String {
    let (pairs, _) = bytes.as_chunks::<2>();
    let units: Vec<u16> = pairs
        .iter()
        .map(|&pair| u16::from_le_bytes(pair))
        .take_while(|&u| u != 0)
        .collect();
    String::from_utf16_lossy(&units)
}

/// The current user's MSIX/AppX main packages (frameworks, resource packs and optional packages
/// are left out by the query).
#[derive(Debug, Clone, Copy, Default)]
pub struct MsixPackages;

impl PackageSource for MsixPackages {
    fn packages(&self) -> Result<Vec<MsixPackage>, SourceError> {
        let failed = |e: windows::core::Error| SourceError::Packages(e.message());
        let manager = PackageManager::new().map_err(failed)?;
        // An empty SID = the current user (FindPackagesForUser); no elevation needed.
        let found = manager
            .FindPackagesByUserSecurityIdWithPackageTypes(&HSTRING::new(), PackageTypes::Main)
            .map_err(failed)?;
        Ok(found
            .into_iter()
            .filter_map(|package| match read_package(&package) {
                Ok(p) => Some(p),
                Err(e) => {
                    tracing::debug!(error = %e.message(), "skipped an unreadable package");
                    None
                }
            })
            .collect())
    }
}

fn read_package(package: &Package) -> windows::core::Result<MsixPackage> {
    let id = package.Id()?;
    let v = id.Version()?;
    Ok(MsixPackage {
        name: id.Name()?.to_string(),
        family_name: id.FamilyName()?.to_string(),
        version: format!("{}.{}.{}.{}", v.Major, v.Minor, v.Build, v.Revision),
        // Missing for packages being staged or removed; the package still counts.
        install_location: package
            .InstalledPath()
            .ok()
            .map(|p| PathBuf::from(p.to_os_string()))
            .filter(|p| !p.as_os_str().is_empty()),
        installed: package
            .InstalledDate()
            .ok()
            .and_then(|d| u64::try_from(d.UniversalTime).ok())
            .and_then(filetime_to_system),
    })
}

#[cfg(test)]
mod tests {
    use std::borrow::Cow;

    use super::*;

    fn value(vtype: RegType, bytes: Vec<u8>) -> RegValue<'static> {
        RegValue {
            bytes: Cow::Owned(bytes),
            vtype,
        }
    }

    fn wide(s: &str) -> Vec<u8> {
        s.encode_utf16()
            .chain([0])
            .flat_map(u16::to_le_bytes)
            .collect()
    }

    #[test]
    fn converts_registry_values() {
        assert_eq!(
            convert(&value(RegType::REG_SZ, wide("Слоўнік"))),
            RegData::String("Слоўнік".into())
        );
        assert_eq!(
            convert(&value(RegType::REG_EXPAND_SZ, wide("%ProgramFiles%\\X"))),
            RegData::String("%ProgramFiles%\\X".into())
        );
        assert_eq!(
            convert(&value(RegType::REG_DWORD, 1_u32.to_le_bytes().to_vec())),
            RegData::Dword(1)
        );
        assert_eq!(convert(&value(RegType::REG_DWORD, vec![1])), RegData::Other);
        assert_eq!(
            convert(&value(RegType::REG_QWORD, 7_u64.to_le_bytes().to_vec())),
            RegData::Qword(7)
        );
        assert_eq!(
            convert(&value(RegType::REG_BINARY, vec![1, 2])),
            RegData::Binary(vec![1, 2])
        );
        assert_eq!(
            convert(&value(RegType::REG_MULTI_SZ, wide("a"))),
            RegData::Other
        );
        assert_eq!(utf16(&[b'a', 0, b'b']), "a", "odd trailing byte dropped");
    }

    /// Reads (never writes) the real registry: the Uninstall key opens, every key read has its
    /// last-write time, and a missing path is empty rather than an error.
    #[test]
    fn reads_the_real_uninstall_key() {
        let keys = WinRegistry
            .subkeys(RegRoot::LocalMachine, crate::uninstall::UNINSTALL_PATH)
            .unwrap();
        assert!(keys.iter().all(|k| k.last_write.is_some()));
        let missing = WinRegistry
            .subkeys(RegRoot::CurrentUser, r"Software\Paparats\Does\Not\Exist")
            .unwrap();
        assert!(missing.is_empty());
    }
}
