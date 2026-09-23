//! The real strategies through the `Installer` trait, in temp directories. Tests that change
//! machine state (MSI, MSIX, elevated installs) are `#[ignore]`d: see each for how to run it.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use paparats_core::{InstallStrategy, InstalledApp, Package, TrustLevel};

use super::*;
use crate::verify::sha256_hex;
use crate::{GateState, InstallTarget, StrictTrust, gate};

fn installer(root: &Path) -> StrategyInstaller {
    installer_with(root, Arc::new(StrictTrust))
}

fn installer_with(root: &Path, trust: Arc<dyn TrustSource>) -> StrategyInstaller {
    let mut config = InstallerConfig::in_dir(root);
    config.process_timeout = Duration::from_secs(60);
    StrategyInstaller::new(config, trust)
        .with_simulated(SimulatedInstaller::with_timing(Duration::from_millis(1), 2))
}

fn package(app_id: &str, version: &str, strategy: InstallStrategy, file: Option<&Path>) -> Package {
    Package {
        app_id: app_id.into(),
        version: version.into(),
        url: file.map(|_| format!("https://downloads.example.org/{app_id}")),
        sha256: file.map(|f| sha256_hex(&mut fs::File::open(f).unwrap()).unwrap()),
        size_bytes: file.map_or(0, |f| fs::metadata(f).unwrap().len()),
        strategy,
        signer: None,
    }
}

async fn install(
    installer: &StrategyInstaller,
    package: &Package,
    file: Option<&Path>,
    target: &InstallTarget,
) -> Result<InstalledApp, InstallError> {
    let (_ctl, mut g) = gate(GateState::OPEN);
    installer
        .install(
            InstallRequest {
                package,
                file,
                target,
                date: "2026-09-23",
            },
            &mut g,
        )
        .await
}

fn app(app_id: &str, version: &str) -> InstalledApp {
    InstalledApp {
        app_id: app_id.into(),
        version: version.into(),
        last_used: "2026-09-23".into(),
    }
}

#[tokio::test]
async fn simulated_packages_keep_the_simulated_hold() {
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let p = Package::simulated("vlc", "3.0.21", 40.0);
    let installed = install(&installer, &p, None, &InstallTarget::default())
        .await
        .unwrap();
    assert_eq!(installed, app("vlc", "3.0.21"));
    // Nothing on disk, no receipt; uninstall is a no-op.
    assert!(!root.path().join("receipts").exists());
    installer.uninstall(&installed).await.unwrap();
}

#[tokio::test]
async fn from_flags_picks_the_implementation() {
    let simulated = from_flags(false, Arc::new(StrictTrust)).unwrap();
    let p = Package::simulated("vlc", "3.0.21", 40.0);
    let (_ctl, mut g) = gate(GateState::OPEN);
    let target = InstallTarget::default();
    let request = InstallRequest {
        package: &p,
        file: None,
        target: &target,
        date: "2026-09-23",
    };
    tokio::time::pause();
    let installed = simulated.install(request, &mut g).await.unwrap();
    assert_eq!(installed.version, "3.0.21");
    #[cfg(windows)]
    assert!(from_flags(true, Arc::new(StrictTrust)).is_ok());
}

#[tokio::test]
async fn real_strategies_need_the_file_and_its_hash() {
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let target = InstallTarget::default();
    let p = package("tool", "1.0", InstallStrategy::PortableZip, None);
    assert!(matches!(
        install(&installer, &p, None, &target).await,
        Err(InstallError::MissingFile)
    ));
    let file = root.path().join("tool.zip");
    crate::archive::tests::write_zip(&file, &[("tool.exe", b"MZ")]);
    // A manifest without a SHA-256 is refused before anything runs.
    assert!(matches!(
        install(&installer, &p, Some(&file), &target).await,
        Err(InstallError::InvalidPackage(_))
    ));
    let mut wrong = package("tool", "1.0", InstallStrategy::PortableZip, Some(&file));
    wrong.sha256 = Some("ab".repeat(32));
    assert!(matches!(
        install(&installer, &wrong, Some(&file), &target).await,
        Err(InstallError::HashMismatch)
    ));
}

#[tokio::test]
async fn a_cancelled_item_does_not_start() {
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let file = root.path().join("tool.zip");
    crate::archive::tests::write_zip(&file, &[("tool.exe", b"MZ")]);
    let p = package("tool", "1.0", InstallStrategy::PortableZip, Some(&file));
    let (ctl, mut g) = gate(GateState::OPEN);
    ctl.cancel();
    let target = InstallTarget::default();
    let result = installer
        .install(
            InstallRequest {
                package: &p,
                file: Some(&file),
                target: &target,
                date: "2026-09-23",
            },
            &mut g,
        )
        .await;
    assert!(matches!(result, Err(InstallError::Cancelled)));
    assert!(!root.path().join("apps/tool/1.0").exists());
}

