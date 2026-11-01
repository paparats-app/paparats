//! Which strategy serves each service: the real inventory, installer and catalog (the default,
//! [`RealFlags::RELEASE`]), the simulated demo world (`--demo`) or, per `PAPARATS_REAL` flag
//! ([`crate::flags`]), any mix including real sign-in.
//! A real strategy that cannot be set up (no pinned catalog key, no Credential Manager) is logged
//! and replaced by its simulated counterpart, so the app always starts; [`Strategies::flags`]
//! then tells what actually runs.

use std::path::PathBuf;
use std::sync::Arc;

use paparats_account::Auth;
use paparats_catalog::{CatalogBackend, CatalogSource, EmbeddedCatalog};
use paparats_core::InstallStrategy;
use paparats_download::{
    DownloadError, HttpTransfer, HttpTransferConfig, Job, ProgressFn, SimulatedTransfer, Transfer,
    TransferOutput,
};
use paparats_install::{BoxFuture, Gate, Installer, SimulatedInstaller, StrictTrust};
use paparats_inventory::Inventory;
use paparats_storage::Storage;

use crate::error::AppResult;
use crate::flags::{CatalogEnv, RealFlags};

/// Opens a URL in the user's browser (the OAuth authorization page).
pub trait Browser: Send + Sync + 'static {
    fn open(&self, url: &str) -> Result<(), String>;
}

/// A browser that opens nothing (tests).
#[cfg(test)]
#[derive(Debug, Default, Clone, Copy)]
pub struct NoBrowser;

#[cfg(test)]
impl Browser for NoBrowser {
    fn open(&self, _url: &str) -> Result<(), String> {
        Err("no browser in this environment".into())
    }
}

/// What the app runs on.
pub struct Strategies {
    /// The real strategies actually running (a flag whose strategy failed to start is off).
    pub flags: RealFlags,
    pub catalog: CatalogBackend,
    pub inventory: Arc<dyn Inventory>,
    pub installer: Arc<dyn Installer>,
    pub transfer: Arc<dyn Transfer>,
    pub auth: Auth,
    pub browser: Arc<dyn Browser>,
}

impl std::fmt::Debug for Strategies {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Strategies")
            .field("flags", &self.flags)
            .finish_non_exhaustive()
    }
}

/// Where real strategies keep their files.
#[derive(Debug, Clone)]
pub struct RealPaths {
    /// Partial and verified downloads (`app_local_data_dir()/downloads`).
    pub downloads: PathBuf,
}

impl Strategies {
    /// The mock world with the given transfer and installer (tests: faster timings, fixed
    /// randomness). The app builds the same world through [`Strategies::from_flags`] with no flag.
    #[cfg(test)]
    pub fn simulated(
        storage: &Arc<Storage>,
        transfer: Arc<dyn Transfer>,
        installer: Arc<dyn Installer>,
    ) -> AppResult<Self> {
        Ok(Self {
            flags: RealFlags::default(),
            catalog: CatalogBackend::Embedded(Arc::new(EmbeddedCatalog::load()?)),
            inventory: Arc::new(paparats_inventory::StoredInventory::new(Arc::clone(
                storage,
            ))),
            installer,
            transfer,
            auth: Auth::Simulated,
            browser: Arc::new(NoBrowser),
        })
    }

    /// The strategies `flags` asks for (everything simulated when no flag is set: the demo
    /// world).
    pub fn from_flags(
        flags: RealFlags,
        catalog_env: &CatalogEnv,
        storage: &Arc<Storage>,
        paths: &RealPaths,
        browser: Arc<dyn Browser>,
    ) -> AppResult<Self> {
        let mut running = flags;

        // Downloads use the same proxy rule as the catalog (none for a loopback development CDN).
        let mut use_env_proxy = true;
        let catalog = if flags.catalog {
            let remote = catalog_env.remote_config().and_then(|config| {
                use_env_proxy = config.use_env_proxy;
                paparats_catalog::from_flags(true, Arc::clone(storage), config)
            });
            match remote {
                Ok(backend) => backend,
                Err(e) => {
                    tracing::error!(error = %e, "PAPARATS_REAL=catalog: the remote catalog cannot start; using the embedded catalog");
                    running.catalog = false;
                    CatalogBackend::Embedded(Arc::new(EmbeddedCatalog::load()?))
                }
            }
        } else {
            CatalogBackend::Embedded(Arc::new(EmbeddedCatalog::load()?))
        };

        // The remote catalog may have nothing cached yet: the inventory learns the apps after
        // the first refresh (`Inventory::set_catalog`).
        let apps = catalog.catalog().map(|c| c.apps).unwrap_or_default();
        let inventory = paparats_inventory::from_flags(flags.inventory, Arc::clone(storage), &apps);

        // No UI accepts unsigned binaries yet, so every EXE/MSI must carry a trusted signature.
        let installer = match paparats_install::from_flags(flags.install, Arc::new(StrictTrust)) {
            Ok(installer) => installer,
            Err(e) => {
                tracing::error!(error = %e, "PAPARATS_REAL=install: the installer cannot start; installs stay simulated");
                running.install = false;
                Arc::new(SimulatedInstaller::new())
            }
        };

        let http = match catalog.remote() {
            Some(remote) => match HttpTransfer::new(HttpTransferConfig {
                work_dir: paths.downloads.clone(),
                allowlist: remote.allowlist(),
                use_env_proxy,
            }) {
                Ok(http) => Some(http),
                Err(e) => {
                    tracing::error!(error = %e, "real downloads cannot start; downloads stay simulated");
                    None
                }
            },
            None => None,
        };
        let transfer: Arc<dyn Transfer> = Arc::new(RoutedTransfer {
            simulated: Arc::new(SimulatedTransfer::new()),
            http,
        });

        let auth = match paparats_account::from_flags(flags.account, Arc::clone(storage)) {
            Ok(auth) => auth,
            Err(e) => {
                tracing::error!(error = %e, "PAPARATS_REAL=account: real sign-in cannot start; sign-in stays simulated");
                running.account = false;
                Auth::Simulated
            }
        };

        Ok(Self {
            flags: running,
            catalog,
            inventory,
            installer,
            transfer,
            auth,
            browser,
        })
    }
}

