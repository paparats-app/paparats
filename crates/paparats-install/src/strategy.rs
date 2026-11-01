//! The real installer: one [`Installer`] that runs each package with the strategy its verified
//! manifest names. Simulated packages (the mock world) keep the simulated hold, so the app works
//! the same with `PAPARATS_REAL=install` on fixture data.
//!
//! Every real strategy verifies before it trusts: the file is opened locked against writers and
//! checked against the manifest's SHA-256; EXE/MSI then need an Authenticode signature Windows
//! trusts (by the manifest's signer, when it names one) unless the policy allows unsigned
//! binaries for this package ([`crate::policy`]). The lock is held until the installer exits.

use std::fs::File;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use paparats_core::{InstallStrategy, InstalledApp, Package};

use crate::args::{self, MsiScope};
use crate::exit::{self, ExitOutcome};
use crate::policy::{self, PackageTrust, TrustSource};
use crate::process::{self, Run};
use crate::receipt::{Receipt, Receipts};
use crate::{
    BoxFuture, Gate, InstallError, InstallRequest, Installer, InstallerConfig, SimulatedInstaller,
    authenticode, msix, portable, sys, verify,
};

/// MSI, EXE silent, MSIX, portable ZIP and portable EXE behind the [`Installer`] trait.
pub struct StrategyInstaller {
    config: Arc<InstallerConfig>,
    trust: Arc<dyn TrustSource>,
    simulated: SimulatedInstaller,
    receipts: Receipts,
    /// One installer process at a time: Windows Installer runs one installation per machine (a
    /// second one fails with 1618), and EXE setups often wrap an MSI.
    exclusive: tokio::sync::Mutex<()>,
}

impl std::fmt::Debug for StrategyInstaller {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StrategyInstaller")
            .field("config", &self.config)
            .finish_non_exhaustive()
    }
}

/// The installer for the app's `PAPARATS_REAL` flags: the real strategies when the `install`
/// flag is on (`real`), the simulated installer otherwise. `trust` tells the real installer
/// which channel a package comes from and whether its unsigned warning was accepted.
pub fn from_flags(
    real: bool,
    trust: Arc<dyn TrustSource>,
) -> Result<Arc<dyn Installer>, InstallError> {
    if real {
        let config = InstallerConfig::for_current_user()?;
        Ok(Arc::new(StrategyInstaller::new(config, trust)))
    } else {
        Ok(Arc::new(SimulatedInstaller::new()))
    }
}

/// Runs blocking work on the blocking pool. `cancel` is raised once the gate is cancelled
/// (the work checks it where stopping is safe).
async fn blocking<T, F>(gate: &mut Gate, work: F) -> Result<T, InstallError>
where
    T: Send + 'static,
    F: FnOnce(&AtomicBool) -> Result<T, InstallError> + Send + 'static,
{
    let cancel = Arc::new(AtomicBool::new(gate.is_cancelled()));
    let flag = Arc::clone(&cancel);
    let mut task = tokio::task::spawn_blocking(move || work(&flag));
    let joined = tokio::select! {
        joined = &mut task => joined,
        () = wait_cancelled(gate) => {
            cancel.store(true, Ordering::Relaxed);
            task.await
        }
    };
    joined?
}

async fn wait_cancelled(gate: &mut Gate) {
    if gate.is_cancelled() {
        return;
    }
    while !gate.changed().await.cancelled {}
}

fn ensure_open(gate: &Gate) -> Result<(), InstallError> {
    if gate.is_cancelled() {
        Err(InstallError::Cancelled)
    } else {
        Ok(())
    }
}

/// Hash, then Authenticode + policy. Returns the file, still locked.
fn verify_signed(
    path: &Path,
    package: &Package,
    trust: PackageTrust,
) -> Result<File, InstallError> {
    let file = verify::open_verified(path, package.sha256.as_deref())?;
    let verdict = authenticode::verify_file(&file, path);
    match policy::authorize(
        verdict,
        package.signer.as_deref(),
        trust.for_package(package),
    )? {
        Some(signer) => tracing::info!(
            app = %package.app_id,
            signer = %signer.common_name,
            source = ?signer.source,
            "installer signature verified"
        ),
        None if package.unsigned => tracing::info!(
            app = %package.app_id,
            "running an unsigned file the official catalog pins by SHA-256"
        ),
        None => tracing::warn!(
            app = %package.app_id,
            "running an unsigned installer (community channel, warning accepted)"
        ),
    }
    Ok(file)
}

