"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { translateAppText, type AppLanguage } from "@/lib/app-translations";

type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void };
const LanguageContext = createContext<LanguageContextValue>({ language: "en", setLanguage: () => {} });
const STORAGE_KEY = "attnd:language";
const textOrigins = new WeakMap<Text, { original: string; displayed: string }>();
const attributeOrigins = new WeakMap<Element, Map<string, { original: string; displayed: string }>>();
const attributes = ["placeholder", "aria-label", "title"] as const;

function localizeNode(node: Text, language: AppLanguage) {
  if (node.parentElement?.closest("script, style, textarea, [contenteditable], [data-no-translate]")) return;
  const current = node.nodeValue || "";
  const previous = textOrigins.get(node);
  const original = previous && current === previous.displayed ? previous.original : current;
  const displayed = translateAppText(original, language);
  textOrigins.set(node, { original, displayed });
  if (displayed !== current) node.nodeValue = displayed;
}

function localizeAttributes(element: Element, language: AppLanguage) {
  if (element.closest("[data-no-translate]")) return;
  let stored = attributeOrigins.get(element);
  if (!stored) { stored = new Map(); attributeOrigins.set(element, stored); }
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    const previous = stored.get(attribute);
    const original = previous && current === previous.displayed ? previous.original : current;
    const displayed = translateAppText(original, language);
    stored.set(attribute, { original, displayed });
    if (displayed !== current) element.setAttribute(attribute, displayed);
  }
}

function localizeTree(root: Node, language: AppLanguage) {
  if (root.nodeType === Node.TEXT_NODE) { localizeNode(root as Text, language); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  if (element.matches("script, style, [data-no-translate]")) return;
  localizeAttributes(element, language);
  element.querySelectorAll("[placeholder], [aria-label], [title]").forEach((item) => localizeAttributes(item, language));
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) localizeNode(walker.currentNode as Text, language);
}

export function useAppLanguage() { return useContext(LanguageContext); }

export function AppLanguageProvider({ children, preview = false }: { children: ReactNode; preview?: boolean }) {
  const [language, setCurrentLanguage] = useState<AppLanguage>("en");
  const setLanguage = useCallback((next: AppLanguage) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setCurrentLanguage(next);
  }, []);

  useEffect(() => {
    if (preview) return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "th") { setCurrentLanguage(saved); return; }
    if (!hasSupabaseConfig) return;
    let active = true;
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active || window.localStorage.getItem(STORAGE_KEY)) return;
      const { data } = await supabase.from("profiles").select("language").eq("id", user.id).maybeSingle();
      if (active && data?.language === "ภาษาไทย") setLanguage("th");
    })();
    return () => { active = false; };
  }, [preview, setLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
    const root = document.querySelector(".app-mobile-only");
    if (!(root instanceof Element) || !root.isConnected) return;
    localizeTree(root, language);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") localizeNode(record.target as Text, language);
        else if (record.type === "attributes") localizeAttributes(record.target as Element, language);
        else record.addedNodes.forEach((node) => localizeTree(node, language));
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes] });
    return () => observer.disconnect();
  }, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
