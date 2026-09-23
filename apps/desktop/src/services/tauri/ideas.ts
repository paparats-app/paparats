import { commands } from "@/bindings";
import type { IdeasService } from "../contracts";
import { unwrap } from "./result";

export function createTauriIdeasService(): IdeasService {
  return {
    getIdeas: () => unwrap(commands.ideasGet()),
    vote: (ideaId) => unwrap(commands.ideasVote(ideaId)),
    propose: (draft) => unwrap(commands.ideasPropose(draft)),
    comment: (ideaId, text, actor) => unwrap(commands.ideasComment(ideaId, text, actor)),
    take: (ideaId, channelId) => unwrap(commands.ideasTake(ideaId, channelId)),
    release: (ideaId, appId, version) => unwrap(commands.ideasRelease(ideaId, appId, version)),
    dismissReleaseNote: (ideaId) => unwrap(commands.ideasDismissReleaseNote(ideaId)),
  };
}
