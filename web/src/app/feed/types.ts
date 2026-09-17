import type { PostMediaItem } from "@/lib/postMedia";
import type { ReelMention } from "./mentions";

// Shared shape for the vertical Reel viewer. Assembled once, server-side,
// in page.tsx from the same queries the previous card-based feed used --
// no new tables, no new RPCs, just a different presentation of the same
// data plus the follows lookup added for the Follow rail control.
export type ReelComment = {
  id: string;
  postId: string;
  profileId: string;
  authorDisplayName: string;
  body: string;
  isAuthor: boolean;
  myReactionTypes: string[];
  reactionCounts: { reaction_type: string; count: number }[];
};

export type Reel = {
  id: string;
  communityId: string | null;
  communityName: string | null;
  profileId: string;
  authorDisplayName: string;
  body: string;
  topic: string | null;
  hashtags: string[];
  mentions: ReelMention[];
  createdAt: string;
  media: PostMediaItem[];
  isAuthor: boolean;
  liked: boolean;
  likeCount: number;
  comments: ReelComment[];
  commentsFailed: boolean;
  showFollow: boolean;
  isFollowing: boolean;
};
