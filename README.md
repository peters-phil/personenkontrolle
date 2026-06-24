# Shot-Log

Mobil optimierte Website für die einmalige Ausgabe eines Gratis-Shots. Der Normalweg nutzt eine Personalausweisnummer; „Andere Angabe“ ist nur für Ausnahmefälle vorgesehen.

## Schutz der Daten

- Eingegebene Angaben werden **nicht im Klartext** gespeichert.
- Das Backend erstellt einen HMAC-SHA-256-Prüfwert aus `Typ + Angabe`.
- Der geheime Schlüssel bleibt ausschließlich auf dem Server in `.env`.
- Die Datenbank kann nur feststellen, ob dieselbe Angabe erneut verwendet wurde.
- Verwende HTTPS beim Hosting und lösche die Datenbank nach der Feier.

> Beachte: Auch gehashte Identifikatoren können datenschutzrechtlich personenbezogene Daten sein. Informiere Besucher kurz über Zweck, Zugriff und Löschzeitpunkt. Prüfe das Mindestalter für alkoholische Getränke vor Ort separat.

## Starten

1. Node.js 20 oder neuer installieren.
2. Im Projektordner ausführen:

```bash
npm install
cp .env.example .env
```

3. Einen sicheren Schlüssel in `.env` einsetzen, zum Beispiel:

```bash
openssl rand -hex 32
```

4. Server starten:

```bash
npm start
```

5. Auf dem Gerät `http://localhost:3000` öffnen.

Für Tests im gleichen WLAN: Server auf einem Laptop starten und die lokale IP-Adresse des Laptops verwenden, z. B. `http://192.168.178.42:3000`. Für die echte Feier sollte die Seite über HTTPS gehostet werden.

## Ordnerstruktur

```text
shot-log/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── data/                 # SQLite-Datenbank wird automatisch angelegt
├── .env.example
├── package.json
├── README.md
└── server.js
```

## API

- `GET /api/stats` → Anzahl eingelöster Einträge
- `POST /api/redeem` → prüft und speichert einen Eintrag atomar

Beispiel-Body:

```json
{
  "identifier": "L01X00T47",
  "type": "ausweis"
}
```
