//! MSIX helpers that need no Windows API: the package identity (read from the manifest inside
//! the package, so uninstall can find the installed package) and the `file:` URI handed to
//! `PackageManager`.

use std::fs::File;
use std::io::Read;
use std::path::Path;

use zip::ZipArchive;

use crate::InstallError;

/// `<Identity Name="…" Publisher="…" Version="…"/>` of a package or bundle.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MsixIdentity {
    pub name: String,
    pub publisher: String,
    pub version: String,
}

const PACKAGE_MANIFEST: &str = "AppxManifest.xml";
const BUNDLE_MANIFEST: &str = "AppxMetadata/AppxBundleManifest.xml";
const MAX_MANIFEST_BYTES: u64 = 4 * 1024 * 1024;

/// Reads the identity of an `.msix`/`.appx` (or bundle) package.
pub fn read_identity(package: &File) -> Result<MsixIdentity, InstallError> {
    let mut zip =
        ZipArchive::new(package).map_err(|_| InstallError::invalid("not an MSIX package"))?;
    let name = [PACKAGE_MANIFEST, BUNDLE_MANIFEST]
        .into_iter()
        .find(|n| zip.index_for_name(n).is_some())
        .ok_or_else(|| InstallError::invalid("the MSIX package has no manifest"))?;
    let mut xml = String::new();
    zip.by_name(name)
        .map_err(|_| InstallError::invalid("the MSIX manifest is unreadable"))?
        .take(MAX_MANIFEST_BYTES)
        .read_to_string(&mut xml)
        .map_err(|_| InstallError::invalid("the MSIX manifest is unreadable"))?;
    parse_identity(&xml).ok_or_else(|| InstallError::invalid("the MSIX manifest has no identity"))
}

/// Finds the first `Identity` element (any namespace prefix) outside comments and CDATA, and
/// reads its `Name`, `Publisher` and `Version` attributes.
pub fn parse_identity(xml: &str) -> Option<MsixIdentity> {
    let mut rest = xml;
    while let Some(start) = rest.find('<') {
        rest = &rest[start..];
        if let Some(after) = rest.strip_prefix("<!--") {
            rest = &after[after.find("-->")? + 3..];
            continue;
        }
        if let Some(after) = rest.strip_prefix("<![CDATA[") {
            rest = &after[after.find("]]>")? + 3..];
            continue;
        }
        let end = tag_end(rest)?;
        let tag = &rest[1..end];
        rest = &rest[end + 1..];
        let name_len = tag
            .find(|c: char| c.is_whitespace() || c == '/')
            .unwrap_or(tag.len());
        let tag_name = &tag[..name_len];
        let local = tag_name.rsplit(':').next().unwrap_or(tag_name);
        if local != "Identity" {
            continue;
        }
        let attrs = &tag[name_len..];
        return Some(MsixIdentity {
            name: attribute(attrs, "Name")?,
            publisher: attribute(attrs, "Publisher")?,
            version: attribute(attrs, "Version")?,
        });
    }
    None
}

/// Index of the `>` closing the tag that starts at 0 (quotes may contain `>`).
fn tag_end(s: &str) -> Option<usize> {
    let mut quote: Option<char> = None;
    for (i, c) in s.char_indices() {
        match (quote, c) {
            (None, '"' | '\'') => quote = Some(c),
            (Some(q), c) if c == q => quote = None,
            (None, '>') => return Some(i),
            _ => {}
        }
    }
    None
}

fn attribute(attrs: &str, wanted: &str) -> Option<String> {
    let mut rest = attrs;
    loop {
        rest = rest.trim_start_matches(|c: char| c.is_whitespace() || c == '/');
        if rest.is_empty() {
            return None;
        }
        let eq = rest.find('=')?;
        let key = rest[..eq].trim();
        let after = rest[eq + 1..].trim_start();
        let quote = after.chars().next().filter(|c| *c == '"' || *c == '\'')?;
        let body = &after[1..];
        let close = body.find(quote)?;
        let value = &body[..close];
        rest = &body[close + 1..];
        if key == wanted {
            return unescape(value);
        }
    }
}

