# CLAUDE.md

Questo file fornisce indicazioni a Claude Code (claude.ai/code) per lavorare con il codice di questo repository.

## Panoramica del progetto

Piccol è un progetto e-commerce costruito come portfolio piece Node.js/Express, per mostrare un'architettura
backend rigorosamente a livelli. Il backend è la parte attivamente sviluppata; il frontend (React + Vite) è
al momento solo lo scaffold di Vite e **non** è l'oggetto del lavoro — non aggiungere funzionalità frontend
a meno che non venga esplicitamente richiesto.

**Il backend è un'applicazione NestJS su Fastify.** È stata migrata da Express a fasi (F0–F5), poi F6 ha
implementato la creazione dei prodotti con le transazioni, e **F7 ha tolto Express anche come piattaforma
HTTP**: `@nestjs/platform-fastify` al posto di `@nestjs/platform-express`. Tutte le fasi sono concluse. Il
documento di riferimento è `backend/docs/MIGRAZIONE-NESTJS.md` (decisioni prese, piano, registro di ogni
fase); lo stato di ripresa è in fondo a `CHECKPOINT.md`.

**Express, multer e passport non sono più dipendenze del progetto**, e nessun file li importa: non
reintrodurli. NestJS non è un server HTTP, delega a una piattaforma, e questa è Fastify (scelta in
`main.ts`). Quando servono i tipi di una richiesta o di una risposta, si usa l'astrazione di NestJS
(`HttpAdapterHost`) o un tipo strutturale del progetto, non quelli della piattaforma.

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
  modelli di identità paralleli, il formato unico delle risposte, gli errori di validazione raggruppati
  per campo) o introduce un'incoerenza?
