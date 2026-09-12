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

## Checklist di validazione per codice non banale

Il proprietario del progetto sta specificamente lavorando sulla propria capacità di validare
criticamente codice generato da IA (non solo produrlo). Per questo, quando generi codice che
soddisfa **almeno uno** di questi criteri:

- tocca il DB (nuova query, migration, associazione tra modelli)
- tocca dati esterni/utente (nuovo endpoint, nuovo campo in input, nuovo upload)
- introduce nuova logica di business (non è un refactor 1:1 o un rename)
- supera le ~15-20 righe di codice nuovo
- tocca sicurezza/auth (token, permessi, validazione, invalidazione)

...percorri esplicitamente in prosa, nella risposta, questi punti — non solo nella tua testa:

- **Input**: cosa succede con input vuoto, null, malformato, o un volume anomalo di dati?
- **Confini del dominio**: questo codice rispetta pattern già esistenti nel progetto (es. i due
  modelli di identità paralleli, il pattern res.success/res.error, l'accumulo di
  validationErrors) o introduce un'incoerenza?
- **Fallimento**: se questa parte lancia un'eccezione, chi la intercetta? È coerente con
  errorMiddleware.ts?
- **Sicurezza**: se tocca dati utente/DB, sto validando l'input o fidandomi ciecamente?
- **Leggibilità futura**: fra 3 mesi, il proprietario del progetto capirebbe perché è scritto così
  senza il tuo aiuto?

Non richiedono la checklist: fix di typo, rename, aggiunta di un campo a una risposta già
esistente, modifiche di stile, un singolo `if` di guardia ovvio.

### Aderenza a Clean Code (Robert C. Martin)

Il codice generato deve seguire i principi di Clean Code: nomi che esprimono intento, funzioni
piccole e a singola responsabilità, evitare duplicazione (DRY), evitare commenti che spiegano
codice mal scritto invece di riscriverlo, gestione esplicita degli errori invece di codici di
ritorno ambigui, dipendenze esplicite invece di stato nascosto. Quando una scelta di design
concreta discende da uno di questi principi (es. hai estratto una funzione perché faceva più di
una cosa, hai rinominato una variabile perché il nome originale non comunicava l'intento, hai
evitato un parametro booleano "flag" a favore di due funzioni distinte), dillo esplicitamente
nella spiegazione discorsiva — non basta che il codice risultante sia pulito, deve essere chiaro
*quale principio* ha guidato quella scelta specifica, così diventa un'occasione di apprendimento
e non solo un output da accettare.

