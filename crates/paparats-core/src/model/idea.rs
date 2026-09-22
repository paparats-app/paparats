//! The Ideas board: proposals, votes, discussion, the open → work → released flow.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::catalog::{AppId, CategoryId, ChannelId};
use super::text::{IsoDate, Text};

/// `New` — an app nobody has built yet; `App` — an improvement to an existing app.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum IdeaKind {
    New,
    App,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum IdeaStatus {
    Open,
    Work,
    Released,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IdeaComment {
    /// Display name; absent for the signed-in user's own comments (`mine`).
    pub author: Option<String>,
    /// Channel the commenter speaks for → "Developer · <Channel>" badge.
    pub dev: Option<ChannelId>,
    /// Written by the signed-in user.
    pub mine: bool,
    pub date: IsoDate,
    pub text: Text,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Idea {
    pub id: String,
    pub kind: IdeaKind,
    /// Category of a `New` idea.
    pub category: Option<CategoryId>,
    /// App an `App` idea improves.
    pub app_id: Option<AppId>,
    /// Display name of the author; absent when `mine`.
    pub author: Option<String>,
    /// Proposed by the signed-in user.
    pub mine: bool,
    pub date: IsoDate,
    pub votes: u32,
    /// The signed-in user has voted.
    pub voted: bool,
    pub status: IdeaStatus,
    pub title: Text,
    pub body: Text,
    pub comments: Vec<IdeaComment>,
    /// Channel of the developer who took the idea.
    pub dev: Option<ChannelId>,
    /// Developer name for catalog publishers without a channel.
    pub dev_name: Option<String>,
    pub taken_at: Option<IsoDate>,
    pub released_at: Option<IsoDate>,
    /// App that shipped a `New` idea (an `App` idea ships in `app_id`).
    pub released_app_id: Option<AppId>,
    pub released_version: Option<String>,
    /// The author dismissed the "Your idea became an app" note.
    pub release_note_dismissed: bool,
}

/// "Suggest an idea" dialog payload.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IdeaDraft {
    pub kind: IdeaKind,
    pub app_id: Option<AppId>,
    pub category: Option<CategoryId>,
    pub title: String,
    pub body: String,
}

/// Minimum title length accepted by `propose`.
pub const IDEA_TITLE_MIN_CHARS: usize = 6;

/// Who is acting on the board: the signed-in user, or a channel developer (developer view).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum IdeaActor {
    User,
    Developer { channel_id: ChannelId },
}
