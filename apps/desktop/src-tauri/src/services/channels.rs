//! ChannelService: Settings › Sources and the channel page.

use paparats_catalog::rules;
use paparats_core::{
    ChannelInfo, ChannelLookup, ChannelSubscription, OFFICIAL_CHANNEL, ReportReceipt, ReportTarget,
    SyncOutcome, TrustLevel,
};

use super::AppState;
use crate::error::{AppError, AppResult};

fn protect_official(channel_id: &str, action: &str) -> AppResult<()> {
    if channel_id == OFFICIAL_CHANNEL {
        Err(AppError::invalid(format!(
            "the official catalog cannot be {action}"
        )))
    } else {
        Ok(())
    }
}

impl AppState {
    /// Every channel known to the client (followed or not), with local sync dates applied.
    pub fn get_channels(&self) -> AppResult<Vec<ChannelInfo>> {
        let synced = self.storage.channel_sync_dates()?;
        Ok(self
            .catalog
            .channels_ref()
            .iter()
            .map(|c| {
                let mut c = c.clone();
                if let Some(date) = synced.get(&c.id) {
                    c.synced = Some(date.clone());
                }
                c
            })
            .collect())
    }

    /// Followed channels, in the order they were added (the official catalog first).
    pub fn get_subscriptions(&self) -> AppResult<Vec<ChannelSubscription>> {
        Ok(self.storage.subscriptions()?)
    }

    /// Looks a channel up by address, host or `@handle` (the prototype's `lookupChannel`).
    pub fn lookup_channel(&self, address: &str) -> AppResult<ChannelLookup> {
        Ok(rules::lookup(
            &self.get_channels()?,
            &self.storage.subscriptions()?,
            address,
        ))
    }

    /// Follows a channel (`notFound` for an unknown one). Community channels are confirmed by
    /// the UI before this is called.
    pub fn subscribe_channel(&self, channel_id: &str) -> AppResult<Vec<ChannelSubscription>> {
        self.channel(channel_id)?;
        Ok(self.storage.subscribe(channel_id)?)
    }

    /// Unfollows a channel. The official catalog cannot be removed (`invalid`).
    pub fn unsubscribe_channel(&self, channel_id: &str) -> AppResult<Vec<ChannelSubscription>> {
        protect_official(channel_id, "removed")?;
        Ok(self.storage.unsubscribe(channel_id)?)
    }

    /// Switches a followed channel off/on. The official catalog cannot be paused (`invalid`).
    pub fn set_channel_paused(
        &self,
        channel_id: &str,
        paused: bool,
    ) -> AppResult<Vec<ChannelSubscription>> {
        protect_official(channel_id, "paused")?;
        Ok(self.storage.set_subscription_paused(channel_id, paused)?)
    }

    /// "Keep" on the stale callout.
    pub fn acknowledge_stale(&self, channel_id: &str) -> AppResult<Vec<ChannelSubscription>> {
        Ok(self.storage.acknowledge_stale(channel_id)?)
    }

    /// "Sync now": unreachable during an outage (days down, at least 1), else synced today.
    pub fn sync_channel(&self, channel_id: &str) -> AppResult<SyncOutcome> {
        let channel = self.channel(channel_id)?;
        let today = self.today();
        if channel.outage.is_some() {
            return Ok(SyncOutcome::Unreachable {
                days: rules::down_days(&channel, &today),
            });
        }
        self.storage.set_channel_synced(channel_id, &today)?;
        Ok(SyncOutcome::Synced { at: today })
    }

