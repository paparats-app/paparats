//! Windows API calls (`windows` 0.62). This file is the crate's only `unsafe` code
//! (`#[allow(unsafe_code)]` on `mod sys` in `lib.rs`); every block states why it is sound.
//! Strings handed to Windows are NUL-terminated UTF-16 buffers that outlive the call, every
//! handle is owned by exactly one guard, and nothing borrowed from Windows outlives its owner.

use std::ffi::{OsStr, OsString};
use std::fs::File;
use std::marker::PhantomData;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::os::windows::io::AsRawHandle;
use std::path::{Path, PathBuf};
use std::ptr;
use std::time::Duration;

use windows::Foundation::Uri;
use windows::Management::Deployment::{DeploymentOptions, DeploymentResult, PackageManager};
use windows::Win32::Foundation::{
    ERROR_CANCELLED, HANDLE, HWND, INVALID_HANDLE_VALUE, RPC_E_CHANGED_MODE, WAIT_OBJECT_0,
    WAIT_TIMEOUT,
};
use windows::Win32::Security::Cryptography::Catalog::{
    CATALOG_INFO, CryptCATAdminAcquireContext2, CryptCATAdminCalcHashFromFileHandle2,
    CryptCATAdminEnumCatalogFromHash, CryptCATAdminReleaseCatalogContext,
    CryptCATAdminReleaseContext, CryptCATCatalogInfoFromContext,
};
use windows::Win32::Security::Cryptography::{
    CERT_CONTEXT, CERT_NAME_ISSUER_FLAG, CERT_NAME_SIMPLE_DISPLAY_TYPE, CERT_NAME_STR_REVERSE_FLAG,
    CERT_STRING_TYPE, CERT_X500_NAME_STR, CertGetNameStringW, CertNameToStrW, X509_ASN_ENCODING,
};
use windows::Win32::Security::WinTrust::{
    WINTRUST_ACTION_GENERIC_VERIFY_V2, WINTRUST_CATALOG_INFO, WINTRUST_DATA,
    WINTRUST_DATA_UNION_CHOICE, WINTRUST_FILE_INFO, WTD_CHOICE_CATALOG, WTD_CHOICE_FILE,
    WTD_REVOCATION_CHECK_CHAIN, WTD_REVOKE_WHOLECHAIN, WTD_STATEACTION_CLOSE,
    WTD_STATEACTION_VERIFY, WTD_UI_NONE, WTHelperGetProvSignerFromChain,
    WTHelperProvDataFromStateData, WinVerifyTrust,
};
use windows::Win32::System::ApplicationInstallationAndServicing::{
    MSIDBOPEN_READONLY, MSIHANDLE, MsiDatabaseOpenViewW, MsiGetSummaryInformationW,
    MsiOpenDatabaseW, MsiRecordGetStringW, MsiSummaryInfoGetPropertyW, MsiViewExecute,
    MsiViewFetch,
};
use windows::Win32::System::Com::{
    CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE, CoCreateInstance,
    CoInitializeEx, CoTaskMemFree, CoUninitialize, IPersistFile,
};
use windows::Win32::System::Threading::{
    GetExitCodeProcess, TerminateProcess, WaitForSingleObject,
};
use windows::Win32::UI::Shell::{
    FOLDERID_LocalAppData, FOLDERID_Programs, FOLDERID_System, IShellLinkW, KF_FLAG_DEFAULT,
    SEE_MASK_FLAG_NO_UI, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    SHGetKnownFolderPath, ShellExecuteExW, ShellLink,
};
use windows::core::{GUID, HRESULT, HSTRING, Interface, Owned, PCWSTR, PWSTR, w};
use windows_collections::IIterable;

use super::{KnownFolder, MsiInfo};
use crate::InstallError;
use crate::authenticode::{AuthenticodeError, SignatureSource, SignerInfo, Verdict, classify};

// ---------------------------------------------------------------------------------------------
// Helpers

/// NUL-terminated UTF-16.
fn wide(s: &OsStr) -> Vec<u16> {
    s.encode_wide().chain(std::iter::once(0)).collect()
}

/// UTF-16 up to the first NUL.
fn from_wide(buf: &[u16]) -> String {
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}

