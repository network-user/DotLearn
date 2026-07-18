import tracksData from './tracks.data.json';

export interface Track {
  id: string;
  title: string;
  description: string;
  targetRole?: string;
  topicSlugs: string[];
  optionalSlugs?: string[];
}

export const tracks: readonly Track[] = tracksData as Track[];

export const getTrack = (id: string): Track | undefined => tracks.find((track) => track.id === id);

export const trackMemberSlugs = (track: Track): string[] => [
  ...track.topicSlugs,
  ...(track.optionalSlugs ?? []),
];
