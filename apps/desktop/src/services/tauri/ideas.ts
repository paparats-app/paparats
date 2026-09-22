// No ideas commands in bindings.ts yet: every method delegates to the mock. To switch one,
// replace its body with `unwrap(commands.<name>(…))` (see ./result.ts).
import type { IdeasService } from "../contracts";

export function createTauriIdeasService(mock: IdeasService): IdeasService {
  return {
    getIdeas: () => mock.getIdeas(),
    vote: (ideaId) => mock.vote(ideaId),
    propose: (draft) => mock.propose(draft),
    comment: (ideaId, text, actor) => mock.comment(ideaId, text, actor),
    take: (ideaId, channelId) => mock.take(ideaId, channelId),
    release: (ideaId, appId, version) => mock.release(ideaId, appId, version),
    dismissReleaseNote: (ideaId) => mock.dismissReleaseNote(ideaId),
  };
}