fn describe(e: &windows::core::Error) -> String {
    format!("{:#010x} {}", e.code().0, e.message())
}

fn system(e: windows::core::Error) -> InstallError {
    InstallError::System(describe(&e))
}

fn auth_system(e: windows::core::Error) -> AuthenticodeError {
    AuthenticodeError::System(describe(&e))
}

// ---------------------------------------------------------------------------------------------
// Known folders

pub(crate) fn known_folder(folder: KnownFolder) -> Result<PathBuf, InstallError> {
    let id: GUID = match folder {
        KnownFolder::LocalAppData => FOLDERID_LocalAppData,
        KnownFolder::Programs => FOLDERID_Programs,
        KnownFolder::System => FOLDERID_System,
    };
    // SAFETY: `id` is a valid KNOWNFOLDERID and no token is passed (current user). On success the
    // result is a NUL-terminated CoTaskMemAlloc string: it is copied into an owned path, then
    // freed exactly once; it is not used after the free.
    unsafe {
        let raw: PWSTR = SHGetKnownFolderPath(&id, KF_FLAG_DEFAULT, None).map_err(system)?;
        let path = PathBuf::from(OsString::from_wide(raw.as_wide()));
        CoTaskMemFree(Some(raw.0 as *const _));
        Ok(path)
    }
}

// ---------------------------------------------------------------------------------------------
// Authenticode

pub(crate) fn verify_trust(file: &File, path: &Path) -> Result<SignerInfo, AuthenticodeError> {
    let path = wide(path.as_os_str());
    let handle = HANDLE(file.as_raw_handle());
    match verify_embedded(handle, &path) {
        Err(AuthenticodeError::Unsigned) => verify_catalog(handle, &path),
        other => other,
    }
}

fn trust_data(choice: WINTRUST_DATA_UNION_CHOICE) -> WINTRUST_DATA {
    WINTRUST_DATA {
        cbStruct: size_of::<WINTRUST_DATA>() as u32,
        dwUIChoice: WTD_UI_NONE,
        fdwRevocationChecks: WTD_REVOKE_WHOLECHAIN,
        dwUnionChoice: choice,
        dwStateAction: WTD_STATEACTION_VERIFY,
        dwProvFlags: WTD_REVOCATION_CHECK_CHAIN,
        ..Default::default()
    }
}

fn verify_embedded(handle: HANDLE, path: &[u16]) -> Result<SignerInfo, AuthenticodeError> {
    let mut file_info = WINTRUST_FILE_INFO {
        cbStruct: size_of::<WINTRUST_FILE_INFO>() as u32,
        pcwszFilePath: PCWSTR(path.as_ptr()),
        hFile: handle,
        pgKnownSubject: ptr::null_mut(),
    };
    let mut data = trust_data(WTD_CHOICE_FILE);
    data.Anonymous.pFile = &mut file_info;
    run_trust(&mut data, SignatureSource::Embedded)
}

/// `CryptCATAdmin*` context, released on drop.
struct CatAdmin(isize);

impl Drop for CatAdmin {
    fn drop(&mut self) {
        // SAFETY: the context came from a successful CryptCATAdminAcquireContext2 and is released
        // once, after every catalog context taken from it (`CatInfo` is dropped first).
        unsafe {
            let _ = CryptCATAdminReleaseContext(self.0, 0);
        }
    }
}

/// A catalog context found for a hash, released on drop.
struct CatInfo<'a> {
    admin: &'a CatAdmin,
    info: isize,
}

impl Drop for CatInfo<'_> {
    fn drop(&mut self) {
        // SAFETY: `info` came from CryptCATAdminEnumCatalogFromHash on `admin`, which outlives it
        // (borrowed), and is released once.
        unsafe {
            let _ = CryptCATAdminReleaseCatalogContext(self.admin.0, self.info, 0);
        }
    }
}

fn hex_upper(bytes: &[u8]) -> String {
    use std::fmt::Write;
    bytes.iter().fold(String::new(), |mut s, b| {
        let _ = write!(s, "{b:02X}");
        s
    })
}

