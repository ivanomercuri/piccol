# Suite di test: cosa è stato fatto e perché

Questo documento spiega in dettaglio il lavoro fatto per portare la copertura di test del backend da
parziale (4 file, concentrati su auth e validazione immagine) a completa su tutta la logica applicativa,
inclusa l'infrastruttura nuova che è stata necessaria per farlo. È pensato per chi deve rivedere il commit
che ha introdotto questi test, o per chi in futuro deve aggiungerne altri e vuole capire le convenzioni da
seguire.

## Perché questo lavoro

La richiesta era "crea i test Jest su tutto ciò che non è stato testato". Prima di iniziare a scrivere
codice, è stato fatto un inventario di cosa esisteva già (`backend/__tests__/`, 4 file:
`authService.test.js`, `registerService.test.js`, `profileUserController.test.js`,
`validateProductImageMiddleware.test.js`, più `checkNumberFilesMiddleware.test.js` aggiunto in una fase
precedente di questa stessa sessione di lavoro) contro l'intero albero di `controllers/`, `middlewares/`, `services/`, `classes/`, `models/` e
`routes/`. Ne è emerso che la maggior parte della logica applicativa — inclusi pezzi critici come
`authUserMiddleware`, che decide se una richiesta è autenticata — non aveva **nessuna** copertura.

## Due decisioni prese insieme all'utente prima di scrivere codice

Questo lavoro ha toccato due bivi che non avevano una risposta ovvia dal solo codice, quindi sono stati
posti esplicitamente come domande invece di essere decisi unilateralmente:

1. **Includere modelli Sequelize e route, o fermarsi alla logica applicativa?** Testare modelli e route
   richiede un DB reale (i vincoli come `UNIQUE`, le foreign key, le associazioni non sono verificabili con
   un modello mockato), mentre tutti i test esistenti nel progetto mockavano sempre tutto. È stata una
   scelta deliberata dell'utente ampliare lo scope per includerli.
