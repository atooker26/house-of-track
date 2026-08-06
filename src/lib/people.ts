// The roster — people, not channels. Hand-maintained in data/people.json; see the
// comment block at the top of that file for why it's keyed by person.
//
// The short version: of 8 podcast guests and 18 YouTube creators, exactly one
// person is both. Keying the roster on channels would leave 7 of the 8 people
// House of Track actually has a relationship with without a page.

import roster from "../../data/people.json";

export type Discipline = "Sprints" | "Distance" | "Field" | "Trail";
export type PersonKind = "athlete" | "creative" | "media";

export interface PersonAccounts {
  youtube?: { handle?: string; channelId?: string };
  faves?: string;
  instagram?: string;
}

export interface Person {
  slug: string;
  name: string;
  kind: PersonKind;
  discipline: Discipline;
  /** Episode number in the House of Track feed, if they've been on the show. */
  podcastEpisode?: number;
  dormant?: boolean;
  accounts: PersonAccounts;
}

// The JSON has heterogeneous `accounts` shapes per row, so TS infers a union that
// isn't directly comparable to Person. The file is hand-maintained against this
// interface, so assert through unknown rather than contort the data.
export const PEOPLE: Person[] = (roster.people as unknown) as Person[];

export function personBySlug(slug: string): Person | undefined {
  return PEOPLE.find((p) => p.slug === slug);
}

export interface SocialLink {
  label: string;
  url: string;
  icon: "youtube" | "instagram" | "share";
}

/** Outbound links for a person, in the order they should be shown. */
export function socialLinks(person: Person): SocialLink[] {
  const links: SocialLink[] = [];
  const yt = person.accounts.youtube;
  if (yt?.handle) {
    links.push({ label: "YouTube", url: `https://www.youtube.com/@${yt.handle}`, icon: "youtube" });
  } else if (yt?.channelId) {
    links.push({
      label: "YouTube",
      url: `https://www.youtube.com/channel/${yt.channelId}`,
      icon: "youtube",
    });
  }
  if (person.accounts.instagram) {
    links.push({
      label: "Instagram",
      url: `https://instagram.com/${person.accounts.instagram}`,
      icon: "instagram",
    });
  }
  if (person.accounts.faves) {
    links.push({ label: "Faves", url: `https://faves.xyz/@${person.accounts.faves}`, icon: "share" });
  }
  return links;
}

export const KIND_LABEL: Record<PersonKind, string> = {
  athlete: "Athlete",
  creative: "Creative",
  media: "Media",
};