/// Looks the file's hash up in the system catalogs (SHA-256 first, then SHA-1 for older
/// catalogs) and verifies the catalog that lists it.
fn verify_catalog(handle: HANDLE, path: &[u16]) -> Result<SignerInfo, AuthenticodeError> {
    for algorithm in [w!("SHA256"), w!("SHA1")] {
        let mut raw_admin: isize = 0;
        // SAFETY: out-pointer to a local; the algorithm is a static NUL-terminated string; no
        // subsystem GUID (the default system catalogs) and no strong-signature policy.
        if unsafe { CryptCATAdminAcquireContext2(&mut raw_admin, None, algorithm, None, None) }
            .is_err()
        {
            continue;
        }
        let admin = CatAdmin(raw_admin);

        let mut hash = [0u8; 64];
        let mut len = hash.len() as u32;
        // SAFETY: `handle` is an open, readable file handle (borrowed from a live `File`);
        // `hash` has room for `len` bytes and `len` is updated to the bytes written.
        let hashed = unsafe {
            CryptCATAdminCalcHashFromFileHandle2(
                admin.0,
                handle,
                &mut len,
                Some(hash.as_mut_ptr()),
                None,
            )
        };
        if hashed.is_err() {
            continue;
        }
        let mut digest = hash[..(len as usize).min(hash.len())].to_vec();

        // SAFETY: valid admin context; `digest` is initialised; no previous catalog to continue.
        let raw_info = unsafe { CryptCATAdminEnumCatalogFromHash(admin.0, &digest, None, None) };
        if raw_info == 0 {
            continue;
        }
        let info = CatInfo {
            admin: &admin,
            info: raw_info,
        };
        let mut catalog = CATALOG_INFO {
            cbStruct: size_of::<CATALOG_INFO>() as u32,
            ..Default::default()
        };
        // SAFETY: valid catalog context; `catalog` is a correctly sized out-structure.
        unsafe { CryptCATCatalogInfoFromContext(info.info, &mut catalog, 0) }
            .map_err(auth_system)?;

        let tag: Vec<u16> = hex_upper(&digest)
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let mut catalog_info = WINTRUST_CATALOG_INFO {
            cbStruct: size_of::<WINTRUST_CATALOG_INFO>() as u32,
            dwCatalogVersion: 0,
            pcwszCatalogFilePath: PCWSTR(catalog.wszCatalogFile.as_ptr()),
            pcwszMemberTag: PCWSTR(tag.as_ptr()),
            pcwszMemberFilePath: PCWSTR(path.as_ptr()),
            hMemberFile: handle,
            pbCalculatedFileHash: digest.as_mut_ptr(),
            cbCalculatedFileHash: digest.len() as u32,
            pcCatalogContext: ptr::null_mut(),
            hCatAdmin: admin.0,
        };
        let mut data = trust_data(WTD_CHOICE_CATALOG);
        data.Anonymous.pCatalog = &mut catalog_info;
        let result = run_trust(&mut data, SignatureSource::Catalog);
        drop(info);
        return result;
    }
    Err(AuthenticodeError::Unsigned)
}

/// Runs WinVerifyTrust (VERIFY), reads the signer on success, and always closes the state.
fn run_trust(
    data: &mut WINTRUST_DATA,
    source: SignatureSource,
) -> Result<SignerInfo, AuthenticodeError> {
    let mut action = WINTRUST_ACTION_GENERIC_VERIFY_V2;
    // INVALID_HANDLE_VALUE as the window: no interactive user, never any UI.
    let no_ui = HWND(INVALID_HANDLE_VALUE.0);
    // SAFETY: `data` is fully initialised (cbStruct, no UI, union choice matching the union
    // member) and its member points at a FILE/CATALOG info whose strings, buffers and file
    // handle the caller keeps alive across this call and the CLOSE call below.
    let status = unsafe { WinVerifyTrust(no_ui, &mut action, (data as *mut WINTRUST_DATA).cast()) };
    let result = match classify(status) {
        Verdict::Trusted => signer_from_state(data.hWVTStateData, source),
        Verdict::Unsigned => Err(AuthenticodeError::Unsigned),
        Verdict::Untrusted(failure) => Err(AuthenticodeError::Untrusted(failure)),
    };
    data.dwStateAction = WTD_STATEACTION_CLOSE;
    // SAFETY: the same `data`; CLOSE frees the state VERIFY allocated (a no-op without one).
    // `result` holds only owned strings, nothing that points into the freed state.
    unsafe {
        WinVerifyTrust(no_ui, &mut action, (data as *mut WINTRUST_DATA).cast());
    }
    result
}