Non è necessario un elenco puntato separato per ogni checklist — puoi integrare le risposte nella
spiegazione discorsiva già prevista da "Stile delle risposte in chat". L'obiettivo è rendere
visibile il ragionamento, non nasconderlo dentro la generazione del codice.

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
npm run dev     # nodemon con debugger su 0.0.0.0:9229, avvia server.ts
npm test        # jest (i file di test sono in backend/__tests__/*.test.ts)
npm test -- authService.test.ts   # esegue un singolo file di test
npm run lint    # eslint . --fix
npm run type-check   # tsc --noEmit
```

`npm test` esegue prima uno script `pretest` (`prisma db push`) che crea il database di test separato
`mydatabase_test` se non esiste e ne allinea lo schema — necessario perché parte della suite (vedi sotto)
parla con un DB reale, non mockato. Il nome col suffisso `_test` è calcolato da
`config/databaseUrl.ts` quando `NODE_ENV=test`, quindi la suite non tocca mai il DB di sviluppo. Va eseguito con accesso al servizio `db` di Docker Compose (es. da dentro il container
`backend`), non funziona dalla macchina host se `db` non è risolvibile.

Stack completo (PostgreSQL, Adminer, backend, test runner backend, frontend) via Docker Compose dalla radice
del repo:

```bash
docker compose up            # db, adminer (8080), backend (5001->5000, debug 9229), frontend (3000)
docker compose run --rm test_backend   # esegue `npm test` in un container contro il db dockerizzato
```

Le porte pubblicate sull'host mostrate sopra sono i default: ognuna è configurabile via `.env`
(`DB_HOST_PORT`, `ADMINER_HOST_PORT`, `BACKEND_HOST_PORT`, `BACKEND_DEBUG_PORT`, `FRONTEND_HOST_PORT`),
utile se una di queste è già occupata da un altro servizio sulla tua macchina. Le porte *interne* ai
container (il lato destro di ogni mappatura in `docker-compose.yml`, tranne `PORT` per il backend) restano
invece letterali di proposito: sono intrinseche alle immagini (PostgreSQL ascolta sempre su 5432 dentro al
suo container, Adminer serve il proprio PHP built-in server sulla 8080) e cambiarle richiederebbe
riconfigurare il servizio stesso, non solo la mappatura.

L'host del DB è `db` dentro Docker, `localhost` dalla macchina host, porta `5432`. L'ORM è **Prisma**: lo
schema è in `backend/prisma/schema.prisma`, il client condiviso in `backend/prisma/client.ts`. Prisma 7 non
accetta più `url` dentro il blocco datasource (errore P1012), quindi la connessione è dichiarata in
`backend/prisma.config.ts` e composta da `backend/config/databaseUrl.ts` a partire da
`DB_USER`/`DB_ROOT_PASSWORD`/`DB_HOST`/`DB_NAME` — niente `DATABASE_URL` in `.env`, che sarebbe una
seconda copia delle stesse credenziali. La stessa funzione applica il suffisso `_test` al nome del
database quando `NODE_ENV=test`, così la suite non tocca mai il DB di sviluppo. Su PostgreSQL l'utente non
è implicitamente `root` come su MySQL: è il ruolo creato dal container (`POSTGRES_USER`), quindi `DB_USER`
deve coincidere con quello.

Prisma richiede un **driver adapter** esplicito (client "Rust-free"): `@prisma/adapter-pg`, che usa `pg`.
Il client viene generato nel `Dockerfile` e non a runtime, perché `/app/node_modules` è un volume anonimo
inizializzato dall'immagine: un client generato a runtime sparirebbe alla prima ricreazione del volume.

**Il client va però generato anche sull'host** (`npm run generate` da `backend/`), altrimenti VS Code
segnala `Module '"@prisma/client"' has no exported member 'PrismaClient'`: il server TypeScript
dell'editor gira sull'host e legge `backend/node_modules`, dove `@prisma/client` è installato ma non
generato. Va rifatto **ogni volta che si modifica `schema.prisma`**, altrimenti l'editor mostra i tipi
vecchi (i test e l'app, che girano nel container, non se ne accorgono). Lo script passa valori fittizi per
le variabili del database: `prisma generate` legge solo lo schema e non si connette, ma `prisma.config.ts`
le pretende comunque — e `DB_HOST` in particolare non è in `.env`, vive nel blocco `environment` del
servizio backend.

Comandi Prisma (da `backend/`):

```bash
npm run generate         # rigenera il client: serve sull'host per l'IntelliSense, dopo ogni modifica allo schema
npm run migrate          # prisma migrate deploy: applica le migration pendenti
npm run seed             # popola i 3 utenti di prova (upsert: ripetibile)
npm run seed:dev         # popola dati realistici: 5.000 prodotti, ~7.500 immagini, ~10.000 collegamenti
npx prisma studio        # esplora i dati
npx prisma migrate dev --name <nome>   # nuova migration dopo aver modificato lo schema
```

Variabili d'ambiente richieste (vedi `.env.example` alla radice del repo — `.env`/`.env.example` vivono lì,
non in `backend/`, apposta per essere un unico file letto sia da Docker Compose per interpolare
`docker-compose.yml` sia dall'app Node, vedi sotto): `PORT` (porta di ascolto del server, letta in
`server.ts`), `JWT_SECRET`, `JWT_EXPIRES_IN` (durata dei token, formato `jsonwebtoken` es. `1h`/`7d`),
`SHOW_ROUTES`, `MAX_FILE_SIZE` (MB, limite di business per le immagini caricate), `MAX_FILE_HARD_SIZE` (MB,
limite hard di multer — attualmente hardcoded a 10 in
`uploadMiddleware.ts`/`handleMulterErrorsMiddleware.ts` invece di essere letto realmente da questa
variabile), `DB_ROOT_PASSWORD`, `DB_NAME`, e le porte pubblicate sull'host (`BACKEND_HOST_PORT`,
`BACKEND_DEBUG_PORT`, `DB_HOST_PORT`, `ADMINER_HOST_PORT`, `FRONTEND_HOST_PORT`).

**Nessuna di queste ha un fallback**: sia `docker-compose.yml` (via la sintassi `${VAR:?messaggio}`, che
fa fallire `docker compose` prima ancora di creare un container se una variabile manca) sia il codice Node
(`server.ts`, `services/tokenService.ts`, `config/databaseUrl.ts`) si rifiutano esplicitamente di partire
con un errore leggibile se una di queste manca da `.env`, invece di far partire l'app con un valore
indovinato in silenzio. L'unica eccezione deliberata è `NODE_ENV`, letto in `config/databaseUrl.ts` e
`prisma/client.ts` senza obbligo: non fa parte del contratto di `.env` di questo progetto, è una
convenzione dell'intero ecosistema Node letta dal comando che avvia il processo — `npm run dev` non la
imposta mai esplicitamente, quindi pretenderla romperebbe l'avvio in sviluppo.

`docker-compose.yml` legge lo stesso `.env` in due modi complementari: lo interpola direttamente nel file
YAML (es. la mappatura delle porte del servizio `backend` è `"${BACKEND_HOST_PORT:?...}:${PORT:?...}"`, non
più numeri fissi) e lo inietta come variabili d'ambiente reali nel container tramite `env_file`, così l'app
Node lo trova in `process.env` a prescindere dal fatto che `backend/` (l'unica cartella montata nel
container) non contenga più `.env`. `backend/index.ts` punta comunque esplicitamente al nuovo percorso
(`path.resolve(__dirname, '..', '.env')`) come rete di sicurezza per un'eventuale esecuzione diretta
sull'host, fuori da Docker.

## Architettura

### Due modelli di identità paralleli

Ci sono due entità autenticate separate, con tabelle, route e controller indipendenti — **non** sono una
gerarchia condivisa di tipo "User":

- **User** (modello `User` in `prisma/schema.prisma`) — account interni/admin, `level` enum
  `admin`/`superadmin`, montato su `/admin/user` (vedi `routes/adminRoutes.ts` → `routes/userRoutes.ts`).
  `authUserMiddleware` protegge queste route e valorizza `req.user`.
- **Customer** (modello `Customer` in `prisma/schema.prisma`) — clienti dello storefront, montato su `/`
  (`routes/customerRoutes.ts`).

Entrambi condividono la stessa meccanica di autenticazione, ma **non** tramite una funzione generica sul
modello: `services/authService.ts` espone `authenticateUser`/`authenticateCustomer` e
`services/registerService.ts` espone `registerUser`/`registerCustomer`. A essere condivisa è la logica di
sicurezza, non la query: `completeAuthentication` (confronto bcrypt, firma del token, persistenza di
`current_token`) e `issueTokenFor` ricevono l'entità **già letta**, e l'unica cosa specifica per entità
resta la chiamata a Prisma. Non duplicare la logica di login/registrazione: se serve una terza entità
autenticata, aggiungi la sua query e riusa queste funzioni condivise.

**Pattern di invalidazione del token**: i JWT sono stateful. Al login/registrazione, il token firmato viene
scritto anche nella colonna `current_token` dell'entità. `authUserMiddleware` decodifica il JWT *e*
verifica che corrisponda a `current_token` nel DB — questo è ciò che rende possibile invalidare i vecchi
token al logout / cambio password (il logout imposta `current_token = null`; i flussi di
password/2FA dovrebbero fare lo stesso per qualsiasi entità le cui credenziali cambiano).

**Normalizzazione delle email (case-sensitivity)**: le email sono sempre salvate e cercate in minuscolo,
tramite `services/emailNormalizer.ts`. Non è un vezzo: su MySQL la collation case-insensitive di default
rendeva `Mario@x.com` e `mario@x.com` lo stesso valore (il vincolo `UNIQUE` rifiutava il duplicato, il
login funzionava con qualunque casing), mentre PostgreSQL confronta le stringhe in modo case-sensitive —
senza normalizzazione diventerebbero due account distinti per la stessa identità, ognuno col proprio
`current_token`, vanificando il pattern di invalidazione descritto sopra. La regola va applicata
esplicitamente in **ogni** punto che scrive o cerca un'email: oggi sono `authService.authenticateUser`/`authenticateCustomer` (login),
`registerService.registerUser`/`registerCustomer` (registrazione) e
`profileUserController.updateProfileUser` (che scrive
fuori dai services condivisi). Scelta deliberata di una funzione esplicita invece di un meccanismo
automatico dell'ORM (un tempo un hook `beforeSave` di Sequelize, oggi una Prisma Client Extension): non
coprirebbe la query di lettura del login e renderebbe la regola stato nascosto (vedi Design Decisions Log
in AGENTS.md). `Category.name` e `Product.sku` restano invece **case-sensitive**: lì
il casing è significativo o indifferente, non un dettaglio da appiattire.

### Convenzioni di risposta ed errore

`middlewares/responseFormatter.ts` viene eseguito per primo nella catena di `index.ts` e monkey-patcha
`res.success(data, message, code)` / `res.error(code, message, err)` su ogni risposta — controller e route
handler usano questi metodi invece del `res.json` grezzo. `res.error` logga via Winston
(`config/logger.ts`, scrive in `backend/logs/`) ogni volta che viene passata un'istanza di `Error`.
`middlewares/errorMiddleware.ts` è l'ultimo middleware in `index.ts` ed è il gestore catch-all di
`next(err)` (normalizza anche i SyntaxError di parsing JSON del body in un 400).
`middlewares/noPathMiddleware.ts` gestisce le route non trovate (404). Risolvi sempre gli errori tramite
questa coppia res.success/res.error invece di inventare un nuovo formato di risposta.

### Pattern di accumulo degli errori di validazione

La validazione dell'upload file basata su Multer non si adatta al modello di express-validator, quindi
questo codebase accumula errori su `req.validationErrors` (un array di `{ msg, path, filename?, isFatal? }`)
attraverso più middleware, per poi unirli agli errori di express-validator in
`middlewares/validationHandlerMiddleware.ts`, che li raggruppa per campo (gli errori sulle immagini sono
raggruppati per filename) prima di chiamare `res.error(400, ...)`. La catena per l'upload immagine prodotto
(`routes/productRoutes.ts`) è: `uploadMiddleware` (filtro mimetype, limite hard di dimensione) →
`handleMulterErrorsMiddleware` (intercetta MulterError, es. superamento del limite hard, lo marca
`isFatal`) → `validateProductImageMiddleware` (limite di dimensione di business da `MAX_FILE_SIZE`,
controllo dimensioni contro `config/imageConfig.ts` maxWidth/maxHeight tramite il pacchetto `image-size`,
pulisce i file temporanei in caso di fallimento) → controlli sui campi di express-validator →
`validationHandlerMiddleware`. Quando aggiungi nuova validazione legata all'upload, accoda su
`req.validationErrors` invece di lanciare un'eccezione, così si unisce alla stessa risposta di errore
raggruppata.

### Modello dati

Tutto lo schema vive in `backend/prisma/schema.prisma`, unica fonte di verità: non esiste più un loader
che scansiona una cartella `models/`, e i tipi TypeScript di ogni modello sono generati da lì (niente più
`InferAttributes`/`declare`). I modelli sono in PascalCase singolare con `@@map` verso i nomi reali delle
tabelle, che restano `users`, `products`, `product_images`, ecc.

`User` –< `Product` (FK `createdBy`, relazione `creator` sul lato Product). `Product` ha `images`
(`ProductImage[]`, FK `product_id`, `ON DELETE CASCADE`) e raggiunge `Category` **attraverso la tabella
ponte esplicita** `ProductCategory` (indice univoco su `product_id`+`category_id`): non esiste un
`product.categories` diretto, si naviga `product.productCategories[].category`. La tabella ponte resta un
modello esplicito perché ha campi propri (`id`, `createdAt`, `updatedAt`).

Due differenze rispetto a com'era con Sequelize, entrambe deliberate:

- **`User.products` ora esiste.** Prima User non dichiarava alcuna associazione verso Product (asimmetria
  voluta); Prisma richiede che ogni relazione sia dichiarata su entrambi i lati, quindi quell'asimmetria
  non è rappresentabile.
- **`deletedAt` di `Category` e `ProductImage` non è più gestito.** Con `paranoid: true` Sequelize
  soft-cancellava e filtrava da solo; Prisma non ha un equivalente nativo e si è scelto di non
  introdurre infrastruttura di soft-delete finché non esiste una funzionalità che cancella davvero.
  **Attenzione**: `prisma.category.delete()` cancella fisicamente la riga. Prima di implementare una
  cancellazione, vedi il Design Decisions Log in AGENTS.md.

### Diagnosi delle performance (PostgreSQL)

Il database ha due strumenti attivi per capire cosa rallenta, e **non sono la stessa cosa**:

- `log_min_duration_statement` (parametro, impostato a **200ms**): scrive nel log di PostgreSQL ogni query
  che supera quella soglia. Un diario di eventi singoli, si legge con `docker compose logs db`.
- `pg_stat_statements` (estensione, **attiva**): accumula contatori in memoria — quante volte una query è
  stata eseguita e quanto tempo ha consumato in totale — e si interroga con una `SELECT`. Smaschera la
  query veloce chiamata migliaia di volte, che nel log non comparirebbe mai.

Entrambi sono stati attivati con `ALTER SYSTEM SET ...` + `SELECT pg_reload_conf()`, quindi vivono nel
volume Docker del database e **non sono versionati**: se il volume viene ricreato spariscono. Nota che
`pg_stat_statements` ha richiesto anche un riavvio del container, perché `shared_preload_libraries` ha
`context = postmaster` in `pg_settings` (il reload non basta).

### Parte nota come incompleta

`controllers/product/productController.ts#createProduct` è uno stub (`return res.success({})`) anche se la
sua route completa (`POST /products/new`) collega già auth, upload/validazione immagine e validazione
campi — la logica vera e propria di creazione prodotto (e la gestione di categorie/product_images) non è
ancora stata implementata.

