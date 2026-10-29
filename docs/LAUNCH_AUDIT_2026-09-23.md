# Attnd Launch Audit — 23 September 2026

## Entscheidung

**NO-GO für einen öffentlichen Launch.** Die Marketingseite ist erreichbar und der Production Build funktioniert, aber der echte Kernfluss wurde in Produktion noch nicht vollständig abgeschlossen. Es fehlen insbesondere ein bezahlter Kauf, QR Check-in, Co-Host Ablauf, Affiliate Provision und Live Upload mit echten Produktionsdaten.

## P0 — vor Launch schließen

### 1. Store Buttons führen nicht zu den Stores

- App Store und Google Play verlinken beide auf `/onboarding`.
- Auf Desktop wird jede App Route durch die Marketingseite ersetzt. `/onboarding` zeigt daher wieder die Landingpage und die Store Buttons führen in eine Schleife.
- **Abnahme:** App Store Button öffnet die echte Apple Store URL, Google Play Button die echte Play Store URL. Solange eine App noch nicht veröffentlicht ist, muss der entsprechende Badge entfernt oder eindeutig als „Coming soon“ dargestellt werden.

### 2. Kein kompletter Produktionsfluss wurde erfolgreich abgeschlossen

Aktueller aggregierter Produktionsstand:

| Bereich | Produktionsnachweis |
|---|---:|
| Öffentliche Events | 2, beide mit `TEST` im Titel |
| Bezahlte Bestellungen | 0 |
| Kostenlose Bestellungen | 2 |
| Offene Bestellungen | 2 |
| Tickets | 2 |
| Check-ins | 0 |
| Co-Hosts | 0 |
| Affiliate Provisionen | 0 |
| Live Moments | 0 |

- **Abnahme:** Ein kontrollierter Test durchläuft Anmeldung → Event veröffentlichen → bezahltes Ticket → Stripe Webhook → Ticket und QR → Check-in → Co-Host → Affiliate Provision → Live Upload → Auszahlungsvorbereitung.
- Die zwei öffentlichen `TEST` Events müssen vor dem öffentlichen Launch verborgen oder durch echte Events ersetzt werden.

### 3. Eventzeiten werden unabhängig von der Auswahl als Thailand-Zeit interpretiert

- `src/app/api/events/route.ts` baut Zeitstempel immer mit `+07:00`.
- Das gespeicherte `timezone` Feld ändert diese Umrechnung nicht.
- Events außerhalb Thailands erscheinen dadurch zur falschen Uhrzeit.
- **Abnahme:** Datum und Uhrzeit werden mit der ausgewählten IANA Zeitzone in UTC umgerechnet. Tests decken mindestens Bangkok, Berlin mit Sommerzeit und New York ab. Ende muss nach Start liegen.

### 4. Co-Hosts können keine Tickets einchecken

- Die Datenbankfunktion `check_in_ticket` erlaubt ausschließlich `events.host_id`.
- Akzeptierte Co-Hosts werden nicht berücksichtigt, obwohl die App Co-Hosting als Teamfunktion anbietet.
- **Abnahme:** Der Host kann pro Co-Host eine Check-in Berechtigung vergeben; berechtigte akzeptierte Co-Hosts können scannen, andere Personen erhalten 403.

### 5. Der Qualitätslauf ist rot

- ESLint: **13 Fehler, 1 Warnung** in 10 Dateien.
- Betroffen sind Discovery, Eventkarte, Eventdetails, Explore, Live Moments, Host Dashboard, Profile und Sprache.
- Die Fehler betreffen instabile Zeitberechnung während des Renderns und synchrone State Updates in Effects.
- **Abnahme:** `npm run lint`, `npx tsc --noEmit`, Production Build und `git diff --check` laufen alle ohne Fehler.

### 6. Keine automatisierten Tests für Geld, Inventar und Berechtigungen

- Es gibt keinen Test Runner und keine Test Scripts.
- Besonders kritisch sind gleichzeitige Ticketkäufe, Stripe Webhook Wiederholungen, Refunds, QR Doppel-Scan, Transfers, Co-Host Anteile, Affiliate Attribution und Auszahlungen.
- **Abnahme:** Integrationstests decken diese Serverflüsse ab. Ein kleiner E2E Smoke Test prüft Registrierung, Kauf und Check-in gegen eine isolierte Testumgebung.

### 7. Stripe Betriebsmodus und Webhook müssen manuell bestätigt werden

