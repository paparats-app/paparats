//! IdeasService: the board. Idea text is user content and is never logged.

use paparats_core::{
    IDEA_TITLE_MIN_CHARS, Idea, IdeaActor, IdeaComment, IdeaDraft, IdeaKind, IdeaStatus, Text,
};

use super::AppState;
use crate::error::{AppError, AppResult};

/// The trimmed text, or `invalid` when it is empty.
fn required(value: &str, what: &str) -> AppResult<String> {
    let text = value.trim();
    if text.is_empty() {
        Err(AppError::invalid(format!("{what} is empty")))
    } else {
        Ok(text.to_owned())
    }
}

impl AppState {
    pub fn get_ideas(&self) -> AppResult<Vec<Idea>> {
        Ok(self.storage.ideas()?)
    }

    /// Toggles the signed-in user's vote.
    pub fn vote_idea(&self, idea_id: &str) -> AppResult<Idea> {
        self.storage.update_idea(idea_id, |i| {
            if i.voted {
                i.votes = i.votes.saturating_sub(1);
            } else {
                i.votes = i.votes.saturating_add(1);
            }
            i.voted = !i.voted;
            Ok::<_, AppError>(())
        })
    }

    /// Publishes an idea as the signed-in user: `mine`, open, 1 vote (voted), at the top of the
    /// board, id `u<n>`. A trimmed title shorter than `IDEA_TITLE_MIN_CHARS` is `invalid`.
    pub fn propose_idea(&self, draft: &IdeaDraft) -> AppResult<Idea> {
        let title = draft.title.trim();
        if title.chars().count() < IDEA_TITLE_MIN_CHARS {
            return Err(AppError::invalid(format!(
                "idea title is shorter than {IDEA_TITLE_MIN_CHARS} characters"
            )));
        }
        let today = self.today();
        self.storage.insert_idea_first(|taken| {
            let id = (1_u64..)
                .map(|n| format!("u{n}"))
                .find(|id| !taken(id))
                .ok_or_else(|| AppError::invalid("no free idea id"))?;
            Ok::<_, AppError>(Idea {
                id,
                kind: draft.kind,
                category: match draft.kind {
                    IdeaKind::New => draft.category,
                    IdeaKind::App => None,
                },
                app_id: match draft.kind {
                    IdeaKind::App => draft.app_id.clone(),
                    IdeaKind::New => None,
                },
                author: None,
                mine: true,
                date: today,
                votes: 1,
                voted: true,
                status: IdeaStatus::Open,
                title: Text::Plain(title.to_owned()),
                body: Text::Plain(draft.body.trim().to_owned()),
                comments: Vec::new(),
                dev: None,
                dev_name: None,
                taken_at: None,
                released_at: None,
                released_app_id: None,
                released_version: None,
                release_note_dismissed: false,
            })
        })
    }

    /// Adds a comment as the signed-in user, or as a channel developer (developer view).
    pub fn comment_idea(&self, idea_id: &str, text: &str, actor: &IdeaActor) -> AppResult<Idea> {
        if self.storage.idea(idea_id)?.is_none() {
            return Err(AppError::not_found(format!("idea {idea_id}")));
        }
        let text = required(text, "comment")?;
        let (author, dev, mine) = match actor {
            IdeaActor::User => (None, None, true),
            IdeaActor::Developer { channel_id } => {
                let channel = self.channel(channel_id)?;
                (Some(channel.author), Some(channel.id), false)
            }
        };
        let comment = IdeaComment {
            author,
            dev,
            mine,
            date: self.today(),
            text: Text::Plain(text),
        };
        self.storage.update_idea(idea_id, |i| {
            i.comments.push(comment);
            Ok::<_, AppError>(())
        })
    }

    /// Developer view: pins an open idea to a channel (status → work).
    pub fn take_idea(&self, idea_id: &str, channel_id: &str) -> AppResult<Idea> {
        let today = self.today();
        self.storage.update_idea(idea_id, |i| {
            if i.status != IdeaStatus::Open {
                return Err(AppError::invalid(format!("idea {idea_id} is not open")));
            }
            i.status = IdeaStatus::Work;
            i.dev = Some(channel_id.to_owned());
            i.dev_name = None;
            i.taken_at = Some(today);
            Ok(())
        })
    }

    /// Developer view: marks an idea released in `app_id` at `version` (trimmed, required).
    pub fn release_idea(&self, idea_id: &str, app_id: &str, version: &str) -> AppResult<Idea> {
        let today = self.today();
        self.storage.update_idea(idea_id, |i| {
            let version = required(version, "version")?;
            i.status = IdeaStatus::Released;
            i.released_at = Some(today);
            i.released_app_id = Some(app_id.to_owned());
            i.released_version = Some(version);
            Ok(())
        })
    }

    /// The author dismissed the "Your idea became an app" note.
    pub fn dismiss_release_note(&self, idea_id: &str) -> AppResult<Idea> {
        self.storage.update_idea(idea_id, |i| {
            i.release_note_dismissed = true;
            Ok::<_, AppError>(())
        })
    }
}

#[cfg(test)]
mod tests {
    use paparats_core::CategoryId;

