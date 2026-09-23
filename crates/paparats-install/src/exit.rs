//! Installer exit codes → outcomes.

use crate::InstallError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitOutcome {
    Success,
    /// Installed; Windows must restart to finish (3010), or the installer started a restart
    /// (1641 — `/norestart` should prevent it).
    SuccessRebootRequired,
    /// The installer says the user cancelled it (1602 / `ERROR_CANCELLED`).
    Cancelled,
    /// Another installation is in progress (1618).
    Busy,
    Failed(i32),
}

const ERROR_SUCCESS_REBOOT_INITIATED: i32 = 1641;
const ERROR_SUCCESS_REBOOT_REQUIRED: i32 = 3010;
const ERROR_INSTALL_USEREXIT: i32 = 1602;
const ERROR_INSTALL_ALREADY_RUNNING: i32 = 1618;
const ERROR_UNKNOWN_PRODUCT: i32 = 1605;
const ERROR_CANCELLED: i32 = 1223;

/// `msiexec /i` exit codes (Windows Installer error codes).
pub fn msi(code: i32) -> ExitOutcome {
    match code {
        0 => ExitOutcome::Success,
        ERROR_SUCCESS_REBOOT_INITIATED | ERROR_SUCCESS_REBOOT_REQUIRED => {
            ExitOutcome::SuccessRebootRequired
        }
        ERROR_INSTALL_USEREXIT => ExitOutcome::Cancelled,
        ERROR_INSTALL_ALREADY_RUNNING => ExitOutcome::Busy,
        other => ExitOutcome::Failed(other),
    }
}

/// `msiexec /x` exit codes: a product that is already gone (1605) counts as removed.
pub fn msi_uninstall(code: i32) -> ExitOutcome {
    match code {
        ERROR_UNKNOWN_PRODUCT => ExitOutcome::Success,
        other => msi(other),
    }
}

/// EXE installers. Only the conventions shared by Inno Setup, NSIS and MSI wrappers are mapped:
/// 0 = success, 3010/1641 = success with a restart pending, 1602/1223 = cancelled, 1618 = busy;
/// any other code (Inno's 1–8, NSIS's 1–2, …) is a failure.
pub fn exe(code: i32) -> ExitOutcome {
    match code {
        ERROR_CANCELLED => ExitOutcome::Cancelled,
        other => msi(other),
    }
}

impl ExitOutcome {
    pub fn into_result(self) -> Result<(), InstallError> {
        match self {
            Self::Success | Self::SuccessRebootRequired => Ok(()),
            Self::Cancelled => Err(InstallError::InstallerCancelled),
            Self::Busy => Err(InstallError::Busy),
            Self::Failed(code) => Err(InstallError::ExitCode(code)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn msi_codes() {
        assert_eq!(msi(0), ExitOutcome::Success);
        assert_eq!(msi(3010), ExitOutcome::SuccessRebootRequired);
        assert_eq!(msi(1641), ExitOutcome::SuccessRebootRequired);
        assert_eq!(msi(1602), ExitOutcome::Cancelled);
        assert_eq!(msi(1618), ExitOutcome::Busy);
        assert_eq!(msi(1603), ExitOutcome::Failed(1603));
        assert_eq!(msi(1605), ExitOutcome::Failed(1605));
        assert_eq!(msi_uninstall(1605), ExitOutcome::Success);
        assert_eq!(msi_uninstall(1602), ExitOutcome::Cancelled);
    }

    #[test]
    fn exe_codes() {
        assert_eq!(exe(0), ExitOutcome::Success);
        assert_eq!(exe(3010), ExitOutcome::SuccessRebootRequired);
        assert_eq!(exe(1223), ExitOutcome::Cancelled);
        assert_eq!(exe(1602), ExitOutcome::Cancelled);
        // Inno "setup failed to initialize" / NSIS "cancelled by the user": plain failures.
        assert_eq!(exe(1), ExitOutcome::Failed(1));
        assert_eq!(exe(-1_073_741_819), ExitOutcome::Failed(-1_073_741_819));
    }

    #[test]
    fn outcomes_map_to_install_errors() {
        assert!(ExitOutcome::Success.into_result().is_ok());
        assert!(ExitOutcome::SuccessRebootRequired.into_result().is_ok());
        // Not `InstallError::Cancelled`: the queue would treat that as its own cancel and never
        // settle the item.
        assert!(matches!(
            ExitOutcome::Cancelled.into_result(),
            Err(InstallError::InstallerCancelled)
        ));
        assert!(matches!(
            ExitOutcome::Busy.into_result(),
            Err(InstallError::Busy)
        ));
        assert!(matches!(
            ExitOutcome::Failed(1603).into_result(),
            Err(InstallError::ExitCode(1603))
        ));
    }
}
