//! The GitHub REST API, read-only: repository facts, the release to ship, `FUNDING.yml`, and
//! release-file downloads (hashed while they stream to disk). With `GITHUB_TOKEN` the limit is
//! 5 000 requests an hour; without it, 60.

use std::path::Path;

use serde::Deserialize;
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;

use crate::BotError;
use crate::spec::SourceSpec;

const API: &str = "https://api.github.com";

pub struct GitHub {
    http: reqwest::Client,
    token: Option<String>,
}

/// The parts of `GET /repos/{repo}` the catalog uses.
#[derive(Debug, Clone, Deserialize)]
pub struct RepoInfo {
    pub stargazers_count: u32,
    pub created_at: String,
    pub homepage: Option<String>,
    pub archived: bool,
    pub license: Option<License>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct License {
    pub spdx_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub draft: bool,
    pub prerelease: bool,
    pub published_at: Option<String>,
    pub created_at: Option<String>,
    pub body: Option<String>,
    pub assets: Vec<Asset>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Asset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
    /// `sha256:<hex>` on releases GitHub has hashed.
    pub digest: Option<String>,
}

impl ReleaseInfo {
    /// The publication date (`YYYY-MM-DD`).
    pub fn date(&self) -> String {
        self.published_at
            .as_deref()
            .or(self.created_at.as_deref())
            .map(|d| d.chars().take(10).collect())
            .unwrap_or_default()
    }
}

impl GitHub {
    pub fn new(token: Option<String>) -> Result<Self, BotError> {
        let http = reqwest::Client::builder()
            .user_agent("paparats-catalog-bot")
            .build()
            .map_err(|e| BotError::Http(format!("client: {e}")))?;
        Ok(Self { http, token })
    }

    fn get(&self, url: &str) -> reqwest::RequestBuilder {
        let mut request = self
            .http
            .get(url)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28");
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        request
    }

    /// `None` on 404.
    async fn json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<Option<T>, BotError> {
        let url = format!("{API}{path}");
        let response = self
            .get(&url)
            .send()
            .await
            .map_err(|e| BotError::Http(format!("{path}: {e}")))?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(BotError::Http(format!(
                "{path}: HTTP {}",
                response.status()
            )));
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|e| BotError::Http(format!("{path}: {e}")))?;
        serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|e| BotError::Http(format!("{path}: {e}")))
    }

    pub async fn repo(&self, repo: &str) -> Result<RepoInfo, BotError> {
        self.json(&format!("/repos/{repo}"))
            .await?
            .ok_or_else(|| BotError::Http(format!("{repo}: no such repository")))
    }

    /// The release to ship: the latest stable one, or — with a tag prefix or pre-releases
    /// allowed — the newest matching one of the last 30.
    pub async fn release(&self, source: &SourceSpec) -> Result<ReleaseInfo, BotError> {
        let repo = &source.repo;
        if source.tag_prefix.is_none() && !source.prerelease {
            return self
                .json(&format!("/repos/{repo}/releases/latest"))
                .await?
                .ok_or_else(|| BotError::Http(format!("{repo}: no published release")));
        }
        let releases: Vec<ReleaseInfo> = self
            .json(&format!("/repos/{repo}/releases?per_page=30"))
            .await?
            .unwrap_or_default();
        releases
            .into_iter()
            .filter(|r| !r.draft && (source.prerelease || !r.prerelease))
            .find(|r| {
                source
                    .tag_prefix
                    .as_deref()
                    .is_none_or(|p| r.tag_name.starts_with(p))
            })
            .ok_or_else(|| BotError::Http(format!("{repo}: no matching release")))
    }

    /// `FUNDING.yml` of the repository, else of the owner's `.github` repository.
    pub async fn funding_file(&self, repo: &str) -> Result<Option<String>, BotError> {
        let owner = repo.split('/').next().unwrap_or_default();
        for path in [
            format!("/repos/{repo}/contents/.github/FUNDING.yml"),
            format!("/repos/{owner}/.github/contents/FUNDING.yml"),
        ] {
            #[derive(Deserialize)]
            struct Content {
                content: String,
            }
            if let Some(file) = self.json::<Content>(&path).await? {
                let packed: String = file.content.split_whitespace().collect();
                let bytes = base64_decode(&packed)
                    .ok_or_else(|| BotError::Http(format!("{path}: bad base64")))?;
                return Ok(Some(String::from_utf8_lossy(&bytes).into_owned()));
            }
        }
        Ok(None)
    }

    /// Streams `url` to `dest`, hashing as it goes. Returns the size and the lower-case SHA-256.
    pub async fn download(&self, url: &str, dest: &Path) -> Result<(u64, String), BotError> {
        let mut response = self
            .http
            .get(url)
            .send()
            .await
            .map_err(|e| BotError::Http(format!("{url}: {e}")))?;
        if !response.status().is_success() {
            return Err(BotError::Http(format!("{url}: HTTP {}", response.status())));
        }
        let mut file = tokio::fs::File::create(dest)
            .await
            .map_err(|e| BotError::io(dest, e))?;
        let mut hasher = Sha256::new();
        let mut size = 0u64;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| BotError::Http(format!("{url}: {e}")))?
        {
            hasher.update(&chunk);
            size += chunk.len() as u64;
            file.write_all(&chunk)
                .await
                .map_err(|e| BotError::io(dest, e))?;
        }
        file.flush().await.map_err(|e| BotError::io(dest, e))?;
        Ok((size, crate::text::hex(&hasher.finalize())))
    }
}

fn base64_decode(text: &str) -> Option<Vec<u8>> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.decode(text).ok()
}
