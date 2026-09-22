import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useServices } from "@/services/registry";
import type { AppId, ChannelId, Idea, IdeaActor, IdeaDraft } from "@/services/types";
import { queryKeys } from "./keys";

export function useIdeas(): UseQueryResult<Idea[]> {
  const { ideas } = useServices();
  return useQuery({ queryKey: queryKeys.ideas, queryFn: () => ideas.getIdeas() });
}

/** Replaces `idea` in the list by id; a new idea goes to the top (like the prototype). */
export function upsertIdea(list: readonly Idea[], idea: Idea): Idea[] {
  return list.some((i) => i.id === idea.id)
    ? list.map((i) => (i.id === idea.id ? idea : i))
    : [idea, ...list];
}

export interface IdeaActions {
  vote(ideaId: string): Promise<Idea>;
  propose(draft: IdeaDraft): Promise<Idea>;
  comment(ideaId: string, text: string, actor: IdeaActor): Promise<Idea>;
  take(ideaId: string, channelId: ChannelId): Promise<Idea>;
  release(ideaId: string, appId: AppId, version: string): Promise<Idea>;
  dismissReleaseNote(ideaId: string): Promise<Idea>;
}

export function useIdeaActions(): IdeaActions {
  const { ideas } = useServices();
  const queryClient = useQueryClient();
  return useMemo(() => {
    const write = async (pending: Promise<Idea>) => {
      const idea = await pending;
      queryClient.setQueryData<Idea[]>(queryKeys.ideas, (list) => list && upsertIdea(list, idea));
      return idea;
    };
    return {
      vote: (ideaId) => write(ideas.vote(ideaId)),
      propose: (draft) => write(ideas.propose(draft)),
      comment: (ideaId, text, actor) => write(ideas.comment(ideaId, text, actor)),
      take: (ideaId, channelId) => write(ideas.take(ideaId, channelId)),
      release: (ideaId, appId, version) => write(ideas.release(ideaId, appId, version)),
      dismissReleaseNote: (ideaId) => write(ideas.dismissReleaseNote(ideaId)),
    };
  }, [ideas, queryClient]);
}