fn signer_from_state(
    state: HANDLE,
    source: SignatureSource,
) -> Result<SignerInfo, AuthenticodeError> {
    let missing = || AuthenticodeError::System("the verified signature has no signer".into());
    // SAFETY: `state` is the live hWVTStateData of a successful VERIFY call; the caller closes it
    // only after this function returns. The helpers return pointers into that state or null;
    // every pointer is checked for null before it is dereferenced, and the certificate context
    // is only borrowed for the name lookups below.
    let cert: &CERT_CONTEXT = unsafe {
        let provider = WTHelperProvDataFromStateData(state);
        if provider.is_null() {
            return Err(missing());
        }
        let signer = WTHelperGetProvSignerFromChain(provider, 0, false, 0);
        if signer.is_null() || (*signer).csCertChain == 0 || (*signer).pasCertChain.is_null() {
            return Err(missing());
        }
        let leaf = (*signer).pasCertChain;
        let cert = (*leaf).pCert;
        if cert.is_null() || (*cert).pCertInfo.is_null() {
            return Err(missing());
        }
        &*cert
    };
    Ok(SignerInfo {
        subject: subject_name(cert),
        common_name: display_name(cert, 0),
        issuer: display_name(cert, CERT_NAME_ISSUER_FLAG),
        source,
    })
}

/// The simple display name (CN) of the subject, or of the issuer with `CERT_NAME_ISSUER_FLAG`.
fn display_name(cert: &CERT_CONTEXT, flags: u32) -> String {
    // SAFETY: `cert` is a valid certificate context; without a buffer the call returns the
    // length in UTF-16 units including the NUL.
    let len = unsafe { CertGetNameStringW(cert, CERT_NAME_SIMPLE_DISPLAY_TYPE, flags, None, None) };
    if len <= 1 {
        return String::new();
    }
    let mut buf = vec![0u16; len as usize];
    // SAFETY: as above, with a buffer of exactly the requested length.
    let written = unsafe {
        CertGetNameStringW(
            cert,
            CERT_NAME_SIMPLE_DISPLAY_TYPE,
            flags,
            None,
            Some(&mut buf),
        )
    };
    from_wide(&buf[..(written as usize).min(buf.len())])
}

/// The full subject, most specific RDN first (`CN=…, O=…, C=…`).
fn subject_name(cert: &CERT_CONTEXT) -> String {
    let kind = CERT_STRING_TYPE(CERT_X500_NAME_STR.0 | CERT_NAME_STR_REVERSE_FLAG);
    // SAFETY: `pCertInfo` of a valid context was checked non-null by the caller and holds the
    // encoded subject name blob.
    let blob = unsafe { &(*cert.pCertInfo).Subject };
    // SAFETY: valid encoded name; without a buffer the call returns the length incl. the NUL.
    let len = unsafe { CertNameToStrW(X509_ASN_ENCODING, blob, kind, None) };
    if len <= 1 {
        return String::new();
    }
    let mut buf = vec![0u16; len as usize];
    // SAFETY: as above, with a buffer of exactly the requested length.
    let written = unsafe { CertNameToStrW(X509_ASN_ENCODING, blob, kind, Some(&mut buf)) };
    from_wide(&buf[..(written as usize).min(buf.len())])
}

// ---------------------------------------------------------------------------------------------
// MSI database

const PID_WORDCOUNT: u32 = 15;
const VT_I4: u32 = 3;
/// Word Count bit 3: "elevated privileges are not required to install this package".
const WORDCOUNT_NO_ELEVATION: i32 = 8;
const ERROR_SUCCESS: u32 = 0;
const ERROR_MORE_DATA: u32 = 234;
const ERROR_NO_MORE_ITEMS: u32 = 259;

fn owned_msi(handle: MSIHANDLE) -> Owned<MSIHANDLE> {
    // SAFETY: called only with a handle an MSI API just returned to us; `Owned` closes it once.
    unsafe { Owned::new(handle) }
}

