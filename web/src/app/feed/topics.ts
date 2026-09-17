// The exact set of allowed values for posts.topic (see the
// posts_topic_check CHECK constraint in the matching migration) --
// keep these two lists in sync. Shared by FeedComposer.tsx (the picker)
// and ReelInfo.tsx (the badge) so there is one source of truth for the
// label list.
export const TOPICS = [
  "Crops",
  "Livestock",
  "Machinery",
  "Irrigation",
  "Harvesting",
  "Farming Business",
  "Farming Tips",
  "Farm Tours",
  "Farm Life",
] as const;

export type Topic = (typeof TOPICS)[number];

export function isTopic(value: string): value is Topic {
  return (TOPICS as readonly string[]).includes(value);
}
