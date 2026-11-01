//! Small text helpers: versions from tags, release notes as plain text, `FUNDING.yml` links,
//! monograms and tile colours.

use regex::Regex;

pub fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut s, b| {
            let _ = write!(s, "{b:02x}");
            s
        })
}

/// `v1.2.3` → `1.2.3`; `desktop_v1.4.28` → `1.4.28`; `V2.0.3` → `2.0.3`; `1.23.1b` → `1.23.1b`.
/// The first run of dot-separated numbers wins, with a suffix glued to it; a tag without one is
/// kept as is, minus a leading `v`.
pub fn version_from_tag(tag: &str) -> String {
    let found = Regex::new(r"\d+(?:\.\d+)+(?:[-+]?[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?")
        .ok()
        .and_then(|rx| rx.find(tag).map(|m| m.as_str().to_owned()));
    found.unwrap_or_else(|| tag.trim_start_matches(['v', 'V']).to_owned())
}

/// A 0.x version or a pre-release: the project calls it early.
pub fn is_early(version: &str, prerelease: bool) -> bool {
    prerelease || version.starts_with("0.")
}

/// Release notes (Markdown, sometimes HTML) as at most `max_lines` short plain-text lines: no
/// markup, links reduced to their text, images, HTML tags and comments dropped.
pub fn notes_lines(body: &str, max_lines: usize) -> Vec<String> {
    let comment = Regex::new(r"(?s)<!--.*?-->").ok();
    let image = Regex::new(r"!\[[^\]]*\]\([^)]*\)").ok();
    let link = Regex::new(r"\[([^\]]*)\]\([^)]*\)").ok();
    let tag = Regex::new(r"</?[A-Za-z][^>]*>").ok();
    let bare_url = Regex::new(r"https?://\S+").ok();
    let mut text = body.replace("\r\n", "\n");
    if let Some(rx) = &comment {
        text = rx.replace_all(&text, "").into_owned();
    }
    let mut lines = Vec::new();
    for raw in text.lines() {
        let mut line = raw.trim().to_owned();
        if let Some(rx) = &image {
            line = rx.replace_all(&line, "").into_owned();
        }
        if let Some(rx) = &link {
            line = rx.replace_all(&line, "$1").into_owned();
        }
        if let Some(rx) = &tag {
            line = rx.replace_all(&line, "").into_owned();
        }
        if let Some(rx) = &bare_url {
            line = rx.replace_all(&line, "").into_owned();
        }
        let line = line
            .trim_start_matches(['#', '>', '*', '-', '+', ' '])
            .replace("**", "")
            .replace("__", "")
            .replace('`', "");
        let line = line.split_whitespace().collect::<Vec<_>>().join(" ");
        // Tables, rules and leftovers of markup carry nothing readable.
        if line.chars().filter(|c| c.is_alphanumeric()).count() < 3 || line.starts_with('|') {
            continue;
        }
        let short: String = if line.chars().count() > 160 {
            let mut s: String = line.chars().take(157).collect();
            s.push('…');
            s
        } else {
            line
        };
        lines.push(short);
        if lines.len() == max_lines {
            break;
        }
    }
    lines
}

/// Links from a `FUNDING.yml` (`github: [a, b]`, `ko_fi: x`, `custom: ["https://…"]`, …), in file
/// order. A tiny reader for the documented keys, not a YAML parser.
pub fn funding_links(yaml: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut current_key: Option<String> = None;
    for raw in yaml.lines() {
        let line = raw.split(" #").next().unwrap_or_default().trim_end();
        if line.trim().is_empty() || line.trim_start().starts_with('#') {
            continue;
        }
        let trimmed = line.trim();
        if let Some(item) = trimmed.strip_prefix("- ") {
            if let Some(key) = &current_key {
                push_funding(&mut links, key, item);
            }
            continue;
        }
        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };
        let key = key.trim().to_ascii_lowercase();
        current_key = Some(key.clone());
        let value = value.trim();
        if value.is_empty() {
            continue;
        }
        if let Some(list) = value.strip_prefix('[').and_then(|v| v.strip_suffix(']')) {
            for item in list.split(',') {
                push_funding(&mut links, &key, item);
            }
        } else {
            push_funding(&mut links, &key, value);
        }
    }
    links.dedup();
    links
}

