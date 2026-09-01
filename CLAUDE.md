# CLAUDE.md

Questo file fornisce indicazioni a Claude Code (claude.ai/code) per lavorare con il codice di questo repository.

## Panoramica del progetto

Piccol è un progetto e-commerce costruito come portfolio piece Node.js/Express, per mostrare un'architettura
backend rigorosamente a livelli. Il backend è la parte attivamente sviluppata; il frontend (React + Vite) è
al momento solo lo scaffold di Vite e **non** è l'oggetto del lavoro — non aggiungere funzionalità frontend
a meno che non venga esplicitamente richiesto.

Alla radice del repo c'è @./AGENTS.md, la fonte di verità unica per le regole architetturali di questo
progetto. Il riepilogo qui sotto lo riflette, con dettagli aggiuntivi trovati nel codice reale.

## Uso di Git

Quando esegui operazioni Git in questo repository (messaggi di commit, descrizioni di pull request, nomi di
branch descrittivi, commenti su PR/issue), scrivi il testo **esclusivamente in italiano**. Questo vale solo
per i testi rivolti a chi legge la cronologia Git/GitHub — codice e commenti nel codice restano in inglese
come da convenzione del progetto (vedi sotto).

## Stile delle risposte in chat

Il proprietario del progetto sta studiando attivamente il codice TypeScript generato (obiettivo:
portfolio per colloqui di lavoro), proviene da un background PHP 8 — quando introduci pattern non
banali o scelte architetturali non ovvie, in particolare costrutti TypeScript senza equivalente
diretto in PHP, spiega brevemente il *perché* nella risposta, non solo nel codice.

Quando spieghi codice in prosa discorsiva (non blocchi di codice), evita di racchiudere ogni
singolo identificatore, variabile, tipo o proprietà citato tra backtick singoli — scrivili in
testo normale all'interno della frase. Riserva i backtick/blocchi di codice (```...```) solo per
estratti di codice veri e propri, non per nominare elementi dentro una frase discorsiva.

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

`npm test` esegue prima uno script `pretest` che crea (se non esiste già) e migra automaticamente un
database di test separato, `mydatabase_test` (stesso host/credenziali di `development`, vedi
`config/config.js` blocco `test`) — necessario perché parte della suite (vedi sotto) parla con un DB
reale, non mockato. Va eseguito con accesso al servizio `db` di Docker Compose (es. da dentro il container
`backend`), non funziona dalla macchina host se `db` non è risolvibile.

Stack completo (MySQL, phpMyAdmin, backend, test runner backend, frontend) via Docker Compose dalla radice
del repo:

```bash
docker compose up            # db, phpmyadmin (8080), backend (5001->5000, debug 9229), frontend (3000)
docker compose run --rm test_backend   # esegue `npm test` in un container contro il db dockerizzato
```

Le porte pubblicate sull'host mostrate sopra sono i default: ognuna è configurabile via `.env`
(`DB_HOST_PORT`, `PHPMYADMIN_HOST_PORT`, `BACKEND_HOST_PORT`, `BACKEND_DEBUG_PORT`, `FRONTEND_HOST_PORT`),
utile se una di queste è già occupata da un altro servizio sulla tua macchina. Le porte *interne* ai
container (il lato destro di ogni mappatura in `docker-compose.yml`, tranne `PORT` per il backend) restano
invece letterali di proposito: sono intrinseche alle immagini (MySQL ascolta sempre su 3306 dentro al suo
container, nginx di phpMyAdmin su 80) e cambiarle richiederebbe riconfigurare il servizio stesso, non solo
la mappatura.

L'host del DB è `db` dentro Docker, `localhost` dalla macchina host, porta `3306`. La config Sequelize è in
`backend/config/config.js` (non più `.json`: legge `DB_ROOT_PASSWORD`/`DB_NAME` dal `.env` alla radice del
repo invece di avere le credenziali hardcoded, con `backend/.sequelizerc` che dice a Sequelize CLI di
usare questo file al posto del default `config.json`): blocco `development` (`mydatabase`) e blocco `test`
(`mydatabase_test`, calcolato come `${DB_NAME}_test`), stesso host/credenziali (root/`DB_ROOT_PASSWORD`)
per entrambi.

