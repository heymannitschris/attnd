"use client";

import { useEffect, useLayoutEffect, useState } from "react";

type MarketingLanguage = "de" | "en" | "th";
const storageKey = "attnd:marketing-language";
const originals = new WeakMap<Text, string>();

const translations: Record<string, { en: string; th: string }> = {
  "Community": { en: "Community", th: "ชุมชน" },
  "Funktionen": { en: "Features", th: "ฟีเจอร์" },
  "So funktioniert’s": { en: "How it works", th: "วิธีใช้งาน" },
  "Herunterladen": { en: "Download", th: "ดาวน์โหลด" },
  "DIE APP FÜR EVENTVERANSTALTER": { en: "THE APP FOR EVENT HOSTS", th: "แอปสำหรับผู้จัดอีเวนต์" },
  "Dein Event.": { en: "Your event.", th: "อีเวนต์ของคุณ" },
  "Deine Leute.": { en: "Your people.", th: "ผู้คนของคุณ" },
  "Ein Ort.": { en: "One place.", th: "ครบในที่เดียว" },
  "Plane dein Event, erreiche Menschen in der Attnd-Community und behalte Tickets, Team und Einlass im Griff.": { en: "Plan your event, reach the Attnd community and manage tickets, your team and entry in one place.", th: "วางแผนอีเวนต์ เข้าถึงชุมชน Attnd และจัดการตั๋ว ทีม และการเข้างานในที่เดียว" },
  "Plane dein Event, erreiche Menschen in der Attnd-Community und behalte alles im Griff.": { en: "Plan your event, reach the Attnd community and keep everything under control.", th: "วางแผนอีเวนต์ เข้าถึงชุมชน Attnd และจัดการทุกอย่างได้อย่างง่ายดาย" },
  "Tickets & Zahlungen": { en: "Tickets & payments", th: "ตั๋วและการชำระเงิน" },
  "Community-Reichweite": { en: "Community reach", th: "เข้าถึงชุมชน" },
  "Co-Hosts & Affiliates": { en: "Co-hosts & affiliates", th: "ผู้ร่วมจัดและแอฟฟิลิเอต" },
  "QR-Check-in": { en: "QR check-in", th: "เช็กอินด้วย QR" },
  "Event starten": { en: "Start an event", th: "เริ่มสร้างอีเวนต์" },
  "ENTDECKEN": { en: "DISCOVER", th: "ค้นพบ" },
  "VERKAUFEN": { en: "SELL", th: "ขาย" },
  "ERLEBEN": { en: "EXPERIENCE", th: "สัมผัสประสบการณ์" },
  "Alles im Blick": { en: "Everything in view", th: "ดูทุกอย่างได้ครบ" },
  "Einlass bereit": { en: "Ready for entry", th: "พร้อมเช็กอิน" },
  "Echte App-Oberfläche · Beispieldaten": { en: "Real app interface · Sample data", th: "หน้าจอแอปจริง · ข้อมูลตัวอย่าง" },
  "EVENTS, DIE MENSCHEN FINDEN": { en: "EVENTS PEOPLE DISCOVER", th: "อีเวนต์ที่ผู้คนค้นพบ" },
  "DEIN VORTEIL ALS HOST": { en: "YOUR ADVANTAGE AS A HOST", th: "ข้อได้เปรียบสำหรับผู้จัด" },
  "Das Tinder": { en: "Tinder", th: "Tinder" },
  "für": { en: "for", th: "สำหรับ" },
  "Events.": { en: "events.", th: "อีเวนต์" },
  "Die Community": { en: "The community", th: "ชุมชน" },
  "ist": { en: "is", th: "พร้อม" },
  "schon da.": { en: "already here.", th: "อยู่แล้ว" },
  "Attnd ist das Tinder für Events: Menschen entdecken Erlebnisse beim Swipen, speichern ihre Favoriten und finden direkt zum Ticket. Als Veranstalter musst du deine Gäste nicht nur über eigene Kanäle erreichen.": { en: "Attnd is Tinder for events: people swipe through experiences, save favorites and go straight to tickets. Hosts can reach guests beyond their own channels.", th: "Attnd คือ Tinder สำหรับอีเวนต์ ผู้คนปัดหาอีเวนต์ บันทึกรายการโปรด และซื้อตั๋วได้ทันที ผู้จัดจึงเข้าถึงผู้ชมได้มากกว่าช่องทางของตนเอง" },
  "Entdecke deine Möglichkeiten": { en: "Explore your possibilities", th: "ดูความเป็นไปได้ของคุณ" },
  "ALLES FÜR DEIN EVENT": { en: "EVERYTHING FOR YOUR EVENT", th: "ทุกอย่างสำหรับอีเวนต์ของคุณ" },
  "Mehr Möglichkeiten.": { en: "More possibilities.", th: "ความเป็นไปได้มากขึ้น" },
  "Weniger Aufwand.": { en: "Less work.", th: "ทำงานน้อยลง" },
  "Acht Werkzeuge, eine App – alles, was du vom ersten Ticket bis zum Einlass brauchst.": { en: "Eight tools, one app — everything you need from the first ticket to entry.", th: "แปดเครื่องมือในแอปเดียว ตั้งแต่ตั๋วใบแรกจนถึงการเข้างาน" },
  "Zeig, was gerade passiert.": { en: "Show what’s happening now.", th: "ให้ทุกคนเห็นว่าตอนนี้เกิดอะไรขึ้น" },
  "Eingecheckte Gäste teilen Fotos und Videos live vom Event. Jeder Moment kann mit einem persönlichen Affiliate-Link weitergetragen werden.": { en: "Checked-in guests share live photos and videos from the event. Every moment can be shared with a personal affiliate link.", th: "ผู้เข้าร่วมที่เช็กอินแล้วแชร์ภาพและวิดีโอสดจากงานได้ ทุกโมเมนต์แชร์ต่อพร้อมลิงก์แอฟฟิลิเอตส่วนตัวได้" },
  "Deine Community ist schon da.": { en: "Your community is already here.", th: "ชุมชนของคุณพร้อมแล้ว" },
  "Dein Event wird von Menschen entdeckt, die nach Erlebnissen suchen.": { en: "People discover your event while looking for new experiences.", th: "ผู้คนค้นพบอีเวนต์ของคุณขณะมองหาประสบการณ์ใหม่" },
  "Menschen entdecken Events direkt in Attnd und swipen zum nächsten Erlebnis. Dein Event wird dort sichtbar, wo sie bereits nach Erlebnissen suchen.": { en: "People discover events directly in Attnd and swipe to their next experience. Your event appears where they already search.", th: "ผู้คนค้นพบอีเวนต์ใน Attnd และปัดหาประสบการณ์ถัดไป อีเวนต์ของคุณปรากฏตรงที่พวกเขากำลังค้นหา" },
  "Verkauf und Zahlung an einem Ort.": { en: "Sales and payments in one place.", th: "ขายและรับชำระในที่เดียว" },
  "Tickets & Zahlung": { en: "Tickets & payments", th: "ตั๋วและการชำระเงิน" },
  "Verkaufe Tickets und behalte Buchungen und Einnahmen im Blick.": { en: "Sell tickets and keep track of bookings and revenue.", th: "ขายตั๋วและติดตามการจองกับรายได้" },
  "Lege Ticketarten fest, verkaufe bezahlte oder kostenlose Plätze und behalte Bestellungen und Einnahmen im Blick.": { en: "Set ticket types, sell paid or free spots and track orders and revenue.", th: "กำหนดประเภทตั๋ว ขายตั๋วแบบชำระเงินหรือฟรี และติดตามคำสั่งซื้อกับรายได้" },
  "Gemeinsam hosten.": { en: "Host together.", th: "จัดงานร่วมกัน" },
  "Plane zusammen und teile Einnahmen mit deinem Team.": { en: "Plan together and share revenue with your team.", th: "วางแผนร่วมกันและแบ่งรายได้กับทีม" },
  "Hol Co-Hosts in dein Team und definiere, wie die Einnahmen zwischen euch aufgeteilt werden.": { en: "Bring co-hosts into your team and define how revenue is shared.", th: "เพิ่มผู้ร่วมจัดเข้าทีมและกำหนดการแบ่งรายได้" },
  "Einlass per QR-Code.": { en: "QR code entry.", th: "เข้างานด้วย QR" },
  "Scanne Tickets mit der Kamera in der App und sieh direkt, welche Gäste schon da sind.": { en: "Scan tickets with the in-app camera and instantly see who has arrived.", th: "สแกนตั๋วด้วยกล้องในแอปและดูได้ทันทีว่าใครมาถึงแล้ว" },
  "Prüfe Tickets am Eingang direkt mit der Kamera.": { en: "Verify tickets at the entrance with the camera.", th: "ตรวจตั๋วที่ทางเข้าด้วยกล้อง" },
  "Empfehlungen, die sich lohnen.": { en: "Recommendations that bring more bookings.", th: "การแนะนำที่สร้างรายได้" },
  "Dein Team. Automatisch bezahlt.": { en: "Your team. Paid automatically.", th: "ทีมของคุณ รับเงินอัตโนมัติ" },
  "Lege Rollen fest und vergüte Security, Cleaning oder Management per Fixbetrag oder Umsatzanteil.": { en: "Assign roles and pay security, cleaning or management with a fixed amount or revenue share.", th: "กำหนดบทบาทและจ่ายค่ารักษาความปลอดภัย ทำความสะอาด หรือจัดการแบบเหมาจ่ายหรือส่วนแบ่งรายได้" },
  "Flexible Rollen und Vergütung": { en: "Flexible roles and compensation", th: "บทบาทและค่าตอบแทนที่ยืดหยุ่น" },
  "Auszahlung über die App": { en: "Payouts through the app", th: "รับเงินผ่านแอป" },
  "Teammanagement": { en: "Team management", th: "การจัดการทีม" },
  "Vergüte Security, Cleaning und Management automatisch per Fixbetrag oder Umsatzanteil.": { en: "Pay security, cleaning and management automatically with a fixed amount or revenue share.", th: "จ่ายทีมรักษาความปลอดภัย ทำความสะอาด และจัดการอัตโนมัติแบบเหมาจ่ายหรือส่วนแบ่งรายได้" },
  "Aktiviere persönliche Links, ordne Verkäufe den richtigen Menschen zu und verwalte Provisionen.": { en: "Enable personal links, attribute sales and manage commissions.", th: "เปิดใช้ลิงก์ส่วนตัว ติดตามยอดขาย และจัดการค่าคอมมิชชัน" },
  "Lass andere dein Event über persönliche Links empfehlen.": { en: "Let others recommend your event with personal links.", th: "ให้ผู้อื่นแนะนำอีเวนต์ของคุณผ่านลิงก์ส่วนตัว" },
  "Deine Gästeliste. Immer aktuell.": { en: "Your guestlist. Always up to date.", th: "รายชื่อแขกของคุณ อัปเดตเสมอ" },
  "Füge Namen, Accounts und Plus-ones hinzu und sieh am Eingang sofort, wer bereits angekommen ist.": { en: "Add names, accounts and plus-ones, then see who has arrived right at the door.", th: "เพิ่มชื่อ บัญชี และผู้ติดตาม พร้อมดูได้ทันทีว่าใครมาถึงแล้ว" },
  "Gäste und Plus-ones verwalten": { en: "Manage guests and plus-ones", th: "จัดการแขกและผู้ติดตาม" },
  "Ankunft direkt markieren": { en: "Mark arrivals instantly", th: "ทำเครื่องหมายเมื่อมาถึงทันที" },
  "Gästeliste": { en: "Guestlist", th: "รายชื่อแขก" },
  "Verwalte Gäste und Plus-ones und markiere ihre Ankunft direkt am Eingang.": { en: "Manage guests and plus-ones and mark their arrival at the door.", th: "จัดการแขกและผู้ติดตาม พร้อมเช็กการมาถึงที่หน้างาน" },
  "Vorteile für deine Locals.": { en: "Benefits for your locals.", th: "สิทธิพิเศษสำหรับคนท้องถิ่น" },
  "Biete verifizierten Locals kostenlosen oder vergünstigten Eintritt und lege dein verfügbares Kontingent fest.": { en: "Offer verified locals free or discounted entry and set the available allocation.", th: "มอบสิทธิ์เข้างานฟรีหรือส่วนลดให้คนท้องถิ่นที่ยืนยันแล้ว พร้อมกำหนดจำนวนสิทธิ์" },
  "Kostenloser oder vergünstigter Eintritt": { en: "Free or discounted entry", th: "เข้างานฟรีหรือรับส่วนลด" },
  "Einlösungen automatisch begrenzen": { en: "Automatically limit redemptions", th: "จำกัดการใช้สิทธิ์อัตโนมัติ" },
  "Gib verifizierten Locals kostenlosen oder vergünstigten Eintritt.": { en: "Give verified locals free or discounted entry.", th: "มอบสิทธิ์เข้างานฟรีหรือส่วนลดให้คนท้องถิ่นที่ยืนยันแล้ว" },
  "VON DER IDEE BIS ZUM EINLASS": { en: "FROM IDEA TO ENTRY", th: "จากไอเดียสู่วันเข้างาน" },
  "Du schaffst": { en: "You create", th: "คุณสร้าง" },
  "unvergessliche Momente.": { en: "unforgettable moments.", th: "ช่วงเวลาที่น่าจดจำ" },
  "Attnd erledigt den Rest.": { en: "Attnd handles the rest.", th: "ที่เหลือให้ Attnd จัดการ" },
  "Alles läuft in einer App zusammen. So kannst du dich auf die Menschen vor Ort konzentrieren.": { en: "Everything comes together in one app, so you can focus on the people at your event.", th: "ทุกอย่างรวมอยู่ในแอปเดียว เพื่อให้คุณใส่ใจกับผู้คนในงานได้เต็มที่" },
  "Event erstellen": { en: "Create event", th: "สร้างอีเวนต์" },
  "Ort, Programm, Medien und Ticketarten festlegen.": { en: "Set location, schedule, media and ticket types.", th: "กำหนดสถานที่ กำหนดการ สื่อ และประเภทตั๋ว" },
  "Reichweite aufbauen": { en: "Build reach", th: "เพิ่มการเข้าถึง" },
  "In der Community entdeckt werden, Affiliates aktivieren und Co-Hosts einladen.": { en: "Get discovered, activate affiliates and invite co-hosts.", th: "ให้ชุมชนค้นพบ เปิดใช้แอฟฟิลิเอต และเชิญผู้ร่วมจัด" },
  "Gäste willkommen heißen": { en: "Welcome guests", th: "ต้อนรับผู้เข้าร่วม" },
  "Verkäufe verfolgen und Tickets am Eingang per QR-Code prüfen.": { en: "Track sales and verify tickets by QR code at entry.", th: "ติดตามยอดขายและตรวจตั๋วด้วย QR ที่ทางเข้า" },
  "BEREIT FÜR DEIN NÄCHSTES EVENT?": { en: "READY FOR YOUR NEXT EVENT?", th: "พร้อมสำหรับอีเวนต์ถัดไปหรือยัง?" },
  "Aus einer Idee": { en: "Turn an idea", th: "เปลี่ยนไอเดีย" },
  "wird": { en: "into", th: "ให้เป็น" },
  "ein Erlebnis.": { en: "an experience.", th: "ประสบการณ์" },
  "Erstelle dein Event in Attnd. Die Community kann es entdecken, Tickets buchen und dabei sein.": { en: "Create your event in Attnd. The community can discover it, book tickets and join.", th: "สร้างอีเวนต์ใน Attnd ให้ชุมชนค้นพบ จองตั๋ว และเข้าร่วม" },
  "Erstelle dein Event in Attnd und bring Menschen zusammen.": { en: "Create your event in Attnd and bring people together.", th: "สร้างอีเวนต์ใน Attnd และพาผู้คนมาพบกัน" },
  "Auf dem Handy starten": { en: "Start on your phone", th: "เริ่มบนโทรศัพท์" },
  "Scannen & Attnd öffnen": { en: "Scan & open Attnd", th: "สแกนและเปิด Attnd" },
  "Kontakt": { en: "Contact", th: "ติดต่อ" }, "Datenschutz": { en: "Privacy", th: "ความเป็นส่วนตัว" },
  "AGB": { en: "Terms", th: "ข้อกำหนด" }, "Erstattungen": { en: "Refunds", th: "การคืนเงิน" },
};