- **Fallimento**: se questa parte lancia un'eccezione, chi la intercetta? È coerente con
  `common/filters/all-exceptions.filter.ts`?
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
npm run dev     # nest start --watch, debugger su 0.0.0.0:9229; compila in dist/ ed esegue dist/main.js
npm run build   # nest build: compila in dist/ (con tsconfig.build.json)
npm start       # node dist/main, senza watch né debugger
npm test        # jest (i file di test sono in backend/__tests__/*.test.ts)
npm test -- credentialsService.test.ts   # esegue un singolo file di test
npm run lint    # eslint . --fix
npm run type-check   # tsc --noEmit
```

**Runtime: Node 24.9+** (immagine `node:24-alpine`, vincolo dichiarato in `engines`). Tutti i pacchetti
di NestJS 12 sono ESM-only: l'app compilata in CommonJS li carica comunque, ma il caricatore di moduli di
Jest ci riesce solo da Node 24.9 **e** con `--experimental-vm-modules`, che lo script `test` imposta in
`NODE_OPTIONS`. Lanciare `jest` direttamente senza quel flag fa fallire tutte le suite che importano NestJS
con "Must use import to load ES Module".

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

**Le dipendenze vanno installate anche sull'host.** `node_modules` dentro il container è un volume Docker,
separato da `backend/node_modules` sull'host: un `npm install` eseguito nel container non si vede
sull'host. Il server TypeScript di VS Code però gira sull'host, quindi dopo ogni modifica alle dipendenze
(aggiunta, rimozione, aggiornamento) va eseguito `npm ci` da `backend/` anche lì, altrimenti l'editor
segnala errori come `Cannot find module '@nestjs/platform-fastify'` su codice che compila benissimo nel
container. `npm ci` ricrea `node_modules` da zero, quindi subito dopo va rifatto `npm run generate` (vedi
qui sotto). Se l'errore resta visibile dopo l'installazione, l'editor tiene in cache la risoluzione dei
moduli: serve il comando "TypeScript: Restart TS Server".

**Il client Prisma va generato anche sull'host** (`npm run generate` da `backend/`), altrimenti VS Code
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
`main.ts`), `JWT_SECRET`, `JWT_EXPIRES_IN` (durata dei token, formato `jsonwebtoken` es. `1h`/`7d`),
`MAX_FILE_SIZE` (MB, intero, limite di business per le immagini caricate), `MAX_FILE_HARD_SIZE`
(MB, intero, limite hard del plugin di upload, letto davvero dalla fase F4; deve essere ≥ `MAX_FILE_SIZE`), `DB_ROOT_PASSWORD`, `DB_NAME`, e le porte pubblicate sull'host (`BACKEND_HOST_PORT`,
`BACKEND_DEBUG_PORT`, `DB_HOST_PORT`, `ADMINER_HOST_PORT`, `FRONTEND_HOST_PORT`).

**Nessuna di queste ha un fallback**: sia `docker-compose.yml` (via la sintassi `${VAR:?messaggio}`, che
fa fallire `docker compose` prima ancora di creare un container se una variabile manca) sia il codice Node
(`config/env.validation.ts`, `config/databaseUrl.ts`) si rifiutano esplicitamente di partire
con un errore leggibile se una di queste manca da `.env`, invece di far partire l'app con un valore
indovinato in silenzio. L'unica eccezione deliberata è `NODE_ENV`, letto in `config/databaseUrl.ts` e
`prisma/client.ts` senza obbligo: non fa parte del contratto di `.env` di questo progetto, è una
convenzione dell'intero ecosistema Node letta dal comando che avvia il processo — `npm run dev` non la
imposta mai esplicitamente, quindi pretenderla romperebbe l'avvio in sviluppo.

`docker-compose.yml` legge lo stesso `.env` in due modi complementari: lo interpola direttamente nel file
YAML (es. la mappatura delle porte del servizio `backend` è `"${BACKEND_HOST_PORT:?...}:${PORT:?...}"`, non
più numeri fissi) e lo inietta come variabili d'ambiente reali nel container tramite `env_file`, così l'app
Node lo trova in `process.env` a prescindere dal fatto che `backend/` (l'unica cartella montata nel
container) non contenga più `.env`. `backend/main.ts` punta comunque esplicitamente al nuovo percorso
(`path.resolve(__dirname, '..', '..', '.env')`, calcolato da `dist/`, dove main.ts gira compilato) come
rete di sicurezza per un'eventuale esecuzione diretta sull'host, fuori da Docker. Il caricamento deve
restare la prima istruzione di main.ts, perché `prisma/client.ts` compone la stringa di connessione già
all'import.
La validazione dell'intero contratto la fa invece `config/env.validation.ts`, passata a `ConfigModule`:
un solo errore che elenca tutte le variabili mancanti.

## Architettura

### Due modelli di identità paralleli

Ci sono due entità autenticate separate, con tabelle, route e controller indipendenti — **non** sono una
gerarchia condivisa di tipo "User":

- **User** (modello `User` in `prisma/schema.prisma`) — account interni/admin, `level` enum
  `admin`/`superadmin`, montato su `/admin/user`. **Migrato a NestJS in F3**: `modules/user/`. Le rotte
  protette usano `@UseGuards(AuthUserGuard)` (in `modules/auth/`, scritto a mano dalla fase F7) e ricevono
  l'utente con `@CurrentUser()`. Lo stesso guard protegge le rotte dei prodotti (dalla fase F4).
- **Customer** (modello `Customer` in `prisma/schema.prisma`) — clienti dello storefront, montato su `/`.
  **Migrato a NestJS in F2**: `modules/customer/` (controller, `CustomerAuthService`, DTO).

Entrambi condividono la stessa meccanica di autenticazione, ma **non** tramite una funzione generica sul
modello. Ogni identità ha il proprio service, che legge la propria tabella: `UserAuthService`
(`modules/user/`) e `CustomerAuthService` (`modules/customer/`). A essere condivisa è la logica di
sicurezza, non la query: `CredentialsService` (`modules/auth/credentials.service.ts`) fa hash e confronto
delle password, firma i token con `JwtService` e li salva tramite una funzione passata dal service
dell'identità. `authenticate` e `issueTokenFor` ricevono l'entità **già letta**, e lanciano
`UnauthorizedException` invece di restituire un esito. È anche l'unico punto del 401 di login, con un
messaggio unico ("Credenziali non valide") e bcrypt eseguito anche per gli account inesistenti, così né il
testo né la durata della risposta rivelano quali email sono registrate. Un'email già usata, in registrazione
o in aggiornamento del profilo, produce 409 tramite `rejectDuplicateEmail` (`modules/auth/duplicate-email.ts`). Non duplicare la logica di login/registrazione: se serve una terza entità autenticata, aggiungi la
sua query e riusa `CredentialsService`. Segreto, algoritmo (HS256) e scadenza dei token sono configurati
una sola volta in `modules/auth/auth.module.ts`.

**Pattern di invalidazione del token**: i JWT sono stateful. Al login/registrazione, il token firmato viene
scritto anche nella colonna `current_token` dell'entità. `AuthUserGuard` verifica il JWT *e* che corrisponda
a `current_token` nel DB: per questo confronto serve il token **grezzo**, non solo il payload, perché dal
payload la stringa firmata non è ricostruibile. Fino a F6 il guard ereditava da `AuthGuard` di
@nestjs/passport e la verifica stava in una `JwtUserStrategy` con `passReqToCallback: true`; dalla fase F7 è
una sola classe che implementa `CanActivate`. È questo che rende possibile invalidare i vecchi
token al logout / cambio password (il logout imposta `current_token = null`; i flussi di
password/2FA fanno lo stesso: dalla fase F3 `UserAuthService.changePassword` scrive la nuova password e
`current_token = null` nella stessa query, e il client deve rifare login).

**La registrazione è atomica** (dalla fase F6): creazione dell'entità e salvataggio del token stanno nella
stessa transazione interattiva, in `UserAuthService.register` e `CustomerAuthService.register`. Serve una
transazione interattiva e non una scrittura annidata perché il token contiene l'id, che esiste solo dopo
l'INSERT. Se l'emissione del token fallisce, l'account non resta registrato.

**Normalizzazione delle email (case-sensitivity)**: le email sono sempre salvate e cercate in minuscolo,
tramite `services/emailNormalizer.ts`. Non è un vezzo: su MySQL la collation case-insensitive di default
rendeva `Mario@x.com` e `mario@x.com` lo stesso valore (il vincolo `UNIQUE` rifiutava il duplicato, il
login funzionava con qualunque casing), mentre PostgreSQL confronta le stringhe in modo case-sensitive —
senza normalizzazione diventerebbero due account distinti per la stessa identità, ognuno col proprio
`current_token`, vanificando il pattern di invalidazione descritto sopra. La regola va applicata
esplicitamente in **ogni** punto che scrive o cerca un'email: oggi sono `UserAuthService.login` e
`CustomerAuthService.login` (login), `UserAuthService.register` e `CustomerAuthService.register`
(registrazione) e `UserProfileService.updateProfile` (aggiornamento del profilo). Scelta deliberata di una funzione esplicita invece di un meccanismo
automatico dell'ORM (un tempo un hook `beforeSave` di Sequelize, oggi una Prisma Client Extension): non
coprirebbe la query di lettura del login e renderebbe la regola stato nascosto (vedi Design Decisions Log
in AGENTS.md). `Category.name` e `Product.sku` restano invece **case-sensitive**: lì
il casing è significativo o indifferente, non un dettaglio da appiattire.

### Convenzioni di risposta ed errore

Il formato delle risposte è uno solo (`{ success, status, data, message }` in caso di successo,
`{ success, status, data: null, error }` in caso di errore). I controller restituiscono il dato nudo e
**lanciano** eccezioni HTTP (`throw new UnauthorizedException('...')`):
`common/interceptors/response-envelope.interceptor.ts` avvolge il dato (il messaggio di successo si dichiara
con `@ResponseMessage()`), `common/filters/all-exceptions.filter.ts` formatta le eccezioni. Attenzione: le
POST NestJS rispondono **201** di default, mentre il contratto delle POST esistenti è 200 — serve
`@HttpCode(200)`. Fino alla fase F5 il formato lo produceva anche `middlewares/responseFormatter.ts`
(`res.success` / `res.error`), rimosso con l'ultimo router Express.

`AllExceptionsFilter` è il gestore catch-all di tutta l'app: riceve anche gli errori dei middleware Express
propagati con `next(err)` e le rotte inesistenti (404 → "Non trovato"), che prima gestivano `errorMiddleware.ts` e
`noPathMiddleware.ts`, rimossi. Per un errore che non è una HttpException risponde 500 con un messaggio
generico e **non fa mai trapelare** il messaggio interno, che finisce solo nei log; logga soltanto i 5xx.
Il JSON malformato è tradotto in "errore json: ..." dal parser dei body JSON dell'app
(`common/middleware/json-content-type-parser.ts`): l'errore viene sostituito nel punto in cui nasce, perché a
valle il messaggio originale non sarebbe più distinguibile da un 400 qualsiasi. Un tipo di contenuto per cui
non esiste un parser (un body di form, o una richiesta senza `Content-Type` su una rotta multipart) riceve
**415**, con il messaggio inglese di Fastify tradotto dal filter.

`AllExceptionsFilter` non parla direttamente alla risposta: passa da `HttpAdapterHost`
(`reply`, `getRequestUrl`, `getRequestMethod`, `isHeadersSent`). È ciò che lo rende indipendente dalla
piattaforma — la reply di Fastify non ha il metodo `json()` di Express — e va mantenuto così.

### Validazione e upload (dalla fase F4)

Gli errori di validazione hanno una sola forma: un array di `{ id, message }`, un messaggio per campo, con
"è richiesto" che vince sugli altri vincoli (`common/validation/validation-exception.factory.ts`). Per il
body JSON lo produce la `ValidationPipe` globale; i DTO dichiarano i vincoli con class-validator.

L'upload dell'immagine di un nuovo prodotto (`POST /products/new`) passa da questi pezzi, nell'ordine in cui
NestJS li esegue:

1. `AuthUserGuard`: 401 prima che un solo byte venga salvato.
2. `ProductImageUploadInterceptor` (`modules/product/upload/`): legge il corpo multipart con
   `@fastify/multipart`, che scrive i file in `uploads/tmp/` con il limite hard `MAX_FILE_HARD_SIZE`
   (oltre: **413** `Operazione non permessa.`). **Cancella i file a qualunque errore successivo** (pipe,
   service), perché le pipe girano dentro il flusso che osserva. Rifiuta anche i file inviati in un campo
   diverso da `image`: il plugin, a differenza di multer, salverebbe qualunque campo.
3. `NewProductFormPipe`: valida **insieme** i campi (`CreateProductDto`) e le immagini
   (`ProductImageValidator`) e risponde con un'unica lista, prima i campi e poi un elemento `image` con i
   messaggi raggruppati per file. Due parametri separati (`@Body` + `@UploadedFiles`) avrebbero restituito
   gli errori in due richieste successive.
4. `ProductImageValidator`: tipo dichiarato, `MAX_FILE_SIZE`, contenuto reale e dimensioni massime
   (`config/imageConfig.ts`).
5. `ProductService.create`: prodotto e immagine nel database (vedi "Creazione dei prodotti e transazioni").

I file appena ricevuti stanno in `uploads/tmp/`, le immagini definitive in `uploads/`: **@fastify/multipart
cancella da sé, a ogni risposta, i file che ha scritto**, quindi un'immagine che deve sopravvivere alla
richiesta va spostata. Lo fa `storeUploadedImage` (`modules/product/upload/uploaded-files.ts`, dove sta tutto
ciò che riguarda quelle cartelle) dopo la validazione e **prima** dell'inserimento nel database: mai dopo, o
un errore dello spostamento lascerebbe una riga che punta a un file inesistente. `image_url` vale
`/uploads/<nome>.<estensione>`, con l'estensione decisa dal tipo **reale** del file, non da quello dichiarato.
Nessuna rotta serve ancora `uploads/`.

Prezzo e quantità hanno regole proprie (`modules/product/dto/product-field-rules.ts`): prezzo ≥ 0 con al
massimo 2 decimali ed entro `DECIMAL(10,2)`, quantità entro il massimo di un `integer`. Il prezzo resta una
**stringa** fino a Prisma, mai un number in virgola mobile.

**Regola di sicurezza**: le dimensioni si leggono solo con `readImageDimensions`
(`modules/product/upload/image-inspection.ts`), mai chiamando `image-size` direttamente. Quel modulo verifica
i magic bytes JPEG/PNG prima di interpellare la libreria e disattiva nella libreria ogni altro formato: i parser
ICNS/HEIF/JXL di image-size avevano vulnerabilità di denial of service senza correzione quando quelle difese
sono state scritte (corrette dalla 2.0.3; il progetto è sulla 2.0.4), e il Content-Type lo sceglie chi
carica. Le difese restano come difesa in profondità: valgono per qualunque falla futura di quei parser, e
il progetto accetta comunque solo JPG e PNG.

Il vecchio accumulatore `req.validationErrors` e la catena di middleware che lo scriveva non esistono più.

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

### Creazione dei prodotti e transazioni (fase F6)

`ProductService.create` (`modules/product/product.service.ts`) fa tre cose in **una sola transazione
interattiva** (`prisma.$transaction(async (tx) => ...)`):

1. prende un **advisory lock** per utente (`pg_advisory_xact_lock(1, userId)`), che si rilascia da solo al
   commit o al rollback;
2. cerca un **doppione**: stesso utente, stessi nome, descrizione, prezzo e quantità, creato negli ultimi
   `DUPLICATE_WINDOW_MS` (10 secondi). Se c'è, la risposta è quel prodotto, e il service cancella il file
   caricato dalla richiesta duplicata;
3. altrimenti inserisce prodotto e immagine con **una create annidata** (`images: { create: ... }`).

Tre regole da non violare modificando questo codice:

- **Dentro una transazione interattiva ogni query passa da `tx`**, mai da `this.prisma`: una query fatta con
  il client normale esce dalla transazione, senza nessun errore. È esattamente il guasto che i test di
  atomicità della registrazione fanno emergere.
- **Non alzare il livello di isolamento** di quella transazione. Il controllo dei doppioni funziona perché al
  livello predefinito, READ COMMITTED, la richiesta che ha aspettato il lock vede il prodotto appena
  confermato dall'altra. In REPEATABLE READ vedrebbe i dati com'erano prima, e creerebbe un doppione.
- **Il lock è per utente, di proposito**: due admin diversi creano prodotti in parallelo. Il primo numero
  della coppia (`PRODUCT_CREATION_LOCK`) distingue questo tipo di lock da quelli futuri: un nuovo tipo di
  advisory lock deve usare un numero diverso.

Una scrittura annidata da sola è già atomica: se serve solo creare righe collegate, non serve una transazione
interattiva. Qui serve per il lock, che deve comprendere controllo e inserimento.

Ancora da fare: il form non gestisce **categorie** (`product_categories`) né `sku`, e nessuna rotta serve le
immagini caricate.

### Struttura della suite di test

`backend/__tests__/` contiene due categorie di test, distinguibili dal nome file:

- **Unità con mock, nessun DB reale** (`*.test.ts`, es. `credentialsService.test.ts`,
  `productService.test.ts`): sostituiscono le dipendenze passando oggetti finti al costruttore o al
  TestingModule, non aprono connessioni. È lo stile usato dai test già presenti prima di questa sessione — preferiscilo per logica
  applicativa pura (controller, middleware, services).
- **Modelli contro un DB reale** (`*.model.test.ts`, es. `product.model.test.ts`): usano il client Prisma
  vero (nessun mock), verificano vincoli che vivono nel DB (unique, FK, NOT NULL, relazioni) contro
  `mydatabase_test`. Ogni file traccia gli id che crea e li ripulisce in `afterEach`/`afterAll`, e chiude
  sempre la connessione con `prisma.$disconnect()` in `afterAll` — altrimenti Jest resta appeso.
- **Route end-to-end con supertest** (`*Routes.test.ts`, es. `userRoutes.test.ts`): fanno richieste HTTP
  vere contro l'app avviata da `useTestApp()` (`__tests__/helpers/useTestApp.ts`: stesso `AppModule` e
  stessa `configureApp` di main.ts, senza `.listen()`). `useTestApp()` va chiamato **alla radice del
  file, fuori dal describe**: registra da sé avvio e chiusura, e da quella posizione la chiusura (che
  disconnette Prisma) gira sempre dopo gli `afterAll` di pulizia del describe. Le richieste usano
  `request(testApp.http)`; l'helper attende anche `ready()`, perché Fastify costruisce rotte e plugin in modo
  asincrono e prima di allora il server non risponde. Nessun file chiama più `close()` o `$disconnect()` a mano,
  attraversando l'intero stack fino al DB di test. Usano email/dati univoci per evitare collisioni tra
  test file eseguiti in parallelo, e ripuliscono le righe create in `afterAll`. `productRoutes.test.ts`
  cancella i prodotti **per proprietario** (quelli creati con POST /products/new non hanno un id noto in
  anticipo) e i file che le richieste riuscite lasciano in `backend/uploads/`; usa nomi di prodotto univoci,
  altrimenti la regola sui doppioni unirebbe prodotti di test diversi.
- **Comportamento trasversale all'app** (`errorHandling.test.ts`, `appInfrastructure.test.ts`): gestione
  degli errori, 404, parser dei body, dependency injection, involucro delle risposte. Stesso helper dei test
  di rotta; `appInfrastructure.test.ts` registra un controller di prova visibile solo nel test.

Quando aggiungi un test che tocca il DB (modello o route), segui questi due accorgimenti o la suite smette
di essere ripetibile: (1) usa dati univoci (email/nomi con timestamp o suffisso random) invece di valori
fissi, (2) ripulisci sempre quello che crei.

### Avvio e catena delle richieste (`backend/main.ts`, `backend/app.setup.ts`)

`main.ts` crea l'app NestJS da `app.module.ts` con `FastifyAdapter` e chiama `configureApp` (in
`app.setup.ts`), la stessa funzione usata dai test. Dalla fase F7 **non ci sono middleware**: `configureApp`
configura l'istanza Fastify (CORS, parser JSON, plugin multipart) ed è `async`, perché i plugin Fastify si
registrano così. L'ordine di esecuzione di una richiesta è quello di NestJS: parser del body → guard →
interceptor → pipe → handler, con `AllExceptionsFilter` su qualunque eccezione e il 404 in coda.

`app.listen(port, '0.0.0.0')`: il default di Fastify è `127.0.0.1`, che dentro un container non è
raggiungibile da fuori. Express ascoltava su tutte le interfacce.

Domini: Customer (`POST /register`, `POST /login`, in `modules/customer/`), User (le 6 rotte sotto
`/admin/user`, in `modules/user/`), Product (`GET /products`, `POST /products/new`, in `modules/product/`) e
l'health-check `GET /` (`health.controller.ts`). `GET /routes` e `SHOW_ROUTES` non esistono più (fase F5,
decisione D8).

**Il parser JSON di NestJS è disattivato di proposito** (`bodyParser: false` in `NEST_APP_OPTIONS`): l'app
registra il proprio, che conserva il messaggio "errore json: ...". Con entrambi, Fastify rifiuta l'avvio
("Content type parser 'application/json' already present"); e quello di NestJS accetterebbe anche i body di
form, allargando il contratto in silenzio. Non riattivarlo: il motivo è in `app.setup.ts`, ed è presidiato da
un test in `errorHandling.test.ts`.
