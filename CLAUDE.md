# CLAUDE.md

Questo file fornisce indicazioni a Claude Code (claude.ai/code) per lavorare con il codice di questo repository.

## Panoramica del progetto

Piccol è un progetto e-commerce costruito come portfolio piece Node.js/Express, per mostrare un'architettura
backend rigorosamente a livelli. Il backend è la parte attivamente sviluppata; il frontend (React + Vite) è
al momento solo lo scaffold di Vite e **non** è l'oggetto del lavoro — non aggiungere funzionalità frontend
a meno che non venga esplicitamente richiesto.

Alla radice del repo c'è un `AGENTS.md` che è la fonte di verità unica per le regole architetturali di
questo progetto — leggilo. Il riepilogo qui sotto lo riflette, con dettagli aggiuntivi trovati nel codice
reale.

## Uso di Git

Quando esegui operazioni Git in questo repository (messaggi di commit, descrizioni di pull request, nomi di
branch descrittivi, commenti su PR/issue), scrivi il testo **esclusivamente in italiano**. Questo vale solo
per i testi rivolti a chi legge la cronologia Git/GitHub — codice e commenti nel codice restano in inglese
come da convenzione del progetto (vedi sotto).

## Commenti nel codice

Quando implementi nuova funzionalità (non solo piccoli fix), commenta il codice in modo **verboso e
diffuso**: non basta un singolo commento in cima al file o sopra un blocco — spiega cosa fa e perché ogni
parte non banale, funzione per funzione, test per test, man mano che scrivi. Vale per logica applicativa,
wiring di middleware/route, e per i test (ogni `it`/`describe` dovrebbe avere un commento che spiega cosa
sta verificando e perché quel caso è rilevante, non solo il nome del test).

**Scrivi questi commenti in italiano.** Questo sostituisce, specificamente per i commenti, la convenzione
"codice e commenti in inglese" indicata in AGENTS.md — i nomi di variabili/funzioni restano in inglese, ma
il testo dei commenti va in italiano.

## Comandi

Tutti i comandi vanno eseguiti da `backend/` salvo diversa indicazione.

```bash
npm run dev     # nodemon con debugger su 0.0.0.0:9229, avvia server.js
npm test        # jest (i file di test sono in backend/__tests__/*.test.js)
npm test -- authService.test.js   # esegue un singolo file di test
npm run lint    # eslint . --fix
```

Stack completo (MySQL, phpMyAdmin, backend, test runner backend, frontend) via Docker Compose dalla radice
del repo:

```bash
docker compose up            # db, phpmyadmin (8080), backend (5001->5000, debug 9229), frontend (3000)
docker compose run --rm test_backend   # esegue `npm test` in un container contro il db dockerizzato
```

L'host del DB è `db` dentro Docker, `localhost` dalla macchina host, porta `3306`. La config Sequelize è in
`backend/config/config.json` (al momento solo un blocco `development`, root/rootpassword/mydatabase).

Sequelize CLI (da eseguire da `backend/`):

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Variabili d'ambiente richieste (vedi `backend/.env.example`): `JWT_SECRET`, `SHOW_ROUTES`, `MAX_FILE_SIZE`
(MB, limite di business per le immagini caricate), `MAX_FILE_HARD_SIZE` (MB, limite hard di multer —
attualmente hardcoded a 10 in `uploadMiddleware.js`/`handleMulterErrorsMiddleware.js` invece di essere
letto realmente da questa variabile).

## Architettura

### Livelli (imposti per convenzione, vedi AGENTS.md)

`routes/` → `controllers/` (solo HTTP: parsing input, chiamata ai services, formattazione risposta) →
`services/` (logica di business, transazioni DB) → `models/` (Sequelize). I controller sono raggruppati per
directory di dominio (`controllers/user/`, `controllers/customer/`, `controllers/product/`). Non mettere mai
logica di business in un controller — estendi o aggiungi un service. `classes/` contiene sottoclassi
custom di `Error` (es. `InvalidImageTypeError`); le stringhe rivolte all'utente (messaggi di validazione,
errori API) sono in italiano, codice e commenti sono in inglese.

### Due modelli di identità paralleli

Ci sono due entità autenticate separate, con tabelle, route e controller indipendenti — **non** sono una
gerarchia condivisa di tipo "User":

- **User** (`models/user.js`) — account interni/admin, `level` enum `admin`/`superadmin`, montato su
  `/admin/user` (vedi `routes/adminRoutes.js` → `routes/userRoutes.js`). `authUserMiddleware` protegge
  queste route e valorizza `req.user`.