pub(crate) fn msi_info(path: &Path) -> Result<MsiInfo, InstallError> {
    let path = wide(path.as_os_str());
    let mut raw = MSIHANDLE::default();
    // SAFETY: NUL-terminated path; read-only persist mode; out-pointer to a local.
    let rc = unsafe { MsiOpenDatabaseW(PCWSTR(path.as_ptr()), MSIDBOPEN_READONLY, &mut raw) };
    if rc != ERROR_SUCCESS {
        return Err(InstallError::invalid(format!(
            "not a readable MSI package (error {rc})"
        )));
    }
    let db = owned_msi(raw);
    let per_user_capable = word_count(*db).is_some_and(|wc| wc & WORDCOUNT_NO_ELEVATION != 0);
    let product_code = product_code(*db)?;
    Ok(MsiInfo {
        product_code,
        per_user_capable,
    })
}

fn word_count(db: MSIHANDLE) -> Option<i32> {
    let mut raw = MSIHANDLE::default();
    // SAFETY: valid database handle; no path; out-pointer to a local.
    let rc = unsafe { MsiGetSummaryInformationW(db, PCWSTR::null(), 0, &mut raw) };
    if rc != ERROR_SUCCESS {
        return None;
    }
    let summary = owned_msi(raw);
    let (mut kind, mut value) = (0u32, 0i32);
    // SAFETY: valid summary handle; integer out-pointers to locals; no FILETIME and no string
    // buffer requested.
    let rc = unsafe {
        MsiSummaryInfoGetPropertyW(
            *summary,
            PID_WORDCOUNT,
            &mut kind,
            &mut value,
            None,
            None,
            None,
        )
    };
    (rc == ERROR_SUCCESS && kind == VT_I4).then_some(value)
}

fn product_code(db: MSIHANDLE) -> Result<String, InstallError> {
    let fail =
        |step: &str, rc: u32| InstallError::invalid(format!("MSI {step} failed (error {rc})"));
    let query = w!("SELECT `Value` FROM `Property` WHERE `Property` = 'ProductCode'");
    let mut raw_view = MSIHANDLE::default();
    // SAFETY: valid database handle; static NUL-terminated query; out-pointer to a local.
    let rc = unsafe { MsiDatabaseOpenViewW(db, query, &mut raw_view) };
    if rc != ERROR_SUCCESS {
        return Err(fail("query", rc));
    }
    let view = owned_msi(raw_view);
    // SAFETY: valid view handle; the query has no parameters (null record).
    let rc = unsafe { MsiViewExecute(*view, MSIHANDLE::default()) };
    if rc != ERROR_SUCCESS {
        return Err(fail("query", rc));
    }
    let mut raw_record = MSIHANDLE::default();
    // SAFETY: executed view; out-pointer to a local.
    let rc = unsafe { MsiViewFetch(*view, &mut raw_record) };
    if rc == ERROR_NO_MORE_ITEMS {
        return Err(InstallError::invalid("the MSI package has no ProductCode"));
    }
    if rc != ERROR_SUCCESS {
        return Err(fail("fetch", rc));
    }
    let record = owned_msi(raw_record);
    let mut len = 0u32;
    // SAFETY: valid record; field 1 exists (one selected column); without a buffer the call
    // stores the length (without the NUL) in `len`.
    let rc = unsafe { MsiRecordGetStringW(*record, 1, None, Some(&mut len)) };
    if rc != ERROR_SUCCESS && rc != ERROR_MORE_DATA {
        return Err(fail("read", rc));
    }
    let mut buf = vec![0u16; len as usize + 1];
    let mut capacity = buf.len() as u32;
    // SAFETY: `buf` holds `capacity` units; the call writes at most that many (incl. the NUL).
    let rc = unsafe {
        MsiRecordGetStringW(
            *record,
            1,
            Some(PWSTR(buf.as_mut_ptr())),
            Some(&mut capacity),
        )
    };
    if rc != ERROR_SUCCESS {
        return Err(fail("read", rc));
    }
    Ok(from_wide(&buf))
}

// ---------------------------------------------------------------------------------------------
// Elevation

/// `SW_HIDE`.
const SHOW_HIDDEN: i32 = 0;