    /// Sends a problem report to the channel author (copy to Paparats) or to Paparats only
    /// (official catalog). There is no report API until M7; the text is never logged.
    pub fn report_problem(&self, target: &ReportTarget, _text: &str) -> AppResult<ReportReceipt> {
        let channel = self.channel(&target.channel_id)?;
        tracing::info!(channel = %channel.id, app = ?target.app_id, "problem report (not sent before M7)");
        Ok(if channel.trust == TrustLevel::Official {
            ReportReceipt::Paparats
        } else {
            ReportReceipt::Author {
                channel_name: channel.name,
                author: channel.author,
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::super::testing::state;
    use super::*;

    fn ids(subs: &[ChannelSubscription]) -> Vec<&str> {
        subs.iter().map(|s| s.channel_id.as_str()).collect()
    }

    #[tokio::test]
    async fn channels_and_subscriptions() {
        let (s, _) = state();
        assert_eq!(s.get_channels().unwrap().len(), 6);
        assert_eq!(
            ids(&s.get_subscriptions().unwrap()),
            ["paparats", "nilesoft", "fossfriends"]
        );
        let subs = s.subscribe_channel("winaero").unwrap();
        assert_eq!(ids(&subs).last(), Some(&"winaero"));
        assert!(matches!(
            s.subscribe_channel("ghost"),
            Err(AppError::NotFound(_))
        ));
        let subs = s.unsubscribe_channel("winaero").unwrap();
        assert_eq!(subs.len(), 3);
        assert!(matches!(
            s.unsubscribe_channel(OFFICIAL_CHANNEL),
            Err(AppError::Invalid(_))
        ));
        assert!(matches!(
            s.set_channel_paused(OFFICIAL_CHANNEL, true),
            Err(AppError::Invalid(_))
        ));
        let subs = s.set_channel_paused("nilesoft", true).unwrap();
        assert!(subs[1].paused);
        assert!(matches!(
            s.set_channel_paused("winaero", true),
            Err(AppError::NotFound(_))
        ));
        let subs = s.acknowledge_stale("fossfriends").unwrap();
        assert!(subs[2].stale_acknowledged);
        assert!(matches!(
            s.acknowledge_stale("winaero"),
            Err(AppError::NotFound(_))
        ));
    }

    #[tokio::test]
    async fn lookup_follows_the_prototype() {
        let (s, _) = state();
        assert!(matches!(
            s.lookup_channel("https://www.Winaero.com/paparats/").unwrap(),
            ChannelLookup::Found { channel } if channel.id == "winaero"
        ));
        assert!(matches!(
            s.lookup_channel("@nilesoft").unwrap(),
            ChannelLookup::AlreadySubscribed { channel } if channel.id == "nilesoft"
        ));
        assert_eq!(
            s.lookup_channel("nothing.here").unwrap(),
            ChannelLookup::NotFound
        );
        assert_eq!(s.lookup_channel("  ").unwrap(), ChannelLookup::NotFound);
    }

    #[tokio::test]
    async fn sync_reports_outages_and_stamps_today() {
        let (s, _) = state();
        // fossfriends has been down since 2026-08-30; the fixed clock says 2026-09-15.
        assert_eq!(
            s.sync_channel("fossfriends").unwrap(),
            SyncOutcome::Unreachable { days: 16 }
        );
        assert_eq!(
            s.sync_channel("winaero").unwrap(),
            SyncOutcome::Synced {
                at: "2026-09-15".into()
            }
        );
        let winaero = s
            .get_channels()
            .unwrap()
            .into_iter()
            .find(|c| c.id == "winaero")
            .unwrap();
        assert_eq!(
            winaero.synced.as_deref(),
            Some("2026-09-15"),
            "was never synced"
        );
        assert!(matches!(
            s.sync_channel("ghost"),
            Err(AppError::NotFound(_))
        ));
    }

    #[tokio::test]
    async fn reports_route_by_trust() {
        let (s, _) = state();
        let official = ReportTarget {
            app_id: Some("vlc".into()),
            channel_id: "paparats".into(),
        };
        assert_eq!(
            s.report_problem(&official, "crashes").unwrap(),
            ReportReceipt::Paparats
        );
        let nilesoft = ReportTarget {
            app_id: None,
            channel_id: "nilesoft".into(),
        };
        assert_eq!(
            s.report_problem(&nilesoft, "text").unwrap(),
            ReportReceipt::Author {
                channel_name: "Nilesoft".into(),
                author: "Nilesoft".into()
            }
        );
        let ghost = ReportTarget {
            app_id: None,
            channel_id: "ghost".into(),
        };
        assert!(matches!(
            s.report_problem(&ghost, "x"),
            Err(AppError::NotFound(_))
        ));
    }
}