2. **Come isolare i test dal DB di sviluppo?** Il primo tentativo di ragionamento ("non c'è un DB di
   test") era impreciso — il DB Docker esiste ed era già stato usato in questa stessa sessione per
   migrazioni e seed. Il problema reale era che quel DB (`mydatabase`) era già popolato con dati di
   sviluppo (3 utenti da seed), e nessun blocco `test` esisteva in `config/config.json` per puntare altrove.
   L'utente ha scelto l'opzione pulita: un database di test separato (`mydatabase_test`), sullo stesso
   server MySQL già in Docker.

Queste due risposte hanno determinato tutta l'architettura descritta sotto.

## Infrastruttura nuova: il database di test

Tre modifiche, minime ma necessarie perché il resto della suite potesse esistere:

- **`backend/config/config.json`**: aggiunto un blocco `"test"`, identico a `"development"` tranne per il
  nome del database (`mydatabase_test` invece di `mydatabase`). Stesso host (`db`, risolvibile solo dentro
  la rete Docker) e stesse credenziali.
- **`backend/package.json`**: aggiunto uno script `"pretest"` che esegue `NODE_ENV=test sequelize-cli
  db:create` seguito da `db:migrate`, e cambiato `"test"` in `"NODE_ENV=test jest"`. npm esegue
  automaticamente `pretest` prima di `test` — quindi `npm test` crea/migra da solo il DB di test se non
  esiste ancora, senza bisogno di un passo manuale separato. `db:create` è stato verificato essere
  idempotente (non fallisce se il database esiste già), quindi è sicuro farlo girare ad ogni esecuzione.
- **`backend/models/index.js`**: `config.logging`, che prima era sempre `console.log` (ogni query SQL
  stampata a schermo), ora è `false` quando `NODE_ENV === 'test'`. Con ~20 file di test che interrogano
  davvero il DB, lasciare il logging attivo avrebbe reso l'output di `npm test` illeggibile.

Il motivo per cui questo non tocca il DB di sviluppo (`mydatabase`, con i 3 utenti seedati in una fase
precedente di questa sessione): è un database completamente separato sullo stesso server, quindi non c'è nessuna possibilità
di collisione tra i dati di test e quelli di sviluppo.

## Le tre categorie di test, e perché sono separate

Un'unica convenzione di naming distingue tre stili di test molto diversi tra loro, per rendere chiaro a
colpo d'occhio (e a `git grep`) cosa richiede un DB e cosa no:

### 1. Unità con mock (`*.test.js`) — nessun DB reale

Lo stile già in uso nel progetto prima di questa sessione: `jest.mock()` su modelli, servizi, `jsonwebtoken`
ecc., verificando solo la logica del singolo modulo in isolamento. Aggiunti qui: `authUserMiddleware`,
`responseFormatter`, `errorMiddleware`, `noPathMiddleware`, `handleMulterErrorsMiddleware`,
`validationHandlerMiddleware`, `authUserController`, `authCustomerController`, `productController`,
`listRoutesController`, `InvalidImageTypeError`.

Perché questo stile e non un altro: è il più veloce da eseguire, non richiede infrastruttura, ed è quello
che il progetto già usava — mantenerlo per la logica pura evita di introdurre due modi diversi di testare
la stessa categoria di codice. Un esempio del valore di questi test: `validationHandlerMiddleware` ha la
logica di raggruppamento errori più complessa del progetto (casi speciali per il campo `image`, scorciatoia
per gli errori "fatali") ed era interamente priva di test — un mock di `express-validator` ha permesso di
esercitare ogni ramo senza costruire richieste Express reali.

### 2. Modelli contro un DB reale (`*.model.test.js`)

`user.model.test.js`, `customer.model.test.js`, `product.model.test.js`, `category.model.test.js`,
`productImage.model.test.js`, `productCategory.model.test.js`. Qui il modello **non** è mockato: si crea
davvero una riga nel DB di test e si verifica il comportamento reale — vincoli `UNIQUE`, foreign key,
validazioni di formato (es. `isEmail` su `Customer`), default, associazioni (`include`), soft delete
(`paranoid: true` su `Category`/`ProductImage`).

Questi vincoli non sono verificabili con un modello mockato, che per definizione fa quello che gli si dice
di fare. Un esempio concreto trovato scrivendoli: `Product.create({ createdBy: 999999 })` con un modello
mockato "funzionerebbe" sempre, perché il mock non sa che `createdBy` ha una foreign key verso `users.id`
(vedi la migrazione `20250720131154-add-createdBy-to-products.js`) — solo un DB reale può rifiutarlo.

**Ogni file traccia gli id che crea e li ripulisce** in `afterEach`/`afterAll`, e chiude sempre la
connessione con `sequelize.close()` in `afterAll`. Senza questo, ogni riesecuzione della suite fallirebbe
per violazione di vincoli `UNIQUE` (email, `sku`, nome categoria), e Jest resterebbe appeso in attesa che le
connessioni si liberino. Per `Category`/`ProductImage` (paranoid) la pulizia usa
`{ force: true, paranoid: false }`: un soft-delete (`deletedAt` valorizzato ma riga ancora presente)
occupa comunque lo slot dell'indice `UNIQUE` finché non viene cancellato fisicamente.

**Un dettaglio non ovvio scoperto testando**: subito dopo `Model.create()`, un campo nullable senza
`defaultValue` esplicito nel modello resta `undefined` sull'istanza in memoria, non `null` — anche se la
colonna nel DB è davvero `NULL`. Sequelize non ri-legge la riga dopo l'INSERT. I test che verificano questo
tipo di campo (`Product.sku`, `Customer.current_token`/`address`) chiamano `.reload()` prima di asserire,
per controllare lo stato vero nel DB invece di un artefatto della cache in memoria di Sequelize.

### 3. Route end-to-end con supertest (`*Routes.test.js`)

`customerRoutes.test.js`, `userRoutes.test.js`, `productRoutes.test.js`, `listRoutes.test.js`. Questi
fanno richieste HTTP vere con `supertest(require('../index'))` — l'app Express così com'è, con
`responseFormatter`, `express.json()`, i router reali, `express-validator`, i controller, i services, i
modelli, fino al DB di test. Non viene mockato assolutamente nulla: è l'unico modo per verificare che tutti
i pezzi, già testati singolarmente nelle altre due categorie, funzionino correttamente anche insieme.

Il caso d'uso più significativo coperto qui, impossibile da verificare con dei mock: il **pattern di
invalidazione del token** descritto in CLAUDE.md. `userRoutes.test.js` registra un utente, fa login,
chiama `POST /admin/user/logout`, e poi verifica che lo stesso identico JWT, usato subito dopo, venga
rifiutato con `401 Token non più valido` — e lo stesso per il cambio password (la vecchia password smette
di funzionare al login, la nuova sì). Questo comportamento dipende dalla colonna `current_token` nel DB;
un test con modello mockato potrebbe solo *assumere* che la logica sia corretta, non verificarlo davvero.

Altri dettagli emersi scrivendo questi test:

- **`POST /products/new` è ancora uno stub** (vedi CLAUDE.md → "Parte nota come incompleta"), quindi non
  può essere usato per creare dati di prova per `GET /products`: i prodotti vengono creati direttamente
  via modello (`Product.create(...)`) nei `beforeAll`. Il test su `POST /products/new` verifica comunque a
  fondo l'intera pipeline di validazione (upload, mimetype, conteggio file — il limite
  `checkNumberFilesMiddleware` collegato in una fase precedente di questa sessione — dimensioni, campi testuali), e fissa
  deliberatamente il comportamento noto: una richiesta valida supera tutta la validazione ma non crea
  nessuna riga (`res.body.data` è `{}`). Il commento nel test spiega esplicitamente che se questo test
  fallisce in futuro, è il segnale che `createProduct` è stato finalmente implementato, non un regressione
  da "correggere" meccanicamente.
