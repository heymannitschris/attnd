import Image from "next/image";

export function TicketQr({ className = "", token }: { className?: string; token?: string }) {
  if (token) return <Image src={`/api/tickets/${encodeURIComponent(token)}/qr`} alt="Ticket QR code" width={180} height={180} unoptimized className={`ticket-qr-svg ${className}`} />;
  const modules = Array.from({ length: 21 * 21 }, (_, index) => {
    const x = index % 21;
    const y = Math.floor(index / 21);
    const inFinder = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    const finderOn = (ox: number, oy: number) => inFinder(ox, oy) && (x === ox || x === ox + 6 || y === oy || y === oy + 6 || (x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4));
    const finderArea = inFinder(0, 0) || inFinder(14, 0) || inFinder(0, 14);
    const on = finderArea ? finderOn(0, 0) || finderOn(14, 0) || finderOn(0, 14) : ((x * 7 + y * 11 + x * y) % 5 < 2 || (x + y) % 7 === 0);
    return on ? <rect key={index} x={x} y={y} width="1" height="1" /> : null;
  });
  return <svg viewBox="-2 -2 25 25" aria-hidden="true" className={`ticket-qr-svg ${className}`} shapeRendering="crispEdges"><rect x="-2" y="-2" width="25" height="25" rx="1" fill="white" /><g fill="black">{modules}</g></svg>;
}