Sequelize CLI (da eseguire da `backend/`):

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Variabili d'ambiente richieste (vedi `.env.example` alla radice del repo — `.env`/`.env.example` vivono lì,
non in `backend/`, apposta per essere un unico file letto sia da Docker Compose per interpolare
`docker-compose.yml` sia dall'app Node, vedi sotto): `PORT` (porta di ascolto del server, letta in
`server.ts` — se assente ricade sul default `5000`), `JWT_SECRET`, `JWT_EXPIRES_IN` (durata dei token,
formato `jsonwebtoken` es. `1h`/`7d` — se assente ricade sul default `1h` in `services/tokenService.js`),
`SHOW_ROUTES`, `MAX_FILE_SIZE` (MB, limite di business per le immagini caricate), `MAX_FILE_HARD_SIZE` (MB,
limite hard di multer — attualmente hardcoded a 10 in
`uploadMiddleware.js`/`handleMulterErrorsMiddleware.js` invece di essere letto realmente da questa
variabile).

`docker-compose.yml` legge lo stesso `.env` in due modi complementari: lo interpola direttamente nel file
YAML (es. la mappatura delle porte del servizio `backend` è `"5001:${PORT:-5000}"`, non più un numero
fisso) e lo inietta come variabili d'ambiente reali nel container tramite `env_file`, così l'app Node lo
trova in `process.env` a prescindere dal fatto che `backend/` (l'unica cartella montata nel container) non
contenga più `.env`. `backend/index.ts` punta comunque esplicitamente al nuovo percorso
(`path.resolve(__dirname, '..', '.env')`) come rete di sicurezza per un'eventuale esecuzione diretta
sull'host, fuori da Docker.

## Architettura

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

`User` –< `Product` (FK `createdBy`, `as: 'creator'`). `Product` ha anche `hasMany` verso `ProductImage`
(`as: 'images'`, FK `product_id`, `ON DELETE CASCADE` a livello DB) e `belongsToMany` verso `Category`
tramite la tabella di join `ProductCategory` (`as: 'categories'`, indice univoco su
`product_id`+`category_id`). `Category` e `ProductImage` sono `paranoid: true` (hanno `deletedAt`),
`ProductCategory` no (righe di join, cancellazione fisica). `models/index.js` carica automaticamente ogni
file `*.js` in `models/` (escludendo `.test.js`) e collega `.associate` — i nuovi modelli vanno
semplicemente aggiunti in quella directory.

### Parte nota come incompleta

`controllers/product/productController.js#createProduct` è uno stub (`return res.success({})`) anche se la
sua route completa (`POST /products/new`) collega già auth, upload/validazione immagine e validazione
campi — la logica vera e propria di creazione prodotto (e la gestione di categorie/product_images) non è
ancora stata implementata.

### Struttura della suite di test

`backend/__tests__/` contiene due categorie di test, distinguibili dal nome file:

- **Unità con mock, nessun DB reale** (`*.test.js`, es. `authUserMiddleware.test.js`,
  `productController.test.js`): mockano modelli/services/dipendenze esterne con `jest.mock`, non aprono
  connessioni. È lo stile usato dai test già presenti prima di questa sessione — preferiscilo per logica
  applicativa pura (controller, middleware, services).
- **Modelli contro un DB reale** (`*.model.test.js`, es. `product.model.test.js`): richiedono
  `../models` così com'è (nessun mock), verificano vincoli che vivono nel DB (unique, FK, allowNull,
  associazioni) contro `mydatabase_test`. Ogni file traccia gli id che crea e li ripulisce in
  `afterEach`/`afterAll` (con `force: true, paranoid: false` per i modelli `paranoid`, altrimenti una riga
  soft-deleted da un test blocca lo `UNIQUE` per la run successiva), e chiude sempre la connessione con
  `sequelize.close()` in `afterAll` — altrimenti Jest resta appeso.
- **Route end-to-end con supertest** (`*Routes.test.js`, es. `userRoutes.test.js`): fanno richieste HTTP
  vere contro `require('../index')` (l'app Express, senza `.listen()` — supertest ci gira attorno da solo),
  attraversando l'intero stack fino al DB di test. Usano email/dati univoci per evitare collisioni tra
  test file eseguiti in parallelo, e ripuliscono le righe create in `afterAll`. `productRoutes.test.js`
  ripulisce anche i file caricati in `backend/uploads/` dal test che supera la validazione (dato che
  `createProduct` è uno stub e non lo fa da solo, vedi sopra).

Quando aggiungi un test che tocca il DB (modello o route), segui questi due accorgimenti o la suite smette
di essere ripetibile: (1) usa dati univoci (email/nomi con timestamp o suffisso random) invece di valori
fissi, (2) ripulisci sempre quello che crei.

### Mounting delle route (`backend/index.js`)

`/` → route customer, `/admin` → route admin (al momento solo `/admin/user`), `/products` → route
prodotto, più `listRoutes` (elenco route di debug, dietro la variabile d'ambiente `SHOW_ROUTES=true`,
significativo solo fuori produzione).