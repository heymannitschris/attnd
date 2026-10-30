"use client";

import { useState } from "react";
import { createRoot } from "react-dom/client";

/**
 * In-page replacements for window.confirm / window.prompt.
 * The iOS WKWebView shell has no WKUIDelegate JS panel handlers, so native
 * confirm()/prompt()/alert() return immediately without showing anything.
 */
type DialogOptions = { title?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type PromptOptions = DialogOptions & { defaultValue?: string; placeholder?: string };

function mount<T>(render: (done: (value: T) => void) => React.ReactNode): Promise<T> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (value: T) => { resolve(value); setTimeout(() => { root.unmount(); host.remove(); }, 0); };
    root.render(render(done));
  });
}

function Dialog({ message, options, input, onDone }: { message: string; options: PromptOptions; input: boolean; onDone: (value: string | null) => void }) {
  const [value, setValue] = useState(options.defaultValue || "");
  return <div className="app-dialog-backdrop" onClick={() => onDone(null)}>
    <div className="app-dialog" role="alertdialog" aria-modal="true" aria-label={options.title || message} onClick={(event) => event.stopPropagation()}>
      {options.title && <p className="app-dialog-title">{options.title}</p>}
      <p className="app-dialog-message">{message}</p>
      {input && <input autoFocus value={value} placeholder={options.placeholder} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onDone(value); }} />}
      <div className="app-dialog-actions">
        <button type="button" onClick={() => onDone(null)}>{options.cancelLabel || "Cancel"}</button>
        <button type="button" data-destructive={options.destructive || undefined} onClick={() => onDone(input ? value : "")}>{options.confirmLabel || "OK"}</button>
      </div>
    </div>
  </div>;
}

export function confirmDialog(message: string, options: DialogOptions = {}): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return mount<boolean>((done) => <Dialog message={message} options={options} input={false} onDone={(value) => done(value !== null)} />);
}

export function promptDialog(message: string, options: PromptOptions = {}): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return mount<string | null>((done) => <Dialog message={message} options={options} input onDone={done} />);
}
