export function SwipeFeedback({ direction, progress, committed }: {
  direction: "left" | "right" | null;
  progress: number;
  committed: boolean;
}) {
  const scale = 0.82 + progress * 0.18;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[1.25rem]">
      <span className="discover-swipe-decision is-go" data-committed={committed && direction === "right"} style={{ opacity: direction === "right" ? progress : 0, transform: `translate(-50%, -50%) rotate(-5deg) scale(${scale})` }}>GO</span>
      <span className="discover-swipe-decision is-no" data-committed={committed && direction === "left"} style={{ opacity: direction === "left" ? progress : 0, transform: `translate(-50%, -50%) rotate(5deg) scale(${scale})` }}>NOT GO</span>
    </div>
  );
}