    use super::super::testing::{TODAY, state};
    use super::*;

    fn draft(title: &str) -> IdeaDraft {
        IdeaDraft {
            kind: IdeaKind::New,
            app_id: Some("vlc".into()),
            category: Some(CategoryId::Utilities),
            title: title.into(),
            body: "  A body  ".into(),
        }
    }

    #[tokio::test]
    async fn propose_validates_and_goes_on_top() {
        let (s, _) = state();
        assert!(matches!(
            s.propose_idea(&draft("  short ")),
            Err(AppError::Invalid(_))
        ));
        assert!(matches!(
            s.propose_idea(&draft("Ёжик.")),
            Err(AppError::Invalid(_))
        ));
        let idea = s.propose_idea(&draft("  Tray timer  ")).unwrap();
        assert_eq!(idea.id, "u1");
        assert_eq!(idea.title, Text::Plain("Tray timer".into()));
        assert_eq!(idea.body, Text::Plain("A body".into()));
        assert_eq!(idea.category, Some(CategoryId::Utilities));
        assert_eq!(idea.app_id, None, "only app ideas keep an app");
        assert!(idea.mine && idea.voted);
        assert_eq!((idea.votes, idea.status), (1, IdeaStatus::Open));
        assert_eq!(idea.date, TODAY);
        assert!(
            s.propose_idea(&draft("Six ch")).is_ok(),
            "exactly 6 characters"
        );

        let app_idea = s
            .propose_idea(&IdeaDraft {
                kind: IdeaKind::App,
                ..draft("Dark theme for VLC")
            })
            .unwrap();
        assert_eq!(app_idea.id, "u3");
        assert_eq!(app_idea.app_id.as_deref(), Some("vlc"));
        assert_eq!(app_idea.category, None);
        let board: Vec<String> = s.get_ideas().unwrap().into_iter().map(|i| i.id).collect();
        assert_eq!(&board[..4], ["u3", "u2", "u1", "clip"]);
    }

    #[tokio::test]
    async fn votes_toggle() {
        let (s, _) = state();
        let votes = s.get_ideas().unwrap()[0].votes;
        let i = s.vote_idea("clip").unwrap();
        assert_eq!((i.votes, i.voted), (votes + 1, true));
        let i = s.vote_idea("clip").unwrap();
        assert_eq!((i.votes, i.voted), (votes, false));
        assert!(matches!(s.vote_idea("ghost"), Err(AppError::NotFound(_))));
    }

    #[tokio::test]
    async fn comments_as_user_and_developer() {
        let (s, _) = state();
        let before = s.storage.idea("clip").unwrap().unwrap().comments.len();
        let i = s.comment_idea("clip", "  +1 ", &IdeaActor::User).unwrap();
        let c = i.comments.last().unwrap();
        assert_eq!(c.text, Text::Plain("+1".into()));
        assert!(c.mine && c.author.is_none() && c.dev.is_none());
        let dev = IdeaActor::Developer {
            channel_id: "nilesoft".into(),
        };
        let i = s.comment_idea("clip", "On it", &dev).unwrap();
        let c = i.comments.last().unwrap();
        assert_eq!(c.author.as_deref(), Some("Nilesoft"));
        assert_eq!(c.dev.as_deref(), Some("nilesoft"));
        assert!(!c.mine);
        assert_eq!(c.date, TODAY);
        assert_eq!(i.comments.len(), before + 2);

        assert!(matches!(
            s.comment_idea("clip", "   ", &IdeaActor::User),
            Err(AppError::Invalid(_))
        ));
        assert!(matches!(
            s.comment_idea("ghost", "x", &IdeaActor::User),
            Err(AppError::NotFound(_))
        ));
        let ghost = IdeaActor::Developer {
            channel_id: "ghost".into(),
        };
        assert!(matches!(
            s.comment_idea("clip", "x", &ghost),
            Err(AppError::NotFound(_))
        ));
    }

    #[tokio::test]
    async fn take_release_and_dismiss() {
        let (s, _) = state();
        let i = s.take_idea("clip", "nilesoft").unwrap();
        assert_eq!(i.status, IdeaStatus::Work);
        assert_eq!(i.dev.as_deref(), Some("nilesoft"));
        assert_eq!(i.taken_at.as_deref(), Some(TODAY));
        assert!(matches!(
            s.take_idea("clip", "nilesoft"),
            Err(AppError::Invalid(_))
        ));
        assert!(matches!(
            s.release_idea("clip", "shell", "  "),
            Err(AppError::Invalid(_))
        ));
        let i = s.release_idea("clip", "shell", " 1.9.16 ").unwrap();
        assert_eq!(i.status, IdeaStatus::Released);
        assert_eq!(i.released_app_id.as_deref(), Some("shell"));
        assert_eq!(i.released_version.as_deref(), Some("1.9.16"));
        assert_eq!(i.released_at.as_deref(), Some(TODAY));
        let i = s.dismiss_release_note("slounik").unwrap();
        assert!(i.release_note_dismissed);
        assert!(matches!(
            s.dismiss_release_note("ghost"),
            Err(AppError::NotFound(_))
        ));
    }
}
