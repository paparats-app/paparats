//! Version comparison for the dotted versions publishers actually use: `1.4.1.1028`, `25.01`,
//! `2026.8.1`, `4.120`, `146`, and semver-style pre-releases (`2.0.0-beta.2`).
//!
//! Rules: an optional leading `v` is ignored; build metadata after `+` is ignored; dot-separated
//! components compare numerically by their leading digits (`01` = `1`, arbitrarily long), then by
//! any trailing text (a bare number beats `1a`-style suffixes); missing components count as `0`
//! (`1.0` = `1.0.0`); a release beats its pre-releases (`2.0` > `2.0-rc.1`).

use std::cmp::Ordering;

/// Splits `"0012abc"` into `("12", "abc")` (digits without leading zeros, rest).
fn split_component(c: &str) -> (&str, &str) {
    let digits = c.bytes().take_while(u8::is_ascii_digit).count();
    let (num, rest) = c.split_at(digits);
    (num.trim_start_matches('0'), rest)
}

/// Compares two digit strings without leading zeros, of any length.
fn compare_digits(a: &str, b: &str) -> Ordering {
    a.len().cmp(&b.len()).then_with(|| a.cmp(b))
}

fn compare_component(a: &str, b: &str) -> Ordering {
    let (an, ar) = split_component(a);
    let (bn, br) = split_component(b);
    compare_digits(an, bn).then_with(|| match (ar.is_empty(), br.is_empty()) {
        (true, true) => Ordering::Equal,
        (true, false) => Ordering::Greater,
        (false, true) => Ordering::Less,
        (false, false) => ar.to_ascii_lowercase().cmp(&br.to_ascii_lowercase()),
    })
}

/// Semver pre-release identifiers: numeric < alphanumeric, numeric compared as numbers.
fn compare_prerelease(a: &str, b: &str) -> Ordering {
    let mut ai = a.split('.');
    let mut bi = b.split('.');
    loop {
        match (ai.next(), bi.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) => {
                let numeric = |s: &str| !s.is_empty() && s.bytes().all(|c| c.is_ascii_digit());
                let ord = match (numeric(x), numeric(y)) {
                    (true, true) => {
                        compare_digits(x.trim_start_matches('0'), y.trim_start_matches('0'))
                    }
                    (true, false) => Ordering::Less,
                    (false, true) => Ordering::Greater,
                    (false, false) => x.to_ascii_lowercase().cmp(&y.to_ascii_lowercase()),
                };
                if ord != Ordering::Equal {
                    return ord;
                }
            }
        }
    }
}

/// Splits into (release, pre-release).
fn parts(version: &str) -> (&str, Option<&str>) {
    let v = version.trim();
    let v = v
        .strip_prefix('v')
        .or_else(|| v.strip_prefix('V'))
        .unwrap_or(v);
    let v = v.split('+').next().unwrap_or(v);
    match v.split_once('-') {
        Some((release, pre)) => (release, Some(pre)),
        None => (v, None),
    }
}

/// Orders two versions.
pub fn compare(a: &str, b: &str) -> Ordering {
    let (ar, ap) = parts(a);
    let (br, bp) = parts(b);
    let mut ac = ar.split('.');
    let mut bc = br.split('.');
    loop {
        match (ac.next(), bc.next()) {
            (None, None) => break,
            (x, y) => {
                let ord = compare_component(x.unwrap_or("0"), y.unwrap_or("0"));
                if ord != Ordering::Equal {
                    return ord;
                }
            }
        }
    }
    match (ap, bp) {
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Greater,
        (Some(_), None) => Ordering::Less,
        (Some(x), Some(y)) => compare_prerelease(x, y),
    }
}

