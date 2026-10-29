import type { ComponentProps } from "react";
import { DiscoverIcon } from "@/components/events/DiscoverIcon";

type IconName = ComponentProps<typeof DiscoverIcon>["name"];

const interestIcons: Record<string, IconName> = {
  music: "music",
  techno: "music",
  yoga: "leaf",
  nature: "leaf",
  wellness: "leaf",
  health: "heart",
  food: "flame",
  travel: "navigation",
  adventure: "navigation",
  community: "users",
  people: "users",
  web3: "layers",
  business: "layers",
  mindset: "info",
  art: "layers",
};

export function ProfileInterestIcon({ label }: { label: string }) {
  return <DiscoverIcon name={interestIcons[label.toLowerCase()] ?? "heart"} />;
}