/// Moves simulated packages with the simulated transfer and packages from a verified manifest
/// (a URL and a real strategy) over HTTP.
pub struct RoutedTransfer {
    pub simulated: Arc<dyn Transfer>,
    /// `None` without the remote catalog: then no job carries a real package.
    pub http: Option<HttpTransfer>,
}

impl RoutedTransfer {
    fn is_real(job: &Job) -> bool {
        job.package.url.is_some() && job.package.strategy != InstallStrategy::Simulated
    }
}

impl Transfer for RoutedTransfer {
    fn run<'a>(
        &'a self,
        job: &'a Job,
        gate: &'a mut Gate,
        progress: ProgressFn<'a>,
    ) -> BoxFuture<'a, Result<TransferOutput, DownloadError>> {
        if !Self::is_real(job) {
            return self.simulated.run(job, gate, progress);
        }
        match &self.http {
            Some(http) => http.run(job, gate, progress),
            None => Box::pin(async {
                Err(DownloadError::Network(
                    "real downloads are not available".into(),
                ))
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use paparats_core::{DownloadKind, DownloadRequest, Package};
    use paparats_install::{GateState, gate};

    use super::*;

    #[derive(Default)]
    struct Counting(AtomicUsize);

    impl Transfer for Counting {
        fn run<'a>(
            &'a self,
            _job: &'a Job,
            _gate: &'a mut Gate,
            _progress: ProgressFn<'a>,
        ) -> BoxFuture<'a, Result<TransferOutput, DownloadError>> {
            self.0.fetch_add(1, Ordering::Relaxed);
            Box::pin(async { Ok(TransferOutput::default()) })
        }
    }

    fn request(app: &str) -> DownloadRequest {
        DownloadRequest {
            app_id: app.into(),
            version: "1.0".into(),
            size_mb: 1.0,
            kind: DownloadKind::Install,
        }
    }

    #[tokio::test]
    async fn simulated_packages_never_touch_the_network() {
        let counting = Arc::new(Counting::default());
        let routed = RoutedTransfer {
            simulated: Arc::clone(&counting) as Arc<dyn Transfer>,
            http: None,
        };
        let (_ctl, mut g) = gate(GateState::OPEN);
        let progress = |_| {};
        routed
            .run(&Job::simulated(request("vlc")), &mut g, &progress)
            .await
            .unwrap();
        assert_eq!(counting.0.load(Ordering::Relaxed), 1);

        // A real package without an HTTP transfer (no remote catalog) fails instead of faking it.
        let real = Job {
            request: request("tool"),
            package: Package {
                url: Some("https://downloads.example.org/tool.zip".into()),
                sha256: Some("ab".repeat(32)),
                strategy: InstallStrategy::PortableZip,
                ..Package::simulated("tool", "1.0", 1.0)
            },
        };
        assert!(matches!(
            routed.run(&real, &mut g, &progress).await,
            Err(DownloadError::Network(_))
        ));
        assert_eq!(counting.0.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn no_flags_is_the_mock_world() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        storage.seed_from_fixtures().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let paths = RealPaths {
            downloads: dir.path().join("downloads"),
        };
        let s = Strategies::from_flags(
            RealFlags::default(),
            &CatalogEnv::default(),
            &storage,
            &paths,
            Arc::new(NoBrowser),
        )
        .unwrap();
        assert!(s.flags.is_simulated());
        assert!(!s.catalog.is_remote());
        assert!(!s.auth.is_real());
        assert_eq!(s.inventory.installed().unwrap().len(), 14);
        assert!(!paths.downloads.exists(), "nothing written");
    }

    #[test]
    fn a_catalog_with_bad_keys_falls_back_to_the_embedded_one() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let dir = tempfile::tempdir().unwrap();
        let flags = RealFlags {
            catalog: true,
            ..RealFlags::default()
        };
        let broken = CatalogEnv {
            base_url: None,
            keys: Some("dev:???".into()),
        };
        let s = Strategies::from_flags(
            flags,
            &broken,
            &storage,
            &RealPaths {
                downloads: dir.path().to_path_buf(),
            },
            Arc::new(NoBrowser),
        )
        .unwrap();
        assert!(!s.flags.catalog, "the remote catalog could not start");
        assert!(!s.catalog.is_remote());
        assert_eq!(s.catalog.catalog().unwrap().apps.len(), 32);
    }

    #[test]
    fn the_release_flags_run_the_remote_catalog() {
        let storage = Arc::new(Storage::open_in_memory().unwrap());
        let dir = tempfile::tempdir().unwrap();
        let s = Strategies::from_flags(
            RealFlags::RELEASE,
            &CatalogEnv::default(),
            &storage,
            &RealPaths {
                downloads: dir.path().to_path_buf(),
            },
            Arc::new(NoBrowser),
        )
        .unwrap();
        assert!(s.flags.catalog, "the pinned keys start the remote catalog");
        assert!(s.catalog.is_remote());
        assert!(!s.auth.is_real());
    }
}