/// Whether the catalog's version is newer than the installed one.
pub fn is_newer(catalog: &str, installed: &str) -> bool {
    compare(catalog, installed) == Ordering::Greater
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dotted_numeric_versions() {
        assert!(is_newer("1.4.1.1028", "1.4.1.1027"));
        assert!(is_newer("1.4.1.1028", "1.4.1"));
        assert!(!is_newer("1.4.1.1028", "1.4.1.1028"));
        assert!(is_newer("1.93.0", "1.92.2"));
        assert!(is_newer("1.8.10", "1.8.9"), "numeric, not lexicographic");
        assert!(is_newer("1.9.15", "1.9.14"));
        assert!(is_newer("3.0.21", "3.0.20"));
        assert!(is_newer("146", "145"));
        assert!(is_newer("4.120", "4.12"));
        assert!(is_newer("2026.8.1", "2026.7.30"));
        assert!(is_newer("1.10", "1.9"));
        assert!(!is_newer("1.9", "1.10"));
    }

    #[test]
    fn leading_zeros_and_missing_components() {
        assert_eq!(compare("25.01", "25.1"), Ordering::Equal);
        assert!(is_newer("25.02", "25.01"));
        assert!(is_newer("25.02.4", "25.2.3"));
        assert_eq!(compare("1.0", "1.0.0"), Ordering::Equal);
        assert!(!is_newer("1.0.0", "1"));
        assert!(is_newer("1.0.1", "1"));
        assert!(is_newer(
            "100000000000000000000001",
            "100000000000000000000000"
        ));
    }

    #[test]
    fn prefixes_suffixes_and_prereleases() {
        assert_eq!(compare("v1.2.3", "1.2.3"), Ordering::Equal);
        assert_eq!(compare("1.2.3+build.7", "1.2.3"), Ordering::Equal);
        assert!(is_newer("2.0.0", "2.0.0-rc.1"));
        assert!(is_newer("2.0.0-rc.2", "2.0.0-rc.1"));
        assert!(is_newer("2.0.0-rc.10", "2.0.0-rc.9"));
        assert!(is_newer("2.0.0-beta", "2.0.0-alpha"));
        assert!(is_newer("2.0.0-alpha.beta", "2.0.0-alpha.1"));
        assert!(is_newer("2.0.0-alpha.1", "2.0.0-alpha"));
        assert!(is_newer("1.2", "1.2a"), "a bare number beats a suffix");
        assert!(is_newer("1.2b", "1.2a"));
        assert!(is_newer("1.3a", "1.2"));
    }

    #[test]
    fn fixture_pairs() {
        // installed (library.json) vs catalog (catalog.json)
        for (catalog, installed, newer) in [
            ("1.93.0", "1.92.2", true),          // vscode
            ("1.8.10", "1.8.9", true),           // obsidian
            ("1.4.1.1028", "1.4.1.1028", false), // everything
            ("25.01", "25.01", false),           // sevenzip
            ("1.9.15", "1.9.14", true),          // shell
        ] {
            assert_eq!(
                is_newer(catalog, installed),
                newer,
                "{catalog} vs {installed}"
            );
        }
    }

    #[test]
    fn versions_the_inventory_reads() {
        // MSIX `Major.Minor.Build.Revision` and MSI 4-part versions against 3-part catalog ones.
        assert_eq!(compare("2026.8.1.0", "2026.8.1"), Ordering::Equal);
        assert_eq!(compare("5.2.9.0", "5.2.9"), Ordering::Equal);
        assert!(is_newer("5.2.9.1", "5.2.9"));
        assert!(is_newer("1.4.1.1032", "1.4.1.1028"));
        // Numeric, not lexicographic, at every position.
        assert!(is_newer("0.100.2", "0.94.0"));
        assert!(is_newer("1.121.0", "1.93.0"));
        // Leading zeros (7-Zip) and a newer year-based release.
        assert!(is_newer("25.01", "24.09"));
        assert_eq!(compare("24.09", "24.9"), Ordering::Equal);
        // Build metadata and pre-release suffixes from DisplayVersion.
        assert_eq!(compare("4.1.1+40101", "4.1.1"), Ordering::Equal);
        assert!(is_newer("3.7.4", "3.7.4-beta.1"));
    }
}
