import { ServiceError } from "../errors";
import type { IdeasService } from "../contracts";
import { IDEA_TITLE_MIN_CHARS } from "../types";
import type { Idea, IdeaComment } from "../types";
import { mustFind, requireText } from "./runtime";
import type { MockContext } from "./runtime";
import type { MockWorld } from "./world";

export function createMockIdeasService(world: MockWorld, ctx: MockContext): IdeasService {
  let counter = 0;
  const idea = (id: string) => mustFind(world.ideas, (i) => i.id === id, `Idea ${id}`);
  const nextId = () => {
    let id: string;
    do id = `u${++counter}`;
    while (world.ideas.some((i) => i.id === id));
    return id;
  };

  return {
    getIdeas: () => ctx.respond(() => world.ideas),

    vote: (ideaId) =>
      ctx.respond(() => {
        const i = idea(ideaId);
        i.votes += i.voted ? -1 : 1;
        i.voted = !i.voted;
        return i;
      }),

    propose: (draft) =>
      ctx.respond(() => {
        const title = draft.title.trim();
        if (title.length < IDEA_TITLE_MIN_CHARS) {
          throw new ServiceError("invalid", `Idea title is shorter than ${IDEA_TITLE_MIN_CHARS}`);
        }
        const created: Idea = {
          id: nextId(),
          kind: draft.kind,
          category: draft.kind === "new" ? draft.category : null,
          appId: draft.kind === "app" ? draft.appId : null,
          author: null,
          mine: true,
          date: ctx.today,
          votes: 1,
          voted: true,
          status: "open",
          title,
          body: draft.body.trim(),
          comments: [],
          dev: null,
          devName: null,
          takenAt: null,
          releasedAt: null,
          releasedAppId: null,
          releasedVersion: null,
          releaseNoteDismissed: false,
        };
        world.ideas.unshift(created);
        return created;
      }),

    comment: (ideaId, text, actor) =>
      ctx.respond(() => {
        const i = idea(ideaId);
        const base = { date: ctx.today, text: requireText(text, "Comment") };
        let comment: IdeaComment;
        if (actor.kind === "developer") {
          const ch = mustFind(world.channels, (c) => c.id === actor.channelId, "Channel");
          comment = { ...base, author: ch.author, dev: ch.id, mine: false };
        } else {
          comment = { ...base, author: null, dev: null, mine: true };
        }
        i.comments.push(comment);
        return i;
      }),

    take: (ideaId, channelId) =>
      ctx.respond(() => {
        const i = idea(ideaId);
        if (i.status !== "open") throw new ServiceError("invalid", `Idea ${ideaId} is not open`);
        const taken = {
          status: "work",
          dev: channelId,
          devName: null,
          takenAt: ctx.today,
        } satisfies Partial<Idea>;
        return Object.assign(i, taken);
      }),

    release: (ideaId, appId, version) =>
      ctx.respond(() => {
        const i = idea(ideaId);
        const released = {
          status: "released",
          releasedAt: ctx.today,
          releasedAppId: appId,
          releasedVersion: requireText(version, "Version"),
        } satisfies Partial<Idea>;
        return Object.assign(i, released);
      }),

    dismissReleaseNote: (ideaId) =>
      ctx.respond(() => {
        const i = idea(ideaId);
        i.releaseNoteDismissed = true;
        return i;
      }),
  };
}
