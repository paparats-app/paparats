//! Channel rules shared by every surface: which channels are active, where an app installs from
//! (the source rule), outages and the stale callout, and channel look-up by address.
//!
//! These mirror the prototype (`srcOf`, `altOf`, `downDays`, `chView`, `lookupChannel`) and the
//! UI's `domain/channels.ts` exactly.

use paparats_core::{
    App, ChannelId, ChannelInfo, ChannelLookup, ChannelSubscription, OFFICIAL_CHANNEL,
    STALE_AFTER_DAYS, dates,
};

/// Rank of a channel the client does not know: after every trust level.
const UNKNOWN_RANK: u8 = 3;

fn subscription<'a>(
    subscriptions: &'a [ChannelSubscription],
    channel_id: &str,
) -> Option<&'a ChannelSubscription> {
    subscriptions.iter().find(|s| s.channel_id == channel_id)
}

/// Followed and not paused. The official catalog cannot be paused, so it is active while followed.
pub fn is_active(subscriptions: &[ChannelSubscription], channel_id: &str) -> bool {
    subscription(subscriptions, channel_id)
        .is_some_and(|s| channel_id == OFFICIAL_CHANNEL || !s.paused)
}

fn rank(channels: &[ChannelInfo], channel_id: &str) -> u8 {
    channels
        .iter()
        .find(|c| c.id == channel_id)
        .map_or(UNKNOWN_RANK, |c| c.trust.rank())
}

/// The source rule: an app offered by several channels installs from the most trusted *active*
/// one (official › verified › community; ties keep the home channel first), without asking. With
/// no active candidate, the home channel.
pub fn resolve_source(
    app: &App,
    subscriptions: &[ChannelSubscription],
    channels: &[ChannelInfo],
) -> ChannelId {
    let mut active: Vec<&str> = app
        .candidate_channels()
        .filter(|id| is_active(subscriptions, id))
        .collect();
    // Stable: equally trusted candidates keep their order (home channel, then `alsoIn`).
    active.sort_by_key(|id| rank(channels, id));
    active
        .first()
        .copied()
        .unwrap_or_else(|| app.home_channel())
        .to_owned()
}

/// The other active channels that also offer the app ("Also in …" on the app page).
pub fn alternatives(
    app: &App,
    subscriptions: &[ChannelSubscription],
    channels: &[ChannelInfo],
) -> Vec<ChannelId> {
    let source = resolve_source(app, subscriptions, channels);
    app.candidate_channels()
        .filter(|id| *id != source && is_active(subscriptions, id))
        .map(str::to_owned)
        .collect()
}

/// Days the channel has been unreachable on `today` (at least 1 during an outage), 0 when it
/// answers.
pub fn down_days(channel: &ChannelInfo, today: &str) -> u32 {
    let Some(outage) = channel.outage.as_deref() else {
        return 0;
    };
    let days = dates::days_between(outage, today).unwrap_or(1).max(1);
    u32::try_from(days).unwrap_or(u32::MAX)
}

/// A followed channel down for ≥ 14 days whose callout the user has not answered with "Keep".
pub fn is_stale(
    channel: &ChannelInfo,
    subscription: Option<&ChannelSubscription>,
    today: &str,
) -> bool {
    subscription.is_some_and(|s| !s.stale_acknowledged)
        && down_days(channel, today) >= STALE_AFTER_DAYS
}

/// What the user typed, reduced like the prototype's `lookupChannel()`: trimmed, lower-cased,
/// without `http(s)://`, a leading `www.` and trailing slashes.
pub fn normalize_address(address: &str) -> String {
    let lower = address.trim().to_lowercase();
    let rest = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
        .unwrap_or(&lower);
    let rest = rest.strip_prefix("www.").unwrap_or(rest);
    rest.trim_end_matches('/').to_owned()
}

/// Matches the full address, its host part, the `@handle` or the handle without its first
/// character (`@`), case-insensitively. An empty query matches nothing.
pub fn find_channel<'a>(channels: &'a [ChannelInfo], address: &str) -> Option<&'a ChannelInfo> {
    let q = normalize_address(address);
    if q.is_empty() {
        return None;
    }
    channels.iter().find(|c| {
        let addr = c.addr.to_lowercase();
        let host = addr.split('/').next().unwrap_or_default();
        let handle = c.handle.to_lowercase();
        let bare: String = handle.chars().skip(1).collect();
        addr == q || host == q || handle == q || bare == q
    })
}