fn log_outcome(app_id: &str, strategy: &str, outcome: ExitOutcome) {
    match outcome {
        ExitOutcome::SuccessRebootRequired => {
            tracing::info!(app = %app_id, strategy, "installed; a restart finishes it");
        }
        ExitOutcome::Success => tracing::info!(app = %app_id, strategy, "installed"),
        other => tracing::warn!(app = %app_id, strategy, outcome = ?other, "installer failed"),
    }
}

impl StrategyInstaller {
    pub fn new(config: InstallerConfig, trust: Arc<dyn TrustSource>) -> Self {
        let receipts = Receipts::new(config.receipts_dir.clone());
        Self {
            config: Arc::new(config),
            trust,
            simulated: SimulatedInstaller::new(),
            receipts,
            exclusive: tokio::sync::Mutex::new(()),
        }
    }

    /// Replaces the installer used for `simulated` packages (tests: shorter timings).
    pub fn with_simulated(mut self, simulated: SimulatedInstaller) -> Self {
        self.simulated = simulated;
        self
    }

    pub fn config(&self) -> &InstallerConfig {
        &self.config
    }

    fn installed(request: &InstallRequest<'_>) -> InstalledApp {
        InstalledApp {
            app_id: request.package.app_id.clone(),
            version: request.package.version.clone(),
            last_used: request.date.to_owned(),
        }
    }

    async fn install_msi(
        &self,
        request: InstallRequest<'_>,
        gate: &mut Gate,
    ) -> Result<InstalledApp, InstallError> {
        let path = request.file.ok_or(InstallError::MissingFile)?.to_path_buf();
        let package = request.package.clone();
        let trust = self.trust.trust(request.package);
        let _turn = self.exclusive.lock().await;
        ensure_open(gate)?;
        let checked = path.clone();
        let (file, info) = blocking(gate, move |_| {
            let file = verify_signed(&checked, &package, trust)?;
            let info = sys::msi_info(&checked)?;
            Ok((file, info))
        })
        .await?;
        ensure_open(gate)?;
        // A package that only installs for all users elevates whatever the setting says.
        let per_user = request.target.per_user && !request.package.machine_wide;
        let scope = match (per_user, info.per_user_capable) {
            (true, true) => MsiScope::PerUser,
            (true, false) => return Err(InstallError::NeedsMachineWide),
            (false, _) => MsiScope::MachineWide,
        };
        tracing::info!(app = %request.package.app_id, ?scope, "running msiexec");
        let code = process::run(Run {
            program: self.config.msiexec.clone(),
            args: args::msi_install(&path, scope),
            dir: None,
            timeout: self.config.process_timeout,
            elevate: scope == MsiScope::MachineWide,
        })
        .await;
        drop(file);
        let outcome = exit::msi(code?);
        log_outcome(&request.package.app_id, "msi", outcome);
        outcome.into_result()?;
        self.receipts.save(
            &request.package.app_id,
            &Receipt::Msi {
                version: request.package.version.clone(),
                product_code: info.product_code,
                machine_wide: scope == MsiScope::MachineWide,
            },
        )?;
        Ok(Self::installed(&request))
    }