#[cfg(windows)]
#[tokio::test]
async fn portable_install_update_and_uninstall() {
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let config = installer.config().clone();
    let target = InstallTarget::default();

    let v1 = root.path().join("tool-1.0.zip");
    crate::archive::tests::write_zip(&v1, &[("Tool.exe", b"MZ v1"), ("readme.txt", b"1")]);
    let p1 = package("tool", "1.0", InstallStrategy::PortableZip, Some(&v1));
    let installed = install(&installer, &p1, Some(&v1), &target).await.unwrap();
    assert_eq!(installed, app("tool", "1.0"));
    assert_eq!(
        fs::read(config.apps_dir.join("tool/1.0/Tool.exe")).unwrap(),
        b"MZ v1"
    );
    let link = config.shortcuts_dir.join("Tool.lnk");
    assert!(link.is_file());
    assert!(config.receipts_dir.join("tool.json").is_file());

    // An update lands next to it, then the old version goes.
    let v2 = root.path().join("tool-2.0.zip");
    crate::archive::tests::write_zip(&v2, &[("Tool.exe", b"MZ v2")]);
    let p2 = package("tool", "2.0", InstallStrategy::PortableZip, Some(&v2));
    install(&installer, &p2, Some(&v2), &target).await.unwrap();
    assert_eq!(
        fs::read(config.apps_dir.join("tool/2.0/Tool.exe")).unwrap(),
        b"MZ v2"
    );
    assert!(!config.apps_dir.join("tool/1.0").exists());
    assert!(link.is_file(), "the shortcut now opens 2.0");

    installer.uninstall(&app("tool", "2.0")).await.unwrap();
    assert!(!config.apps_dir.join("tool").exists());
    assert!(!link.exists());
    assert!(!config.receipts_dir.join("tool.json").exists());
    // The downloaded packages are untouched (the queue owns them).
    assert!(v1.is_file() && v2.is_file());
}

#[cfg(windows)]
fn system32(exe: &str) -> PathBuf {
    crate::sys::known_folder(crate::sys::KnownFolder::System)
        .unwrap()
        .join(exe)
}

/// A copy of a Microsoft-signed (catalog) system program stands in for a signed installer: it
/// runs, exits, and changes nothing.
#[cfg(windows)]
fn signed_setup(dir: &Path) -> PathBuf {
    let setup = dir.join("where-setup.exe");
    fs::copy(system32("where.exe"), &setup).unwrap();
    setup
}

#[cfg(windows)]
#[tokio::test]
async fn exe_silent_runs_a_signed_installer_with_the_manifest_args() {
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let target = InstallTarget::default();
    let setup = signed_setup(root.path());

    let ok = InstallStrategy::ExeSilent {
        args: vec!["/q".into(), "where".into()],
    };
    let mut p = package("where", "1.0", ok, Some(&setup));
    p.signer = Some("Microsoft Windows".into());
    let installed = install(&installer, &p, Some(&setup), &target)
        .await
        .unwrap();
    assert_eq!(installed, app("where", "1.0"));
    assert!(root.path().join("receipts/where.json").is_file());
    // EXE uninstall needs the app's own uninstaller (inventory): typed error, receipt kept.
    assert!(matches!(
        installer.uninstall(&installed).await,
        Err(InstallError::Unsupported(_))
    ));

    // A failing exit code is a typed failure.
    let failing = InstallStrategy::ExeSilent {
        args: vec!["/q".into(), "paparats-no-such-program".into()],
    };
    let p = package("where", "1.0", failing, Some(&setup));
    assert!(matches!(
        install(&installer, &p, Some(&setup), &target).await,
        Err(InstallError::ExitCode(1))
    ));
}

#[cfg(windows)]
#[tokio::test]
async fn exe_silent_enforces_the_signature_policy() {
    let root = tempfile::tempdir().unwrap();
    let target = InstallTarget::default();
    let setup = signed_setup(root.path());
    let args = InstallStrategy::ExeSilent {
        args: vec!["/q".into(), "where".into()],
    };

    // Signed, but not by the manifest's signer.
    let strict = installer(root.path());
    let mut p = package("where", "1.0", args.clone(), Some(&setup));
    p.signer = Some("Nilesoft".into());
    assert!(matches!(
        install(&strict, &p, Some(&setup), &target).await,
        Err(InstallError::SignerMismatch { .. })
    ));

    // Unsigned: the test binary itself (an unsigned PE; `--list` just lists its tests).
    let unsigned = root.path().join("unsigned-setup.exe");
    fs::copy(std::env::current_exe().unwrap(), &unsigned).unwrap();
    let listing = InstallStrategy::ExeSilent {
        args: vec!["--list".into()],
    };
    let p = package("unsigned", "1.0", listing, Some(&unsigned));
    let err = install(&strict, &p, Some(&unsigned), &target)
        .await
        .unwrap_err();
    assert!(matches!(err, InstallError::Unsigned), "{err:?}");
    assert_eq!(err.code(), "unsigned");

    // A community channel whose warning the user accepted may run it.
    let community = installer_with(
        root.path(),
        Arc::new(|_: &Package| PackageTrust {
            channel: TrustLevel::Community,
            unsigned_accepted: true,
        }),
    );
    install(&community, &p, Some(&unsigned), &target)
        .await
        .unwrap();

    // Not an .exe file: refused before anything runs.
    let renamed = root.path().join("setup.bin");
    fs::copy(&setup, &renamed).unwrap();
    let p = package("where", "1.0", args, Some(&renamed));
    assert!(matches!(
        install(&strict, &p, Some(&renamed), &target).await,
        Err(InstallError::InvalidPackage(_))
    ));
}