/// Runs `program` elevated through `ShellExecuteExW` with the `runas` verb (the UAC prompt) and
/// waits for it. `params` is an already quoted argument string (see `args::join_windows_args`).
pub(crate) fn run_elevated(
    program: &Path,
    params: &[u16],
    dir: Option<&Path>,
    timeout: Duration,
) -> Result<i32, InstallError> {
    let file = wide(program.as_os_str());
    let parameters: Vec<u16> = params.iter().copied().chain(std::iter::once(0)).collect();
    let directory = dir.map(|d| wide(d.as_os_str()));
    let mut info = SHELLEXECUTEINFOW {
        cbSize: size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC | SEE_MASK_FLAG_NO_UI,
        lpVerb: w!("runas"),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: PCWSTR(parameters.as_ptr()),
        lpDirectory: directory
            .as_ref()
            .map_or(PCWSTR::null(), |d| PCWSTR(d.as_ptr())),
        nShow: SHOW_HIDDEN,
        ..Default::default()
    };
    // SAFETY: `info` is initialised with its size, and every string it points to is a
    // NUL-terminated buffer that outlives the call.
    if let Err(e) = unsafe { ShellExecuteExW(&mut info) } {
        return Err(if e.code() == HRESULT::from_win32(ERROR_CANCELLED.0) {
            InstallError::ElevationDeclined
        } else {
            system(e)
        });
    }
    if info.hProcess.is_invalid() {
        return Err(InstallError::System(
            "the elevated installer did not start".into(),
        ));
    }
    // SAFETY: with SEE_MASK_NOCLOSEPROCESS the process handle is ours; `Owned` closes it once.
    let process = unsafe { Owned::new(info.hProcess) };
    let millis = u32::try_from(timeout.as_millis())
        .unwrap_or(u32::MAX)
        .min(u32::MAX - 1);
    // SAFETY: valid process handle.
    let wait = unsafe { WaitForSingleObject(*process, millis) };
    if wait == WAIT_TIMEOUT {
        // SAFETY: valid process handle. Terminating may be denied for an elevated process; the
        // timeout is reported either way.
        let _ = unsafe { TerminateProcess(*process, 1) };
        return Err(InstallError::TimedOut);
    }
    if wait != WAIT_OBJECT_0 {
        return Err(InstallError::System(format!(
            "waiting for the elevated installer failed ({:#x})",
            wait.0
        )));
    }
    let mut code = 0u32;
    // SAFETY: valid process handle; out-pointer to a local.
    unsafe { GetExitCodeProcess(*process, &mut code) }.map_err(system)?;
    // Exit codes are DWORDs; NTSTATUS-style codes read as negative, like `ExitStatus::code`.
    Ok(code as i32)
}

// ---------------------------------------------------------------------------------------------
// Shortcuts

/// COM on the current thread for the lifetime of the guard (not `Send`: it must be released on
/// the thread that initialised it).
struct ComApartment {
    initialised: bool,
    _not_send: PhantomData<*const ()>,
}

impl ComApartment {
    fn enter() -> Result<Self, InstallError> {
        // SAFETY: per-thread COM initialisation; balanced in `Drop` on this thread when it
        // succeeded.
        let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) };
        if hr == RPC_E_CHANGED_MODE {
            // The thread is already in the multithreaded apartment: COM is usable as is.
            return Ok(Self {
                initialised: false,
                _not_send: PhantomData,
            });
        }
        hr.ok().map_err(system)?;
        Ok(Self {
            initialised: true,
            _not_send: PhantomData,
        })
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        if self.initialised {
            // SAFETY: balances the successful CoInitializeEx above, on the same thread; every
            // interface created under the guard was released before it (declared after it).
            unsafe { CoUninitialize() };
        }
    }
}