- **Customer** (`models/customer.js`) — clienti dello storefront, montato su `/` (`routes/customerRoutes.js`).

Entrambi condividono la stessa meccanica di autenticazione tramite `services/authService.js`
(`authenticate(entityModel, email, password)`) e `services/registerService.js`
(`registerEntity(entityModel, userData, tokenPayloadFields)`) — funzioni generiche parametrizzate sul
modello Sequelize, riusate su entrambi i domini. Non duplicare la logica di login/registrazione per singola
entità — estendi questi services condivisi.

**Pattern di invalidazione del token**: i JWT sono stateful. Al login/registrazione, il token firmato viene
scritto anche nella colonna `current_token` dell'entità. `authUserMiddleware` decodifica il JWT *e*
verifica che corrisponda a `current_token` nel DB — questo è ciò che rende possibile invalidare i vecchi
token al logout / cambio password (il logout imposta `current_token = null`; i flussi di
password/2FA dovrebbero fare lo stesso per qualsiasi entità le cui credenziali cambiano).

### Convenzioni di risposta ed errore

`middlewares/responseFormatter.js` viene eseguito per primo nella catena di app.js e monkey-patcha
`res.success(data, message, code)` / `res.error(code, message, err)` su ogni risposta — controller e route
handler usano questi metodi invece del `res.json` grezzo. `res.error` logga via Winston
(`config/logger.js`, scrive in `backend/logs/`) ogni volta che viene passata un'istanza di `Error`.
`middlewares/errorMiddleware.js` è l'ultimo middleware in `index.js` ed è il gestore catch-all di
`next(err)` (normalizza anche i SyntaxError di parsing JSON del body in un 400).
`middlewares/noPathMiddleware.js` gestisce le route non trovate (404). Risolvi sempre gli errori tramite
questa coppia res.success/res.error invece di inventare un nuovo formato di risposta.

### Pattern di accumulo degli errori di validazione

La validazione dell'upload file basata su Multer non si adatta al modello di express-validator, quindi
questo codebase accumula errori su `req.validationErrors` (un array di `{ msg, path, filename?, isFatal? }`)
attraverso più middleware, per poi unirli agli errori di express-validator in
`middlewares/validationHandlerMiddleware.js`, che li raggruppa per campo (gli errori sulle immagini sono
raggruppati per filename) prima di chiamare `res.error(400, ...)`. La catena per l'upload immagine prodotto
(`routes/productRoutes.js`) è: `uploadMiddleware` (filtro mimetype, limite hard di dimensione) →
`handleMulterErrorsMiddleware` (intercetta MulterError, es. superamento del limite hard, lo marca
`isFatal`) → `validateProductImageMiddleware` (limite di dimensione di business da `MAX_FILE_SIZE`,
controllo dimensioni contro `config/imageConfig.js` maxWidth/maxHeight tramite il pacchetto `image-size`,
pulisce i file temporanei in caso di fallimento) → controlli sui campi di express-validator →
`validationHandlerMiddleware`. Quando aggiungi nuova validazione legata all'upload, accoda su
`req.validationErrors` invece di lanciare un'eccezione, così si unisce alla stessa risposta di errore
raggruppata.

### Modello dati

`User` –< `Product` (FK `createdBy`, `as: 'creator'`). Esistono già migrazioni per `categories`,
`product_images` e una tabella di join prodotto↔categorie (`backend/migrations/2025120423*`), ma non ci
sono ancora i modelli/associazioni Sequelize corrispondenti — se ti viene chiesto di lavorare su categorie
o immagini prodotto, dovrai prima aggiungere i modelli. `models/index.js` carica automaticamente ogni file
`*.js` in `models/` (escludendo `.test.js`) e collega `.associate` — i nuovi modelli vanno semplicemente
aggiunti in quella directory.

### Parte nota come incompleta

`controllers/product/productController.js#createProduct` è uno stub (`return res.success({})`) anche se la
sua route completa (`POST /products/new`) collega già auth, upload/validazione immagine e validazione
campi — la logica vera e propria di creazione prodotto (e la gestione di categorie/product_images) non è
ancora stata implementata.

### Mounting delle route (`backend/index.js`)

`/` → route customer, `/admin` → route admin (al momento solo `/admin/user`), `/products` → route
prodotto, più `listRoutes` (elenco route di debug, dietro la variabile d'ambiente `SHOW_ROUTES=true`,
significativo solo fuori produzione).