- Die benötigten Variablennamen sind in Vercel Production gesetzt.
- Aus dem sicheren Metadatenzugriff lässt sich nicht erkennen, ob Test- oder Live-Schlüssel verwendet werden.
- Ein Versuch, die Werte temporär herunterzuladen, wurde von der automatischen Sicherheitsprüfung abgelehnt, weil dabei Produktionsgeheimnisse als Klartext gespeichert würden.
- **Abnahme:** In Vercel und Stripe Dashboard bestätigen: Live Keys, korrektes Webhook Ziel `https://www.attnd.space/api/stripe/webhook`, Events `checkout.session.completed`, `checkout.session.expired` und Refund Event, erfolgreiche signierte Testzustellung.

## P1 — unmittelbar vor oder direkt nach dem internen Release

### 8. Offene Ticketreservierungen haben keinen eigenen Reconciliation Job

- Reservierungen werden bei Session Erstellung angelegt.
- Freigabe erfolgt bei Stripe Fehler oder `checkout.session.expired`.
- Es gibt keinen periodischen Job für verwaiste Pending Orders, falls ein Webhook ausfällt.
- Aktuell existieren zwei offene Bestellungen und zwei reservierte bezahlte Tickets.
- **Abnahme:** Regelmäßiger Cleanup gibt abgelaufene Reservierungen idempotent frei und meldet Abweichungen zwischen Stripe und Supabase.

### 9. Native Push-Benachrichtigungen sind nicht konfiguriert

- In Vercel Production fehlen `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` und `APNS_BUNDLE_ID`.
- **Abnahme:** APNs Production Credentials sind gesetzt; Registrierung, Versand und Tap Navigation wurden auf einem echten Gerät getestet.

### 10. Auth ist derzeit E-Mail-only

- Aktiv: E-Mail OTP und Registrierung.
- Deaktiviert: Apple, Google und Telefon.
- Das UI blendet deaktivierte Provider korrekt aus.
- **Abnahme:** Entweder den E-Mail-only Launch bewusst freigeben oder Apple und Google in Supabase konfigurieren und Callback URLs für Web und iOS testen.

### 11. Beobachtbarkeit fehlt

- Kein Error Tracking, kein Uptime Check und keine strukturierte Alarmierung gefunden.
- Bei Checkout, Webhook, E-Mail, Upload oder Auszahlung erfährt das Team sonst erst über Nutzer von Fehlern.
- **Abnahme:** Error Tracking mit Release Version, Uptime Check für Website und API sowie Alarme für Webhook Fehler und steckengebliebene Orders.

### 12. Öffentliche schreibende Endpunkte haben kein Rate Limit

- Besonders relevant: Affiliate Visits, E-Mail OTP über Supabase, Einladungen und Uploads.
- **Abnahme:** IP und Account basierte Limits mit klarer 429 Antwort; Upload Quoten und Abuse Monitoring.

### 13. Browser Sicherheitsheader sind unvollständig

- Vorhanden: HSTS.
- Fehlend: Content Security Policy, `X-Content-Type-Options`, Referrer Policy und Permissions Policy.
- **Abnahme:** Header sind gesetzt und Checkout, Supabase, Karten, Medien und Stripe funktionieren mit der CSP.

### 14. SEO Grundlagen fehlen

- `/robots.txt` und `/sitemap.xml` liefern 404.
- **Abnahme:** Beide Routen liefern 200, enthalten die kanonische Domain und listen nur öffentlich indexierbare Seiten.

## Bereits verifiziert

- `npm run build -- --webpack`: erfolgreich, 74 Seiten generiert.
- `npx tsc --noEmit`: erfolgreich nach abgeschlossenem Build.
- `git diff --check`: erfolgreich.
- Supabase, Stripe und Resend Variablennamen sind in Vercel Production vorhanden.
- Supabase E-Mail OTP ist aktiviert; Sign-up ist erlaubt und Auto Confirm ist aus.
- Checkout reserviert Inventar atomar über Datenbankfunktionen.
- Stripe Webhooks werden per Signatur geprüft.
- Ticket QR SVG ist nur für den Ticketbesitzer abrufbar.
- QR Check-in verlangt Authentifizierung und validiert den Event Host.
- Live Upload verlangt ein eingechecktes Ticket und ist nur während eines laufenden Events offen.
- Manifest, Datenschutz, AGB und Erstattungsseite liefern 200.

## Empfohlene Reihenfolge

1. Store Links und öffentliche Testevents bereinigen.
2. Zeitzonenfehler und Co-Host Check-in beheben.
3. Lint Fehler schließen und eine verpflichtende CI Prüfung anlegen.
4. Integrationstests für Checkout, Webhook, QR und Geldverteilung bauen.
5. Kontrollierten E2E Test in Stripe Test Mode mit zwei Testkonten durchführen.
6. Pending Order Cleanup, Monitoring, Rate Limits und Sicherheitsheader ergänzen.
7. APNs und gewünschte Social Logins konfigurieren.
8. Danach erst Stripe Live Mode, Store Links und öffentlichen Launch freigeben.