fn unescape(value: &str) -> Option<String> {
    let mut out = String::with_capacity(value.len());
    let mut rest = value;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        let after = &rest[amp + 1..];
        let semi = after.find(';')?;
        let entity = &after[..semi];
        let c = match entity {
            "amp" => '&',
            "lt" => '<',
            "gt" => '>',
            "quot" => '"',
            "apos" => '\'',
            _ => {
                let code = if let Some(hex) = entity.strip_prefix("#x") {
                    u32::from_str_radix(hex, 16).ok()?
                } else {
                    entity.strip_prefix('#')?.parse().ok()?
                };
                char::from_u32(code)?
            }
        };
        out.push(c);
        rest = &after[semi + 1..];
    }
    out.push_str(rest);
    Some(out)
}

/// `file:///C:/…` with everything outside the unreserved set (and `/`, `:`) percent-encoded as
/// UTF-8.
pub fn file_uri(path: &Path) -> Result<String, InstallError> {
    let text = path
        .to_str()
        .ok_or_else(|| InstallError::invalid("the package path is not valid Unicode"))?;
    let mut uri = String::from("file:///");
    for b in text.replace('\\', "/").bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b'_' | b'~' | b'/' | b':') {
            uri.push(char::from(b));
        } else {
            uri.push_str(&format!("%{b:02X}"));
        }
    }
    Ok(uri)
}

#[cfg(test)]
mod tests {
    use super::*;

    const MANIFEST: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<!-- <Identity Name="Commented.Out" Publisher="CN=No" Version="0.0.0.0"/> -->
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:mp="http://schemas.microsoft.com/appx/2014/phone/manifest">
  <Identity Name="Paparats.Test" Version="1.2.3.0"
            Publisher="CN=Test &amp; Sons, O=&quot;Test, Inc.&quot;, C=BY"
            ProcessorArchitecture="x64" />
  <mp:PhoneIdentity PhoneProductId="x" PhonePublisherId="y"/>
  <Properties><DisplayName>Test &gt; app</DisplayName></Properties>
</Package>"#;

    #[test]
    fn parses_the_identity() {
        assert_eq!(
            parse_identity(MANIFEST),
            Some(MsixIdentity {
                name: "Paparats.Test".into(),
                publisher: r#"CN=Test & Sons, O="Test, Inc.", C=BY"#.into(),
                version: "1.2.3.0".into(),
            })
        );
        let bundle =
            r#"<Bundle><b:Identity Name='B' Publisher='CN=&#x42;' Version='2.0.0.0'/></Bundle>"#;
        assert_eq!(
            parse_identity(bundle).map(|i| (i.name, i.publisher)),
            Some(("B".into(), "CN=B".into()))
        );
        assert_eq!(parse_identity("<Package><Properties/></Package>"), None);
        assert_eq!(parse_identity(r#"<Identity Name="x" Version="1"/>"#), None);
        assert_eq!(
            parse_identity(r#"<Identity Name="a&bogus;" Publisher="p" Version="1"/>"#),
            None
        );
    }

    #[test]
    fn reads_the_identity_from_a_package() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("app.msix");
        crate::archive::tests::write_zip(
            &path,
            &[
                ("AppxManifest.xml", MANIFEST.as_bytes()),
                ("app.exe", b"MZ"),
            ],
        );
        let id = read_identity(&File::open(&path).unwrap()).unwrap();
        assert_eq!(id.name, "Paparats.Test");

        let empty = dir.path().join("empty.msix");
        crate::archive::tests::write_zip(&empty, &[("app.exe", b"MZ")]);
        assert!(matches!(
            read_identity(&File::open(&empty).unwrap()),
            Err(InstallError::InvalidPackage(_))
        ));
    }

    #[test]
    fn file_uris() {
        assert_eq!(
            file_uri(Path::new(r"C:\Users\Test User\Downloads\a#1%.msix")).unwrap(),
            "file:///C:/Users/Test%20User/Downloads/a%231%25.msix"
        );
        assert_eq!(
            file_uri(Path::new(r"C:\Пап\x.msix")).unwrap(),
            "file:///C:/%D0%9F%D0%B0%D0%BF/x.msix"
        );
    }
}
