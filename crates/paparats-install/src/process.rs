//! Running installer processes: an explicit program path and argument vector through
//! `std::process::Command` (never a shell), no console window, no inherited stdio, a timeout;
//! or, for an explicit machine-wide install, the same vector elevated through UAC.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use crate::{InstallError, args, sys};

/// `ERROR_ELEVATION_REQUIRED`: the program's manifest demands administrator rights.
const ERROR_ELEVATION_REQUIRED: i32 = 740;
/// `CREATE_NO_WINDOW`: console installers get no console window.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// One installer run.
#[derive(Debug, Clone)]
pub struct Run {
    pub program: PathBuf,
    pub args: Vec<OsString>,
    /// Working directory (the package's folder for EXE installers).
    pub dir: Option<PathBuf>,
    pub timeout: Duration,
    /// Run through the UAC prompt (explicit machine-wide installs only).
    pub elevate: bool,
}

/// Builds the command without running it (the vector is exactly `run.args`).
pub fn command(run: &Run) -> Command {
    let mut cmd = Command::new(&run.program);
    cmd.args(&run.args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(dir) = &run.dir {
        cmd.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Runs the installer to completion and returns its exit code. A timed-out installer is killed
/// (its own process; children it spawned are not tracked).
pub async fn run(run: Run) -> Result<i32, InstallError> {
    if run.elevate {
        let params = args::join_windows_args(&run.args)?;
        return tokio::task::spawn_blocking(move || {
            sys::run_elevated(&run.program, &params, run.dir.as_deref(), run.timeout)
        })
        .await?;
    }
    let mut child = tokio::process::Command::from(command(&run))
        .kill_on_drop(false)
        .spawn()
        .map_err(|e| match e.raw_os_error() {
            Some(ERROR_ELEVATION_REQUIRED) => InstallError::NeedsMachineWide,
            _ => InstallError::Io(e),
        })?;
    match tokio::time::timeout(run.timeout, child.wait()).await {
        Ok(status) => Ok(status?.code().unwrap_or(-1)),
        Err(_) => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            Err(InstallError::TimedOut)
        }
    }
}

/// The folder a file lives in (installers run there).
pub fn parent_dir(file: &Path) -> Option<PathBuf> {
    file.parent()
        .filter(|p| !p.as_os_str().is_empty())
        .map(Path::to_path_buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_command_is_the_vector() {
        let run = Run {
            program: PathBuf::from(r"C:\dl\setup.exe"),
            args: vec!["/VERYSILENT".into(), "/DIR=C:\\A & B".into()],
            dir: Some(PathBuf::from(r"C:\dl")),
            timeout: Duration::from_secs(1),
            elevate: false,
        };
        let cmd = command(&run);
        assert_eq!(cmd.get_program(), r"C:\dl\setup.exe");
        let args: Vec<_> = cmd.get_args().collect();
        assert_eq!(args, ["/VERYSILENT", "/DIR=C:\\A & B"]);
        assert_eq!(cmd.get_current_dir(), Some(Path::new(r"C:\dl")));
        assert_eq!(parent_dir(Path::new("setup.exe")), None);
    }

    #[cfg(windows)]
    fn system32(exe: &str) -> PathBuf {
        crate::sys::known_folder(crate::sys::KnownFolder::System)
            .unwrap()
            .join(exe)
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn exit_codes_come_back() {
        // `where /q <missing>` exits with 1, `where /q where` with 0: harmless system programs.
        let base = Run {
            program: system32("where.exe"),
            args: vec!["/q".into(), "paparats-no-such-program".into()],
            dir: None,
            timeout: Duration::from_secs(30),
            elevate: false,
        };
        assert_eq!(run(base.clone()).await.unwrap(), 1);
        let found = Run {
            args: vec!["/q".into(), "where".into()],
            ..base
        };
        assert_eq!(run(found).await.unwrap(), 0);
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn a_hung_installer_times_out() {
        let slow = Run {
            program: system32("PING.EXE"),
            args: vec!["-n".into(), "30".into(), "127.0.0.1".into()],
            dir: None,
            timeout: Duration::from_millis(300),
            elevate: false,
        };
        let started = std::time::Instant::now();
        assert!(matches!(run(slow).await, Err(InstallError::TimedOut)));
        assert!(started.elapsed() < Duration::from_secs(10));
    }

    #[tokio::test]
    async fn a_missing_program_is_an_io_error() {
        let run_missing = Run {
            program: PathBuf::from("paparats-no-such-installer.exe"),
            args: vec![],
            dir: None,
            timeout: Duration::from_secs(5),
            elevate: false,
        };
        assert!(matches!(run(run_missing).await, Err(InstallError::Io(_))));
    }
}
