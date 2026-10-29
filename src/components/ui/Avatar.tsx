export function Avatar({ name, portrait, avatarUrl, size = 36 }: { name: string; portrait: number; avatarUrl?: string; size?: number }) {
  return (
    <span role="img" aria-label={name} className="inline-block shrink-0 rounded-full border border-white/20 bg-surface" style={{ width: size, height: size, backgroundImage: `url('${avatarUrl || "/events/people.jpg"}')`, backgroundSize: avatarUrl ? "cover" : "400% 100%", backgroundPosition: avatarUrl ? "center" : `${portrait * 33.333}% center` }} />
  );
}