function applyLanguage(language: MarketingLanguage) {
  document.documentElement.dataset.marketingLanguage = language;
  document.documentElement.lang = language;
  document.querySelectorAll(".host-site-shell, .attnd-mobile-marketing").forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.parentElement?.closest("iframe, [data-no-marketing-translate]")) continue;
      const original = originals.get(node) ?? node.nodeValue ?? "";
      originals.set(node, original);
      const match = original.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (!match) continue;
      const translated = language === "de" ? match[2] : translations[match[2]]?.[language] ?? match[2];
      node.nodeValue = match[1] + translated + match[3];
    }
  });
}

export function MarketingLanguageToggle() {
  const [language, setLanguage] = useState<MarketingLanguage>("en");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "de" || saved === "en" || saved === "th") {
      const frame = window.requestAnimationFrame(() => setLanguage(saved));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);
  useLayoutEffect(() => { applyLanguage(language); window.localStorage.setItem(storageKey, language); }, [language]);

  return <div className="marketing-language" data-no-marketing-translate>
    {open && <div className="marketing-language-menu" role="menu" aria-label="Language">
      {([['en','English'],['de','Deutsch'],['th','ไทย']] as const).map(([value, label]) => <button key={value} type="button" role="menuitemradio" aria-checked={language === value} onClick={() => { setLanguage(value); setOpen(false); }}>{label}<span>{language === value ? "✓" : ""}</span></button>)}
    </div>}
    <button type="button" className="marketing-language-trigger" aria-label="Language" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span aria-hidden="true" className="marketing-language-globe"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg></span><b>{language.toUpperCase()}</b></button>
  </div>;
}