    async fn install_exe(
        &self,
        request: InstallRequest<'_>,
        manifest_args: &[String],
        gate: &mut Gate,
    ) -> Result<InstalledApp, InstallError> {
        let path = request.file.ok_or(InstallError::MissingFile)?.to_path_buf();
        let is_exe = path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("exe"));
        if !is_exe {
            return Err(InstallError::invalid(
                "an EXE installer must be an .exe file",
            ));
        }
        let argv = args::exe_silent(manifest_args)?;
        let package = request.package.clone();
        let trust = self.trust.trust(request.package);
        let _turn = self.exclusive.lock().await;
        ensure_open(gate)?;
        let checked = path.clone();
        let file = blocking(gate, move |_| verify_signed(&checked, &package, trust)).await?;
        ensure_open(gate)?;
        let machine_wide = !request.target.per_user || request.package.machine_wide;
        tracing::info!(app = %request.package.app_id, machine_wide, "running the installer");
        let code = process::run(Run {
            dir: process::parent_dir(&path),
            program: path,
            args: argv,
            timeout: self.config.process_timeout,
            elevate: machine_wide,
        })
        .await;
        drop(file);
        let outcome = exit::exe(code?);
        log_outcome(&request.package.app_id, "exeSilent", outcome);
        outcome.into_result()?;
        self.receipts.save(
            &request.package.app_id,
            &Receipt::ExeSilent {
                version: request.package.version.clone(),
            },
        )?;
        Ok(Self::installed(&request))
    }

    async fn install_msix(
        &self,
        request: InstallRequest<'_>,
        gate: &mut Gate,
    ) -> Result<InstalledApp, InstallError> {
        let path = request.file.ok_or(InstallError::MissingFile)?.to_path_buf();
        let sha256 = request.package.sha256.clone();
        let _turn = self.exclusive.lock().await;
        ensure_open(gate)?;
        // The OS verifies the package signature itself; the hash ties it to the manifest.
        let (file, uri, identity) = blocking(gate, move |_| {
            let file = verify::open_verified(&path, sha256.as_deref())?;
            let identity = msix::read_identity(&file)?;
            let uri = msix::file_uri(&path)?;
            Ok((file, uri, identity))
        })
        .await?;
        ensure_open(gate)?;
        tracing::info!(app = %request.package.app_id, "deploying the MSIX package");
        let added = blocking(gate, move |_| sys::msix_add(&uri)).await;
        drop(file);
        added?;
        self.receipts.save(
            &request.package.app_id,
            &Receipt::Msix {
                version: request.package.version.clone(),
                name: identity.name,
                publisher: identity.publisher,
            },
        )?;
        tracing::info!(app = %request.package.app_id, strategy = "msix", "installed");
        Ok(Self::installed(&request))
    }

    async fn install_portable(
        &self,
        request: InstallRequest<'_>,
        gate: &mut Gate,
    ) -> Result<InstalledApp, InstallError> {
        let path = request.file.ok_or(InstallError::MissingFile)?.to_path_buf();
        ensure_open(gate)?;
        let app_id = request.package.app_id.clone();
        let previous = self.receipts.load(&app_id)?;
        let config = Arc::clone(&self.config);
        let (id, version, sha256, launch) = (
            app_id.clone(),
            request.package.version.clone(),
            request.package.sha256.clone(),
            request.package.launch.clone(),
        );
        let placed = blocking(gate, move |cancel| {
            portable::install(
                &config,
                &id,
                &version,
                &path,
                sha256.as_deref(),
                launch.as_deref(),
                cancel,
            )
        })
        .await?;
        self.receipts.save(
            &app_id,
            &Receipt::PortableZip {
                version: request.package.version.clone(),
                dir: placed.dir.clone(),
                shortcut: placed.shortcut.clone(),
            },
        )?;
        // An update replaces the previous version: remove what it left that the new one does
        // not reuse (best effort — the new version is installed either way).
        if let Some(
            Receipt::PortableZip { dir, shortcut, .. } | Receipt::PortableExe { dir, shortcut, .. },
        ) = previous
            && dir != placed.dir
        {
            let config = Arc::clone(&self.config);
            let old_link = shortcut.filter(|l| Some(l) != placed.shortcut.as_ref());
            let id = app_id.clone();
            let cleaned = tokio::task::spawn_blocking(move || {
                portable::remove(&config, &id, &dir, old_link.as_deref())
            })
            .await;
            if !matches!(cleaned, Ok(Ok(()))) {
                tracing::warn!(app = %app_id, "could not remove the previous portable version");
            }
        }
        tracing::info!(app = %app_id, strategy = "portableZip", "installed");
        Ok(Self::installed(&request))
    }

    async fn install_portable_exe(
        &self,
        request: InstallRequest<'_>,
        gate: &mut Gate,
    ) -> Result<InstalledApp, InstallError> {
        let path = request.file.ok_or(InstallError::MissingFile)?.to_path_buf();
        ensure_open(gate)?;
        let app_id = request.package.app_id.clone();
        let previous = self.receipts.load(&app_id)?;
        let package = request.package.clone();
        let trust = self.trust.trust(request.package);
        let config = Arc::clone(&self.config);
        // Hash and signature first, then the copy from the same locked handle.
        let placed = blocking(gate, move |_| {
            let mut file = verify_signed(&path, &package, trust)?;
            portable::install_exe(
                &config,
                &package.app_id,
                &package.version,
                &mut file,
                package.launch.as_deref(),
            )
        })
        .await?;
        self.receipts.save(
            &app_id,
            &Receipt::PortableExe {
                version: request.package.version.clone(),
                dir: placed.dir.clone(),
                shortcut: placed.shortcut.clone(),
            },
        )?;
        if let Some(
            Receipt::PortableZip { dir, shortcut, .. } | Receipt::PortableExe { dir, shortcut, .. },
        ) = previous
            && dir != placed.dir
        {
            let config = Arc::clone(&self.config);
            let old_link = shortcut.filter(|l| Some(l) != placed.shortcut.as_ref());
            let id = app_id.clone();
            let cleaned = tokio::task::spawn_blocking(move || {
                portable::remove(&config, &id, &dir, old_link.as_deref())
            })
            .await;
            if !matches!(cleaned, Ok(Ok(()))) {
                tracing::warn!(app = %app_id, "could not remove the previous portable version");
            }
        }
        tracing::info!(app = %app_id, strategy = "portableExe", "installed");
        Ok(Self::installed(&request))
    }

    async fn uninstall_receipt(&self, app_id: &str, receipt: Receipt) -> Result<(), InstallError> {
        match receipt {
            Receipt::Msi {
                product_code,
                machine_wide,
                ..
            } => {
                let argv = args::msi_uninstall(&product_code)?;
                let _turn = self.exclusive.lock().await;
                let code = process::run(Run {
                    program: self.config.msiexec.clone(),
                    args: argv,
                    dir: None,
                    timeout: self.config.process_timeout,
                    elevate: machine_wide,
                })
                .await?;
                exit::msi_uninstall(code).into_result()?;
            }
            Receipt::ExeSilent { .. } => {
                // EXE installers register their own uninstaller; running it needs the
                // inventory's Uninstall entry, which this crate does not read.
                return Err(InstallError::Unsupported("EXE uninstall"));
            }
            Receipt::Msix {
                name, publisher, ..
            } => {
                let _turn = self.exclusive.lock().await;
                tokio::task::spawn_blocking(move || sys::msix_remove(&name, &publisher)).await??;
            }
            Receipt::PortableZip { dir, shortcut, .. }
            | Receipt::PortableExe { dir, shortcut, .. } => {
                let config = Arc::clone(&self.config);
                let id = app_id.to_owned();
                tokio::task::spawn_blocking(move || {
                    portable::remove(&config, &id, &dir, shortcut.as_deref())
                })
                .await??;
            }
        }
        self.receipts.remove(app_id)?;
        tracing::info!(app = %app_id, "uninstalled");
        Ok(())
    }
}