fn push_funding(links: &mut Vec<String>, key: &str, value: &str) {
    let value = value.trim().trim_matches(['"', '\'']).trim();
    if value.is_empty() || value.eq_ignore_ascii_case("null") || value.eq_ignore_ascii_case("none")
    {
        return;
    }
    let url = match key {
        "github" => format!("https://github.com/sponsors/{value}"),
        "patreon" => format!("https://www.patreon.com/{value}"),
        "open_collective" => format!("https://opencollective.com/{value}"),
        "ko_fi" => format!("https://ko-fi.com/{value}"),
        "liberapay" => format!("https://liberapay.com/{value}"),
        "buy_me_a_coffee" => format!("https://www.buymeacoffee.com/{value}"),
        "polar" => format!("https://polar.sh/{value}"),
        "thanks_dev" => format!("https://thanks.dev/{value}"),
        "issuehunt" => format!("https://issuehunt.io/r/{value}"),
        "custom" if value.starts_with("https://") => value.to_owned(),
        _ => return,
    };
    links.push(url);
}

/// Two-letter monogram from the name: `Notepad++` → `No`, `Flow Launcher` → `FL`.
pub fn monogram(name: &str) -> String {
    let words: Vec<&str> = name
        .split(|c: char| c.is_whitespace() || c == '-')
        .filter(|w| w.chars().next().is_some_and(char::is_alphanumeric))
        .collect();
    let mut mono = String::new();
    if words.len() >= 2 {
        for w in words.iter().take(2) {
            if let Some(c) = w.chars().next() {
                mono.extend(c.to_uppercase());
            }
        }
    } else if let Some(word) = words.first() {
        let mut chars = word.chars();
        if let Some(c) = chars.next() {
            mono.extend(c.to_uppercase());
        }
        if let Some(c) = chars.next() {
            mono.extend(c.to_lowercase());
        }
    }
    if mono.is_empty() {
        "··".to_owned()
    } else {
        mono
    }
}

/// A stable tile colour for apps without one: the palette of the prototype's categories.
pub fn tint_for(id: &str) -> String {
    const PALETTE: [&str; 9] = [
        "#2f7a58", "#2c5d8a", "#8a3e78", "#a3562c", "#4f6070", "#2f5f9a", "#3f7a4a", "#7a4a2f",
        "#5a5a9a",
    ];
    let sum = id
        .bytes()
        .fold(0u32, |a, b| a.wrapping_mul(31).wrapping_add(u32::from(b)));
    PALETTE[(sum as usize) % PALETTE.len()].to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_come_out_of_tags() {
        assert_eq!(version_from_tag("v1.2.3"), "1.2.3");
        assert_eq!(version_from_tag("desktop_v1.4.28"), "1.4.28");
        assert_eq!(version_from_tag("V2.0.3"), "2.0.3");
        assert_eq!(version_from_tag("1.23.1b"), "1.23.1b");
        assert_eq!(version_from_tag("v2026.8.1"), "2026.8.1");
        assert_eq!(version_from_tag("v1.0.0-rc.3"), "1.0.0-rc.3");
        assert_eq!(version_from_tag("Update-V8.02"), "8.02");
        assert_eq!(version_from_tag("nightly"), "nightly");
        assert!(is_early("0.15.1", false));
        assert!(is_early("2.0", true));
        assert!(!is_early("1.0", false));
    }

    #[test]
    fn notes_become_plain_lines() {
        let body = "## What's new\r\n\r\n- **Faster** startup ([#12](https://x/12))\n\
                    <!-- hidden -->\n![shot](https://x/a.png)\n| a | b |\n---\n\
                    * See https://example.org for details\n<details>More</details>";
        assert_eq!(
            notes_lines(body, 10),
            vec![
                "What's new",
                "Faster startup (#12)",
                "See for details",
                "More"
            ]
        );
        assert_eq!(notes_lines("a\nbbbb\ncccc\ndddd", 2), vec!["bbbb", "cccc"]);
    }

    #[test]
    fn funding_files_become_links() {
        let yaml = "# comment\ngithub: [alice, bob]\nko_fi: carol\ncustom:\n  - \"https://example.org/donate\"\n  - http://insecure.example\npatreon: # none\nliberapay: null\n";
        assert_eq!(
            funding_links(yaml),
            vec![
                "https://github.com/sponsors/alice",
                "https://github.com/sponsors/bob",
                "https://ko-fi.com/carol",
                "https://example.org/donate",
            ]
        );
    }

    #[test]
    fn monograms_and_tints() {
        assert_eq!(monogram("Flow Launcher"), "FL");
        assert_eq!(monogram("Notepad++"), "No");
        assert_eq!(monogram("7-Zip"), "7Z");
        assert_eq!(tint_for("x"), tint_for("x"));
        assert!(tint_for("abc").starts_with('#'));
    }
}
