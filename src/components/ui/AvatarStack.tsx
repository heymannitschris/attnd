import type { EventPerson } from "@/types/event";
import { Avatar } from "./Avatar";

export function AvatarStack({ people, total, size = 32 }: { people: readonly EventPerson[]; total?: number; size?: number }) {
  return <span className="inline-flex shrink-0 -space-x-2">
    {people.map((person) => <Avatar key={person.id} name={person.name} portrait={person.portrait} avatarUrl={person.avatarUrl} size={size} />)}
    {total !== undefined && total > people.length && <span className="relative flex items-center justify-center rounded-full border border-white/20 bg-[#000000] text-[10px] font-medium" style={{ width: size, height: size }}>+{total - people.length}</span>}
  </span>;
}