impl Installer for StrategyInstaller {
    fn install<'a>(
        &'a self,
        request: InstallRequest<'a>,
        gate: &'a mut Gate,
    ) -> BoxFuture<'a, Result<InstalledApp, InstallError>> {
        Box::pin(async move {
            match &request.package.strategy {
                InstallStrategy::Simulated => self.simulated.install(request, gate).await,
                InstallStrategy::Msi => self.install_msi(request, gate).await,
                InstallStrategy::ExeSilent { args } => self.install_exe(request, args, gate).await,
                InstallStrategy::Msix => self.install_msix(request, gate).await,
                InstallStrategy::PortableZip => self.install_portable(request, gate).await,
                InstallStrategy::PortableExe => self.install_portable_exe(request, gate).await,
            }
        })
    }

    /// Uninstalls what a real strategy installed (from its receipt). An app without a receipt
    /// was not installed by Paparats' real strategies (simulated or seeded data): nothing to do.
    fn uninstall<'a>(&'a self, app: &'a InstalledApp) -> BoxFuture<'a, Result<(), InstallError>> {
        Box::pin(async move {
            match self.receipts.load(&app.app_id)? {
                Some(receipt) => {
                    tracing::info!(app = %app.app_id, strategy = receipt.strategy(), "uninstalling");
                    self.uninstall_receipt(&app.app_id, receipt).await
                }
                None => self.simulated.uninstall(app).await,
            }
        })
    }

    fn shortcut(&self, app_id: &str) -> Option<std::path::PathBuf> {
        match self.receipts.load(app_id).ok().flatten()? {
            Receipt::PortableZip { shortcut, .. } | Receipt::PortableExe { shortcut, .. } => {
                shortcut.filter(|path| path.is_file())
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests;