### Struttura della suite di test

`backend/__tests__/` contiene due categorie di test, distinguibili dal nome file:

- **Unità con mock, nessun DB reale** (`*.test.ts`, es. `authUserMiddleware.test.ts`,
  `productController.test.ts`): mockano modelli/services/dipendenze esterne con `jest.mock`, non aprono
  connessioni. È lo stile usato dai test già presenti prima di questa sessione — preferiscilo per logica
  applicativa pura (controller, middleware, services).
- **Modelli contro un DB reale** (`*.model.test.ts`, es. `product.model.test.ts`): usano il client Prisma
  vero (nessun mock), verificano vincoli che vivono nel DB (unique, FK, NOT NULL, relazioni) contro
  `mydatabase_test`. Ogni file traccia gli id che crea e li ripulisce in `afterEach`/`afterAll`, e chiude
  sempre la connessione con `prisma.$disconnect()` in `afterAll` — altrimenti Jest resta appeso.
- **Route end-to-end con supertest** (`*Routes.test.ts`, es. `userRoutes.test.ts`): fanno richieste HTTP
  vere contro `import app from '../index'` (l'app Express, senza `.listen()` — supertest ci gira attorno da solo),
  attraversando l'intero stack fino al DB di test. Usano email/dati univoci per evitare collisioni tra
  test file eseguiti in parallelo, e ripuliscono le righe create in `afterAll`. `productRoutes.test.ts`
  ripulisce anche i file caricati in `backend/uploads/` dal test che supera la validazione (dato che
  `createProduct` è uno stub e non lo fa da solo, vedi sopra).

Quando aggiungi un test che tocca il DB (modello o route), segui questi due accorgimenti o la suite smette
di essere ripetibile: (1) usa dati univoci (email/nomi con timestamp o suffisso random) invece di valori
fissi, (2) ripulisci sempre quello che crei.

### Mounting delle route (`backend/index.ts`)

`/` → route customer, `/admin` → route admin (al momento solo `/admin/user`), `/products` → route
prodotto, più `listRoutes` (elenco route di debug, dietro la variabile d'ambiente `SHOW_ROUTES=true`,
significativo solo fuori produzione).