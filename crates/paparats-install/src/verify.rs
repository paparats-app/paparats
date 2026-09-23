//! Opens a downloaded package for installing: read-only and locked against writers (other
//! processes may still read it — msiexec, the installer itself), then checks its SHA-256 against
//! the verified manifest. The handle stays open until the install ends, so the bytes that were
//! hashed (and signature-checked) are the bytes that run.

use std::fs::{File, OpenOptions};
use std::io::{self, Read, Seek};
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::InstallError;

/// `FILE_SHARE_READ`: others may read, nobody may write, rename or delete while we hold it.
#[cfg(windows)]
const FILE_SHARE_READ: u32 = 0x0000_0001;

/// Opens `path` locked against writers.
pub fn open_locked(path: &Path) -> Result<File, InstallError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(FILE_SHARE_READ);
    }
    options.open(path).map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => InstallError::MissingFile,
        _ => InstallError::Io(e),
    })
}

/// Lower-case hex SHA-256 of the whole file (read from the start; the position is left at the
/// start again).
pub fn sha256_hex(file: &mut File) -> io::Result<String> {
    file.rewind()?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    file.rewind()?;
    Ok(hex(&hasher.finalize()))
}

pub fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut s, b| {
            let _ = write!(s, "{b:02x}");
            s
        })
}

/// Opens `path` locked and checks it against the manifest's SHA-256 (mandatory for every real
/// strategy).
pub fn open_verified(path: &Path, expected_sha256: Option<&str>) -> Result<File, InstallError> {
    let expected = expected_sha256
        .map(str::trim)
        .filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()))
        .ok_or_else(|| InstallError::invalid("the manifest has no valid SHA-256"))?;
    let mut file = open_locked(path)?;
    let actual = sha256_hex(&mut file)?;
    if actual.eq_ignore_ascii_case(expected) {
        Ok(file)
    } else {
        Err(InstallError::HashMismatch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    const HELLO_SHA256: &str = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

    fn hello(dir: &Path) -> std::path::PathBuf {
        let path = dir.join("hello.bin");
        File::create(&path)
            .and_then(|mut f| f.write_all(b"hello"))
            .unwrap();
        path
    }

    #[test]
    fn checks_the_manifest_hash() {
        let dir = tempfile::tempdir().unwrap();
        let path = hello(dir.path());
        assert!(open_verified(&path, Some(HELLO_SHA256)).is_ok());
        assert!(open_verified(&path, Some(&HELLO_SHA256.to_uppercase())).is_ok());
        assert!(matches!(
            open_verified(&path, Some(&"00".repeat(32))),
            Err(InstallError::HashMismatch)
        ));
        assert!(matches!(
            open_verified(&path, None),
            Err(InstallError::InvalidPackage(_))
        ));
        assert!(matches!(
            open_verified(&path, Some("abc")),
            Err(InstallError::InvalidPackage(_))
        ));
        assert!(matches!(
            open_verified(&dir.path().join("gone.bin"), Some(HELLO_SHA256)),
            Err(InstallError::MissingFile)
        ));
    }

    #[cfg(windows)]
    #[test]
    fn the_verified_file_cannot_be_rewritten_while_held() {
        let dir = tempfile::tempdir().unwrap();
        let path = hello(dir.path());
        let mut held = open_verified(&path, Some(HELLO_SHA256)).unwrap();
        // Writers and deleters are shut out; readers are not.
        assert!(OpenOptions::new().write(true).open(&path).is_err());
        assert!(std::fs::remove_file(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"hello");
        let mut s = String::new();
        held.read_to_string(&mut s).unwrap();
        assert_eq!(s, "hello");
        drop(held);
        std::fs::remove_file(&path).unwrap();
    }
}