/// `ChannelService.lookup`: found, already followed, or not found.
pub fn lookup(
    channels: &[ChannelInfo],
    subscriptions: &[ChannelSubscription],
    address: &str,
) -> ChannelLookup {
    match find_channel(channels, address) {
        None => ChannelLookup::NotFound,
        Some(c) if subscription(subscriptions, &c.id).is_some() => {
            ChannelLookup::AlreadySubscribed { channel: c.clone() }
        }
        Some(c) => ChannelLookup::Found { channel: c.clone() },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::EmbeddedCatalog;

    fn world() -> EmbeddedCatalog {
        EmbeddedCatalog::load().unwrap()
    }

    fn sub(id: &str, paused: bool) -> ChannelSubscription {
        ChannelSubscription {
            channel_id: id.into(),
            paused,
            stale_acknowledged: false,
        }
    }

    #[test]
    fn active_means_followed_and_not_paused() {
        let subs = [
            sub("paparats", true),
            sub("kvetka", false),
            sub("vitrazh", true),
        ];
        assert!(
            is_active(&subs, "paparats"),
            "official ignores the paused flag"
        );
        assert!(is_active(&subs, "kvetka"));
        assert!(!is_active(&subs, "vitrazh"));
        assert!(!is_active(&subs, "fossfriends"));
    }

    #[test]
    fn source_rule_prefers_the_most_trusted_active_channel() {
        let w = world();
        let ch = w.channels_ref();
        // Vitrazh Tweaker: home channel vitrazh (community), also in the official catalog.
        let app = w.app("vitrazhtweaker").unwrap();
        let both = [sub("paparats", false), sub("vitrazh", false)];
        assert_eq!(resolve_source(app, &both, ch), "paparats");
        assert_eq!(alternatives(app, &both, ch), ["vitrazh"]);

        let community_only = [sub("vitrazh", false)];
        assert_eq!(resolve_source(app, &community_only, ch), "vitrazh");
        assert!(alternatives(app, &community_only, ch).is_empty());

        // Nothing active → the home channel, no alternatives.
        assert_eq!(resolve_source(app, &[], ch), "vitrazh");
        assert!(alternatives(app, &[], ch).is_empty());

        // A paused channel is not a source.
        let paused = [sub("paparats", false), sub("vitrazh", true)];
        assert_eq!(resolve_source(app, &paused, ch), "paparats");
        assert!(alternatives(app, &paused, ch).is_empty());

        // Official apps resolve to the catalog.
        let obsidian = w.app("obsidian").unwrap();
        assert_eq!(
            resolve_source(obsidian, w.seed_subscriptions(), ch),
            "paparats"
        );
    }

    #[test]
    fn source_rule_ranks_unknown_channels_last_and_keeps_ties_stable() {
        let w = world();
        let mut app = w.app("shell").unwrap().clone();
        // kvetka (verified, home) + fossfriends (verified) + an unknown channel.
        app.also_in = vec!["ghost".into(), "fossfriends".into()];
        let subs = [
            sub("ghost", false),
            sub("fossfriends", false),
            sub("kvetka", false),
        ];
        assert_eq!(resolve_source(&app, &subs, w.channels_ref()), "kvetka");
        assert_eq!(
            alternatives(&app, &subs, w.channels_ref()),
            ["ghost", "fossfriends"]
        );
        let without_home = [sub("ghost", false), sub("fossfriends", false)];
        assert_eq!(
            resolve_source(&app, &without_home, w.channels_ref()),
            "fossfriends"
        );
    }

    #[test]
    fn outages_and_the_stale_callout() {
        let w = world();
        let foss = w.channel("fossfriends").unwrap(); // outage since 2026-08-30
        assert_eq!(down_days(foss, "2026-09-15"), 16);
        assert_eq!(down_days(foss, "2026-08-30"), 1, "at least one day");
        assert_eq!(down_days(foss, "2026-08-01"), 1, "outage in the future");
        assert_eq!(down_days(w.channel("kvetka").unwrap(), "2026-09-15"), 0);

        let mut s = sub("fossfriends", false);
        assert!(is_stale(foss, Some(&s), "2026-09-15"));
        assert!(
            !is_stale(foss, Some(&s), "2026-09-12"),
            "13 days is not stale"
        );
        assert!(is_stale(foss, Some(&s), "2026-09-13"), "14 days is stale");
        assert!(
            !is_stale(foss, None, "2026-09-15"),
            "only followed channels"
        );
        s.stale_acknowledged = true;
        assert!(!is_stale(foss, Some(&s), "2026-09-15"));
    }

    #[test]
    fn address_normalisation_matches_the_prototype() {
        assert_eq!(
            normalize_address("  HTTPS://www.Kvetka.Example/paparats//  "),
            "kvetka.example/paparats"
        );
        assert_eq!(
            normalize_address("http://mpvbuilds.example"),
            "mpvbuilds.example"
        );
        assert_eq!(normalize_address("@Kvetka"), "@kvetka");
        // Only one scheme and one `www.` are stripped, like the regexes.
        assert_eq!(normalize_address("www.www.x.org"), "www.x.org");
        assert_eq!(normalize_address("   "), "");
    }

    #[test]
    fn channel_lookup() {
        let w = world();
        let ch = w.channels_ref();
        let id = |q: &str| find_channel(ch, q).map(|c| c.id.as_str());
        assert_eq!(id("https://www.kvetka.example/paparats/"), Some("kvetka"));
        assert_eq!(id("KVETKA.EXAMPLE"), Some("kvetka"), "host part of addr");
        assert_eq!(id("@vitrazh"), Some("vitrazh"));
        assert_eq!(id("vitrazh"), Some("vitrazh"), "handle without @");
        assert_eq!(id("mpvbuilds"), Some("mpvbuilds"), "handle without @");
        assert_eq!(id("mpvbuilds.example/paparats"), Some("mpvbuilds"));
        assert_eq!(id("bysoft.by/kanal"), Some("bysoft"));
        assert_eq!(id("kvetka.example/other"), None);
        assert_eq!(id(""), None);
        assert_eq!(id("https://"), None);

        let subs = w.seed_subscriptions();
        assert!(matches!(
            lookup(ch, subs, "@vitrazh"),
            ChannelLookup::Found { channel } if channel.id == "vitrazh"
        ));
        assert!(matches!(
            lookup(ch, subs, "kvetka.example/paparats"),
            ChannelLookup::AlreadySubscribed { channel } if channel.id == "kvetka"
        ));
        assert_eq!(lookup(ch, subs, "example.com"), ChannelLookup::NotFound);
    }
}
