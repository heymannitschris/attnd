import { Fragment, type ReactNode } from "react";

const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;

export function linkify(text: string | null | undefined): ReactNode {
  if (!text) return text;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const href = m[2] || m[3];
    const label = m[1] || m[3];
    const internal = href.startsWith("https://www.attnd.space") || href.startsWith("https://attnd.space");
    out.push(<a key={i} href={internal ? href.replace(/^https:\/\/(www\.)?attnd\.space/, "") || "/" : href} target={internal ? undefined : "_blank"} rel={internal ? undefined : "noopener noreferrer"} style={{ textDecoration: "underline", color: "inherit", fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>{label}</a>);
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}