- **Nessun endpoint eleva un utente a `superadmin`** (il default di registrazione è sempre `admin`): per
  testare la visibilità "tutti i prodotti" del superadmin, il test aggiorna il `level` direttamente via
  modello dopo la registrazione — esattamente il modo in cui andrebbe fatto anche in un ambiente reale,
  vedi `backend/docs/API.md`.
- **I file caricati durante il test che supera la validazione finiscono davvero su disco**
  (`middlewares/uploadMiddleware.js` scrive in `backend/uploads/`, percorso relativo alla working directory
  del processo). Dato che `createProduct` non li ripulisce mai (altro gap noto), il test stesso cattura la
  lista dei file prima/dopo la richiesta e cancella quelli nuovi, per non lasciare file orfani ad ogni
  esecuzione della suite.
- **Dati univoci per evitare collisioni**: ogni test che registra un utente/cliente usa un'email con
  timestamp + suffisso random (es. `user-route-test-${Date.now()}-${Math.random()...}@example.com`), non
  valori fissi. Jest esegue i file di test in parallelo per default (worker separati): usare la stessa
  email in due file diversi avrebbe fatto fallire in modo intermittente il secondo file, in base
  all'ordine di esecuzione.

## Come verificare che la suite sia davvero a posto

Non ci si è fermati al primo run verde. Per ogni categoria, e poi sulla suite intera, i test sono stati
rieseguiti **più volte di seguito** (compreso con `npm test`, cioè con `pretest` incluso, in modalità
parallela di default e non solo con `--runInBand`) per verificare che la pulizia dei dati funzionasse
davvero e che non ci fossero dipendenze accidentali dall'ordine di esecuzione. È stato anche controllato a
mano il contenuto di `backend/uploads/` prima e dopo, per confermare che non restassero file caricati dai
test.

Risultato finale: **26 file di test, 120 test, tutti verdi**, ripetibili senza intervento manuale.

## Cosa NON è stato toccato, e perché

- **`routes/*.js` in sé** non aveva bisogno di modifiche: i quattro file `*Routes.test.js` verificano
  anche il mounting (prefissi `/`, `/admin`, `/products`, nessun prefisso per `/routes`), senza che fosse
  necessario cambiare come le route sono definite.
- **Nessun modello o controller esistente è stato modificato** per rendere possibile questo lavoro — le
  uniche modifiche fuori da `__tests__/` sono le tre limitate a `config.json`, `models/index.js` e
  `package.json` descritte sopra. I test si adattano al comportamento reale del codice, non viceversa
  (l'unica eccezione concettuale è il test su `createProduct`, che fissa consapevolmente un comportamento
  noto come incompleto, non lo "corregge").

## Convenzioni da seguire aggiungendo nuovi test in futuro

- Logica applicativa pura → `*.test.js` con mock, come sempre fatto nel progetto.
- Nuovo modello o vincolo da verificare → `*.model.test.js`: niente mock su `../models`, traccia gli id
  creati, ripulisci in `afterEach`/`afterAll` (con `force: true, paranoid: false` se il modello è
  paranoid), chiudi la connessione con `sequelize.close()`.
- Nuova route o flusso multi-step → `*Routes.test.js` con `supertest(require('../index'))`, dati univoci
  per evitare collisioni in esecuzione parallela, cleanup di eventuali righe/file creati.