/// Writes a `.lnk` at `link` that starts `target` in `dir` (IShellLinkW + IPersistFile).
pub(crate) fn create_shortcut(link: &Path, target: &Path, dir: &Path) -> Result<(), InstallError> {
    let _com = ComApartment::enter()?;
    let target = wide(target.as_os_str());
    let dir = wide(dir.as_os_str());
    let link = wide(link.as_os_str());
    // SAFETY: COM is initialised on this thread (`_com`); CLSID_ShellLink is the in-process
    // shell link object, which implements IShellLinkW.
    let shell_link: IShellLinkW =
        unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }.map_err(system)?;
    // SAFETY: valid interface; NUL-terminated strings alive for the calls.
    unsafe {
        shell_link
            .SetPath(PCWSTR(target.as_ptr()))
            .map_err(system)?;
        shell_link
            .SetWorkingDirectory(PCWSTR(dir.as_ptr()))
            .map_err(system)?;
    }
    let file: IPersistFile = shell_link.cast().map_err(system)?;
    // SAFETY: valid interface; NUL-terminated path; `true` makes it the object's current file.
    unsafe { file.Save(PCWSTR(link.as_ptr()), true) }.map_err(system)?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// MSIX (WinRT; no unsafe needed)

fn deployment_result(result: &DeploymentResult) -> Result<(), InstallError> {
    let code = result.ExtendedErrorCode().map_err(system)?;
    if code.is_err() {
        return Err(InstallError::System(format!(
            "MSIX deployment failed ({:#010x})",
            code.0
        )));
    }
    Ok(())
}

/// `PackageManager.AddPackageAsync(uri, none, ForceTargetApplicationShutdown)` (blocking).
pub(crate) fn msix_add(uri: &str) -> Result<(), InstallError> {
    let uri = Uri::CreateUri(&HSTRING::from(uri)).map_err(system)?;
    let manager = PackageManager::new().map_err(system)?;
    let operation = manager
        .AddPackageAsync(
            &uri,
            None::<&IIterable<Uri>>,
            DeploymentOptions::ForceTargetApplicationShutdown,
        )
        .map_err(system)?;
    let result = operation.join().map_err(system)?;
    deployment_result(&result)
}

/// Removes every package of the current user with this identity name and publisher (blocking).
pub(crate) fn msix_remove(name: &str, publisher: &str) -> Result<(), InstallError> {
    let manager = PackageManager::new().map_err(system)?;
    let packages = manager
        .FindPackagesByUserSecurityIdNamePublisher(
            &HSTRING::new(),
            &HSTRING::from(name),
            &HSTRING::from(publisher),
        )
        .map_err(system)?;
    let mut full_names = Vec::new();
    for package in &packages {
        full_names.push(package.Id().and_then(|id| id.FullName()).map_err(system)?);
    }
    for full_name in full_names {
        let result = manager
            .RemovePackageAsync(&full_name)
            .and_then(|op| op.join())
            .map_err(system)?;
        deployment_result(&result)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_folders_resolve() {
        let system = known_folder(KnownFolder::System).unwrap();
        assert!(system.join("msiexec.exe").is_file(), "{system:?}");
        assert!(known_folder(KnownFolder::LocalAppData).unwrap().is_dir());
        assert!(known_folder(KnownFolder::Programs).is_ok());
    }

    /// Reads a package from the Windows Installer cache (read-only), while holding it locked the
    /// way the installer does. Skipped when the cache has no MSI.
    #[test]
    fn reads_a_cached_msi() {
        let cache = Path::new(r"C:\Windows\Installer");
        let Some(msi) = std::fs::read_dir(cache).ok().and_then(|dir| {
            dir.filter_map(Result::ok)
                .map(|e| e.path())
                .filter(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("msi")))
                .filter_map(|p| std::fs::metadata(&p).ok().map(|m| (m.len(), p)))
                .min()
                .map(|(_, p)| p)
        }) else {
            eprintln!("no cached MSI: skipped");
            return;
        };
        let _held = crate::verify::open_locked(&msi).unwrap();
        let info = msi_info(&msi).unwrap();
        assert!(
            crate::args::is_product_code(&info.product_code),
            "{:?}",
            info.product_code
        );
        let not_msi = tempfile::tempdir().unwrap();
        let fake = not_msi.path().join("fake.msi");
        std::fs::write(&fake, b"nope").unwrap();
        assert!(matches!(
            msi_info(&fake),
            Err(InstallError::InvalidPackage(_))
        ));
    }

    #[test]
    fn hex_is_upper_case() {
        assert_eq!(hex_upper(&[0x0a, 0xff, 0x10]), "0AFF10");
    }
}
