//! Non-Windows builds: the real strategies do not exist there.

use std::fs::File;
use std::path::{Path, PathBuf};
use std::time::Duration;

use super::{KnownFolder, MsiInfo};
use crate::InstallError;
use crate::authenticode::{AuthenticodeError, SignerInfo};

pub(crate) fn known_folder(_folder: KnownFolder) -> Result<PathBuf, InstallError> {
    Err(InstallError::Unsupported("known folders"))
}

pub(crate) fn verify_trust(_file: &File, _path: &Path) -> Result<SignerInfo, AuthenticodeError> {
    Err(AuthenticodeError::System(
        "Authenticode is only available on Windows".into(),
    ))
}

pub(crate) fn msi_info(_path: &Path) -> Result<MsiInfo, InstallError> {
    Err(InstallError::Unsupported("msi"))
}

pub(crate) fn run_elevated(
    _program: &Path,
    _params: &[u16],
    _dir: Option<&Path>,
    _timeout: Duration,
) -> Result<i32, InstallError> {
    Err(InstallError::Unsupported("elevation"))
}

pub(crate) fn create_shortcut(
    _link: &Path,
    _target: &Path,
    _dir: &Path,
) -> Result<(), InstallError> {
    Err(InstallError::Unsupported("shortcuts"))
}

pub(crate) fn msix_add(_uri: &str) -> Result<(), InstallError> {
    Err(InstallError::Unsupported("msix"))
}

pub(crate) fn msix_remove(_name: &str, _publisher: &str) -> Result<(), InstallError> {
    Err(InstallError::Unsupported("msix"))
}
