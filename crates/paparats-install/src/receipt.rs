//! Install receipts: what a real strategy installed, so that uninstall knows what to remove
//! (`<receipts>\<app-id>.json`). Simulated installs leave none.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::InstallError;
use crate::archive::check_component;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Receipt {
    Msi {
        version: String,
        product_code: String,
        machine_wide: bool,
    },
    ExeSilent {
        version: String,
    },
    Msix {
        version: String,
        /// Identity name and publisher from the package manifest.
        name: String,
        publisher: String,
    },
    PortableZip {
        version: String,
        dir: PathBuf,
        shortcut: Option<PathBuf>,
    },
    /// A single-file program copied into `dir`.
    PortableExe {
        version: String,
        dir: PathBuf,
        shortcut: Option<PathBuf>,
    },
}

impl Receipt {
    pub fn strategy(&self) -> &'static str {
        match self {
            Self::Msi { .. } => "msi",
            Self::ExeSilent { .. } => "exeSilent",
            Self::Msix { .. } => "msix",
            Self::PortableZip { .. } => "portableZip",
            Self::PortableExe { .. } => "portableExe",
        }
    }
}

/// The receipts folder.
#[derive(Debug, Clone)]
pub struct Receipts {
    dir: PathBuf,
}

impl Receipts {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    fn path(&self, app_id: &str) -> Result<PathBuf, InstallError> {
        check_component(app_id, "app id")?;
        Ok(self.dir.join(format!("{app_id}.json")))
    }

    pub fn load(&self, app_id: &str) -> Result<Option<Receipt>, InstallError> {
        let path = self.path(app_id)?;
        match fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(|_| InstallError::invalid("the install receipt is unreadable")),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Writes atomically (a temporary file renamed over the old receipt).
    pub fn save(&self, app_id: &str, receipt: &Receipt) -> Result<(), InstallError> {
        let path = self.path(app_id)?;
        fs::create_dir_all(&self.dir)?;
        let tmp = self.dir.join(format!("{app_id}.json.tmp"));
        let bytes = serde_json::to_vec_pretty(receipt)
            .map_err(|e| InstallError::System(format!("receipt: {e}")))?;
        fs::write(&tmp, bytes)?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    pub fn remove(&self, app_id: &str) -> Result<(), InstallError> {
        remove_file_if_exists(&self.path(app_id)?)
    }
}

pub fn remove_file_if_exists(path: &Path) -> Result<(), InstallError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn receipts_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let receipts = Receipts::new(dir.path().join("receipts"));
        assert_eq!(receipts.load("shell").unwrap(), None);
        let r = Receipt::Msi {
            version: "1.9.15".into(),
            product_code: "{12345678-9ABC-DEF0-1234-56789ABCDEF0}".into(),
            machine_wide: false,
        };
        receipts.save("shell", &r).unwrap();
        assert_eq!(receipts.load("shell").unwrap(), Some(r.clone()));
        let json: serde_json::Value =
            serde_json::from_slice(&fs::read(dir.path().join("receipts/shell.json")).unwrap())
                .unwrap();
        assert_eq!(json["kind"], "msi");
        assert_eq!(
            json["productCode"],
            "{12345678-9ABC-DEF0-1234-56789ABCDEF0}"
        );
        assert_eq!(r.strategy(), "msi");
        receipts.remove("shell").unwrap();
        receipts.remove("shell").unwrap();
        assert_eq!(receipts.load("shell").unwrap(), None);
        assert!(receipts.load("../evil").is_err());
    }
}