#[cfg(windows)]
#[tokio::test]
async fn msi_refuses_an_unsigned_package_before_reading_it() {
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let fake = root.path().join("fake.msi");
    fs::write(&fake, b"not an msi").unwrap();
    let p = package("fake", "1.0", InstallStrategy::Msi, Some(&fake));
    assert!(matches!(
        install(&installer, &p, Some(&fake), &InstallTarget::default()).await,
        Err(InstallError::Unsigned)
    ));
}

/// Installs a real MSI per user, then uninstalls it. Changes this PC.
/// Run: `set PAPARATS_TEST_MSI=C:\path\to\signed-per-user.msi` then
/// `cargo test -p paparats-install -- --ignored real_msi_install`.
#[cfg(windows)]
#[tokio::test]
#[ignore = "installs a real MSI (set PAPARATS_TEST_MSI)"]
async fn real_msi_install() {
    let Some(msi) = std::env::var_os("PAPARATS_TEST_MSI").map(PathBuf::from) else {
        panic!("set PAPARATS_TEST_MSI to a signed MSI");
    };
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let p = package("test-msi", "1.0", InstallStrategy::Msi, Some(&msi));
    let installed = install(&installer, &p, Some(&msi), &InstallTarget::default())
        .await
        .unwrap();
    installer.uninstall(&installed).await.unwrap();
}

/// Runs a real EXE installer with the given silent arguments. Changes this PC.
/// Run: `set PAPARATS_TEST_EXE=C:\path\to\setup.exe`, `set PAPARATS_TEST_EXE_ARGS=/VERYSILENT
/// /SUPPRESSMSGBOXES /NORESTART /SP-` (space-separated), then
/// `cargo test -p paparats-install -- --ignored real_exe_install`.
#[cfg(windows)]
#[tokio::test]
#[ignore = "runs a real EXE installer (set PAPARATS_TEST_EXE)"]
async fn real_exe_install() {
    let Some(exe) = std::env::var_os("PAPARATS_TEST_EXE").map(PathBuf::from) else {
        panic!("set PAPARATS_TEST_EXE to a signed installer");
    };
    let args = std::env::var("PAPARATS_TEST_EXE_ARGS")
        .unwrap_or_default()
        .split_whitespace()
        .map(String::from)
        .collect();
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let p = package(
        "test-exe",
        "1.0",
        InstallStrategy::ExeSilent { args },
        Some(&exe),
    );
    install(&installer, &p, Some(&exe), &InstallTarget::default())
        .await
        .unwrap();
}

/// Installs a real MSIX for the current user, then removes it. Changes this PC.
/// Run: `set PAPARATS_TEST_MSIX=C:\path\to\trusted.msix` then
/// `cargo test -p paparats-install -- --ignored real_msix_install`.
#[cfg(windows)]
#[tokio::test]
#[ignore = "deploys a real MSIX (set PAPARATS_TEST_MSIX)"]
async fn real_msix_install() {
    let Some(msix) = std::env::var_os("PAPARATS_TEST_MSIX").map(PathBuf::from) else {
        panic!("set PAPARATS_TEST_MSIX to a trusted package");
    };
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let p = package("test-msix", "1.0", InstallStrategy::Msix, Some(&msix));
    let installed = install(&installer, &p, Some(&msix), &InstallTarget::default())
        .await
        .unwrap();
    installer.uninstall(&installed).await.unwrap();
}

/// A machine-wide install elevates through the UAC prompt (answer it). Changes this PC.
/// Run: `set PAPARATS_TEST_MSI=…` then
/// `cargo test -p paparats-install -- --ignored real_machine_wide_msi_install`.
#[cfg(windows)]
#[tokio::test]
#[ignore = "shows a UAC prompt and installs a real MSI for all users (set PAPARATS_TEST_MSI)"]
async fn real_machine_wide_msi_install() {
    let Some(msi) = std::env::var_os("PAPARATS_TEST_MSI").map(PathBuf::from) else {
        panic!("set PAPARATS_TEST_MSI to a signed MSI");
    };
    let root = tempfile::tempdir().unwrap();
    let installer = installer(root.path());
    let p = package("test-msi", "1.0", InstallStrategy::Msi, Some(&msi));
    let target = InstallTarget {
        per_user: false,
        ..InstallTarget::default()
    };
    let installed = install(&installer, &p, Some(&msi), &target).await.unwrap();
    installer.uninstall(&installed).await.unwrap();
}
