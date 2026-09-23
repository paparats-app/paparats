//! Installable packages: what a (signed) channel manifest declares for one release of an app, and
//! how the installer should run it. Used by the download and install crates; the UI only sees it
//! on [`UpdateManifest::package`](super::catalog::UpdateManifest::package) and never acts on it.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::catalog::AppId;

/// How a downloaded package is installed. The real strategies run with `PAPARATS_REAL=install`
/// (M7); `Simulated` drives the mock world and tests with the prototype's timings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum InstallStrategy {
    /// `msiexec /i <file> /qn` (arguments passed as a vector, never through a shell).
    Msi,
    /// Inno/NSIS/other installer with silent arguments taken verbatim from the manifest.
    ExeSilent { args: Vec<String> },
    /// MSIX via `Windows.Management.Deployment.PackageManager`.
    Msix,
    /// Extract to the per-user apps directory and create a shortcut.
    PortableZip,
    /// No file-system side effects: holds in "installing" for a few ticks, then succeeds.
    Simulated,
}

/// One release of an app as the queue downloads and installs it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Package {
    pub app_id: AppId,
    pub version: String,
    /// Download URL from the verified manifest; `None` for simulated packages.
    pub url: Option<String>,
    /// Lower-case hex SHA-256 of the file, from the verified manifest.
    pub sha256: Option<String>,
    /// Exact file size in bytes (0 = unknown).
    #[specta(type = crate::Num)]
    pub size_bytes: u64,
    pub strategy: InstallStrategy,
    /// Expected Authenticode signer of an EXE/MSI package, from the verified manifest: the
    /// certificate's common name (`Microsoft Corporation`) or its full subject
    /// (`CN=…, O=…, C=…`), compared case-insensitively. `None` (null or absent) = any valid
    /// signature.
    pub signer: Option<String>,
}

impl Package {
    /// A package with no file behind it (mock world, tests).
    pub fn simulated(app_id: impl Into<AppId>, version: impl Into<String>, size_mb: f64) -> Self {
        Self {
            app_id: app_id.into(),
            version: version.into(),
            url: None,
            sha256: None,
            size_bytes: mb_to_bytes(size_mb),
            strategy: InstallStrategy::Simulated,
            signer: None,
        }
    }
}

/// Megabytes as shown in the catalog (MiB) → bytes. Negative or non-finite sizes count as 0.
pub fn mb_to_bytes(mb: f64) -> u64 {
    if mb.is_finite() && mb > 0.0 {
        // Catalog sizes are small (≤ a few GB), far below u64/f64 precision limits; `as`
        // saturates on overflow.
        (mb * 1_048_576.0).round() as u64
    } else {
        0
    }
}

/// Bytes → megabytes (MiB), the unit of every size in the UI.
pub fn bytes_to_mb(bytes: u64) -> f64 {
    bytes as f64 / 1_048_576.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strategy_wire_shape() {
        let s = InstallStrategy::ExeSilent {
            args: vec!["/S".into()],
        };
        let json = serde_json::to_value(&s).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"kind": "exeSilent", "args": ["/S"]})
        );
        let back: InstallStrategy = serde_json::from_value(json).unwrap();
        assert_eq!(back, s);
        assert_eq!(
            serde_json::to_value(InstallStrategy::PortableZip).unwrap(),
            serde_json::json!({"kind": "portableZip"})
        );
    }

    #[test]
    fn package_wire_shape_is_symmetric() {
        let mut p = Package::simulated("shell", "1.9.15", 3.2);
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["signer"], serde_json::Value::Null);
        assert_eq!(serde_json::from_value::<Package>(json.clone()).unwrap(), p);
        // Manifests written before the field existed still parse.
        let mut older = json;
        older.as_object_mut().unwrap().remove("signer");
        assert_eq!(serde_json::from_value::<Package>(older).unwrap(), p);

        p.strategy = InstallStrategy::Msi;
        p.sha256 = Some("ab".repeat(32));
        p.signer = Some("Nilesoft Ltd".into());
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["signer"], "Nilesoft Ltd");
        assert_eq!(json["strategy"], serde_json::json!({"kind": "msi"}));
        assert_eq!(serde_json::from_value::<Package>(json).unwrap(), p);
    }

    #[test]
    fn simulated_package_sizes() {
        let p = Package::simulated("vlc", "3.0.21", 41.0);
        assert_eq!(p.size_bytes, 41 * 1_048_576);
        assert!((bytes_to_mb(p.size_bytes) - 41.0).abs() < f64::EPSILON);
        assert_eq!(mb_to_bytes(-1.0), 0);
        assert_eq!(mb_to_bytes(f64::NAN), 0);
    }
}
