# Assessment: migrazione da Express a NestJS

Stato: **assessment, nessun codice scritto.** Segue il metodo già usato per la migrazione a Prisma:
prima questo report (inventario, punti critici, decisioni da prendere), poi il via libera, poi
l'implementazione a commit incrementali.

Baseline verificato oggi, non ripreso dal CHECKPOINT: **28 suite / 140 test verdi**, `tsc --noEmit`
pulito. Tutte le affermazioni qui sotto derivano dalla lettura dei file reali, non dalle note di
sessione.

---

## 1. Inventario della superficie da migrare

Il codice di produzione del backend è **~1.250 righe** di TypeScript, contro **~2.900 righe di test**.
Il rapporto è la notizia principale di questo inventario: il lavoro vero non è riscrivere
l'applicazione, è ricondurre la suite di test al nuovo modello.

| Categoria | File | Endpoint / note |
|---|---|---|
| Router | 5 (`adminRoutes`, `userRoutes`, `customerRoutes`, `productRoutes`, `listRoutes`) | **12 endpoint HTTP** totali |
| Controller | 7, di cui **3 non vivi** | vedi sotto |
| Middleware | 10, di cui **1 morto** | 4 formano la catena di upload |
| Service | 4 (`authService`, `registerService`, `tokenService`, `emailNormalizer`) | |
| Classi | 1 (`InvalidImageTypeError`) | |
| Config | 3 (`databaseUrl`, `imageConfig`, `logger`) | |
| Data layer | `prisma/` | **non toccato dalla migrazione** |

**I 12 endpoint**: `GET /`, `POST /register`, `POST /login` (customer); `GET /admin/user`,
`PATCH /admin/user`, `POST /admin/user/register`, `POST /admin/user/login`,
`PATCH /admin/user/password`, `POST /admin/user/logout`; `GET /products`, `POST /products/new`;
`GET /routes`.

### Codice morto trovato durante l'inventario

Non era nelle note. Va deciso cosa farne **prima** di iniziare, perché tre di questi file
altrimenti verrebbero migrati per inerzia:

- `controllers/customer/profileCustomerController.ts` è **un file vuoto** (0 byte).
- `middlewares/skipIfValidationErrorsMiddleware.ts` non è montato da nessuna parte e, anche se lo
  fosse, entrambi i rami chiamano next: non salta mai nulla nonostante il nome. Già documentato come
  tale nel file stesso.
- `controllers/listRoutesController.ts` è il caso più grosso: **120 delle sue 156 righe sono una
  funzione interamente racchiusa in un commento** (il blocco JSDoc aperto a riga 3 si chiude solo a
  riga 122). Quello che resta vivo fa console.debug delle route e risponde `res.success([])` — cioè
  l'endpoint `GET /routes` restituisce un array vuoto. Dipende da `app.router.stack`, un dettaglio
  interno di Express 5.
- `controllers/exampleController.ts` non è montato su nessuna route ed è marcato nel file come
  esempio da non imitare. Fu **mantenuto su richiesta esplicita**, quindi non lo tocco senza una
  decisione.

---

## 2. Il vincolo che rende questa migrazione più semplice di quella a Prisma

`@nestjs/platform-express` 12.0.1 dipende da **express 5.2.1**, **multer 2.2.0** e **cors 2.8.6**.
Il progetto dichiarava già `express ^5.2.1`, `multer ^2.2.0`, `cors ^2.8.6`: gli stessi pacchetti alle
stesse versioni.

> **Correzione dopo l'implementazione di F0.** Presentare questo allineamento come una buona notizia
> era corretto solo a metà, e per multer era esattamente il contrario. NestJS non dichiara un range:
> **pinna multer alla versione esatta 2.2.0**, che è l'ultima *vulnerabile* di quella linea. Il
> progetto, avendo un range `^2.2.0`, era già salito a 2.3.0 da solo; installando NestJS npm ha
> aggiunto una **seconda copia annidata** di multer 2.2.0 dentro `node_modules/@nestjs/platform-express/`,
> riportando in casa 4 advisory high — fra cui *file size limit bypass via async fileFilter race
> condition*, cioè precisamente il meccanismo (`limits.fileSize` + `fileFilter`) su cui poggia la
> validazione degli upload di questo progetto. Risolto in F0 con un `overrides` (§8). La lezione
> generalizzabile: un pin esatto in una dipendenza transitiva non si allinea al tuo range, lo
> scavalca.

Due conseguenze concrete:

1. **Lo stack HTTP a runtime non cambia.** Cambia il modello di programmazione sopra di esso. Non
   c'è un motore nuovo da cui aspettarsi sorprese di comportamento — al contrario di Prisma 7, che
   aveva cambiato architettura sotto i piedi (driver adapter, `url` fuori dallo schema).
2. **Lo schema del database non viene toccato.** Zero migration, zero modifiche a
   `schema.prisma`. Il data layer è già agnostico rispetto al framework, quindi il raggio d'azione
   di questa migrazione si ferma all'HTTP layer. È la ragione per cui il protocollo di trade-off
   sui dati di AGENTS.md (Time, Deletion, Concurrency, Duplication, State) **non si attiva** qui:
   nessun modello nasce o cambia. Si attiverà in fase F6, con `createProduct`.

### Il prerequisito da verificare subito

NestJS usa i **decoratori legacy**, non quelli standard (Stage 3). Il progetto è su TypeScript
**6.0.3**, e la domanda non era ovvia. Verificato: `tsc --experimentalDecorators
--emitDecoratorMetadata` è ancora accettato da TS 6.0.3 ed esce con 0 sul codice attuale. Nessun
blocco.

Va comunque capito *perché* servono entrambi i flag, perché è il punto in cui la dependency
injection fallisce in silenzio se si sbaglia. `experimentalDecorators` abilita la sintassi.
`emitDecoratorMetadata` è quello che conta: fa emettere al compilatore, accanto a ogni classe
decorata, i **tipi dei parametri del costruttore** come metadata leggibili a runtime tramite
`reflect-metadata`. È così che NestJS, vedendo `constructor(private prisma: PrismaService)`, sa
*quale* provider iniettare — non esiste altro modo, perché i tipi TypeScript non sopravvivono alla
compilazione. Senza quel flag la DI non dà errore di compilazione: inietta `undefined`.

Per chi viene da PHP 8: è l'equivalente di quello che Symfony fa leggendo i type hint del
costruttore via Reflection. La differenza è che in PHP i type hint sono nel bytecode e la Reflection
li trova sempre; in TypeScript vanno esplicitamente *emessi*, altrimenti a runtime non c'è niente da
riflettere.

**Nuove dipendenze**: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`,
`reflect-metadata`, `rxjs`, `class-validator`, `class-transformer`; in dev `@nestjs/cli`,
`@nestjs/testing`. In uscita, a fine migrazione: `express-validator`.

---

## 3. Strategia: migrazione incrementale nello stesso processo

L'alternativa ingenua è riscrivere tutto su un branch e riaccendere l'app alla fine — con la suite
rossa nel mezzo per giorni, cioè senza rete proprio mentre si tocca l'autenticazione.

Esiste un'alternativa migliore, ed è resa possibile dal fatto che NestJS *è* Express sotto:
`NestFactory.create<NestExpressApplication>(AppModule)` incapsula una vera istanza Express, e
`app.use(...)` delega a quella. Quindi si può **montare i router Express esistenti dentro
l'applicazione NestJS** e migrare un dominio per volta, rimuovendo il relativo `app.use()` quando il
modulo NestJS che lo sostituisce è pronto.

Due condizioni di cui essere consapevoli:

- Finché un router legacy è montato, `responseFormatter` deve restare montato prima di esso, perché
  quei router chiamano `res.success`/`res.error`. Non è un conflitto: i router legacy non passano
  dall'interceptor NestJS (che si applica solo ai controller NestJS), quindi non c'è doppio
  incapsulamento della risposta.
- **L'ordine di registrazione fra i router legacy e il router di NestJS va verificato empiricamente
  in fase F1**, non dato per scontato: Express risolve per ordine di registrazione, e NestJS
  registra il proprio router durante l'inizializzazione dell'app. Con `GET /` presente sia in
  `customerRoutes` sia (in futuro) in un controller NestJS, chi vince dipende da quell'ordine. È
  esattamente ciò che la fase F1 serve a dimostrare, con la suite verde come prova.

---

## 4. Mappatura, pezzo per pezzo

| Oggi (Express) | Domani (NestJS) | Difficoltà |
|---|---|---|
| `responseFormatter` → `res.success` | Interceptor globale | Bassa |
| `responseFormatter` → `res.error` | **Exception filter** (non l'interceptor) | Media |
| `errorMiddleware` | Exception filter globale | Bassa |
| `noPathMiddleware` | Gestito dal framework (404 automatico) | Nulla: si cancella |
| `authUserMiddleware` | Guard + decoratore `@CurrentUser()` | Media |
| `prisma/client.ts` (singleton) | `PrismaService` iniettabile | Bassa |
| `authService`/`registerService` | Provider iniettabili | Bassa |
| `tokenService` | Provider + `@nestjs/config` | Bassa |
| Catena `express-validator` sui campi | DTO + `ValidationPipe` | Bassa |
| **Catena upload immagini (4 middleware + accumulo)** | `FileInterceptor` + pipe/validator custom | **Alta** |
| `listRoutesController` | Da cancellare (vedi D8) | Nulla |
| `types/express.d.ts` | In gran parte si cancella | Nulla |

### 4.1 Le risposte: attenzione, `res.error` si divide in due

`responseFormatter` fa due cose distinte in un solo file, e in NestJS finiscono in due posti
diversi: l'incapsulamento della risposta di successo è un **interceptor**, quello dell'errore è un
**exception filter** (che erediterà anche il logging Winston che oggi `res.error` fa quando riceve
un'istanza di Error).

Ma il punto delicato non è dove vive il wrapper. È che oggi i controller **chiamano res.error e
ritornano**, imperativamente:

```ts
// authUserController.login, oggi
if (user.success) {
  return res.success(user.token);
} else {
  return res.error(401, user.message);
}
```

In NestJS l'idioma è che il controller **lancia** (`throw new UnauthorizedException(...)`) e il
filter formatta. Quindi non cambia solo l'involucro: cambia la forma di ogni percorso d'errore in
ogni controller. Si può conservare lo stile attuale usando `@Res()`, ma iniettando l'oggetto
risposta grezzo si perde l'interceptor e si scrive codice NestJS che nessun revisore NestJS
riconoscerebbe. È la **decisione D1**.

C'è un guadagno collaterale: con le eccezioni, il ramo `catch (error) { return res.error(500, ...) }`
ripetuto in tutti e quattro i controller di auth **scompare**, perché un'eccezione non gestita
arriva al filter da sola. Sono ~5 righe per controller che oggi esistono solo per compensare
l'assenza di un catch-all funzionante.

### 4.2 L'autenticazione: qui i tipi migliorano da soli

Il pattern distintivo del progetto — JWT stateful confrontato con `current_token` nel DB — si
trasferisce su un guard **senza perdere nulla**: il guard inietta PrismaService, decodifica, confronta,
e lancia `UnauthorizedException` con gli stessi cinque messaggi di oggi (`Token mancante`, `Formato
token non valido`, `Token scaduto o non valido`, `Utente non trovato`, `Token non più valido`). I
test end-to-end che verificano l'invalidazione al logout restano validi parola per parola.

Due miglioramenti strutturali, non cosmetici:

1. **`req.user!` sparisce.** Oggi `productController.getProducts` usa l'asserzione non-null tre
   volte, e il commento nel file documenta che è un'assunzione non garantita dai tipi (la route è
   sempre preceduta dal middleware, ma il compilatore non lo sa). Un decoratore `@CurrentUser()`
   tipizzato `User` chiude il buco: il tipo non è più `User | undefined`, quindi non c'è più niente
   da asserire. Il debito che la migrazione a Prisma aveva dovuto *documentare* qui si **estingue**.
2. **I quattro `if (!user) return res.error(401, ...)` di `profileUserController` diventano
   irraggiungibili** e si cancellano, per lo stesso motivo.

### Conseguenze della scelta di passport (D3 = b)

Deciso di usare `@nestjs/passport` + `passport-jwt`. Cosa cambia concretamente rispetto a un guard
scritto a mano, perché non è solo "la stessa cosa con una libreria in mezzo":

- La logica si **divide in due punti**. `passport-jwt` si occupa da sé di estrarre il Bearer token
  dall'header e di verificare firma e scadenza; quello che resta al progetto va in una
  **JwtStrategy** che estende `PassportStrategy(Strategy)`, il cui metodo `validate(payload)` riceve
  il payload **già decodificato** e lì dentro fa la lettura dell'utente e il confronto con
  `current_token`. Il guard diventa una riga (`AuthGuard('jwt')`).
- **Il token grezzo non arriva più gratis a `validate()`.** È il dettaglio che conta, perché il
  confronto del progetto è fra la stringa del token e la colonna `current_token`: dal solo payload
  decodificato quella stringa non è ricostruibile (la firma dipende da header e segreto). Va quindi
  abilitato `passReqToCallback: true` nella configurazione della strategia, per ricevere la request
  in `validate(req, payload)` ed estrarne di nuovo il token. Senza quel flag il pattern di
  invalidazione **non è implementabile**, e il guasto sarebbe silenzioso nel modo peggiore: i token
  verrebbero accettati come validi in base alla sola firma, cioè un token revocato al logout
  continuerebbe a funzionare. È il punto da verificare con un test in F3, non da dare per fatto.
- I **cinque messaggi di errore distinti** di oggi non si conservano automaticamente. `AuthGuard`
  risponde con un 401 generico (`Unauthorized`) per tutto ciò che passport rifiuta: la distinzione
  fra `Token mancante`, `Formato token non valido` e `Token scaduto o non valido` va ricreata a mano
  sovrascrivendo `handleRequest()` nel guard. I tre test end-to-end che asseriscono quei messaggi
  sono il presidio.
- **Dipendenze in più**: passport 0.7.0 e passport-jwt 4.0.1, entrambe librerie mature ma ormai
  quasi ferme. Il costo è accettato consapevolmente in cambio della riconoscibilità.

In compenso il beneficio sui tipi descritto sopra (`@CurrentUser()` e la scomparsa di `req.user!`)
resta identico: quello dipende dal decoratore, non da chi verifica il token.

Nota sull'architettura da preservare: i due modelli di identità paralleli restano due moduli
separati. Oggi esiste solo `authUserMiddleware` e le route customer sono tutte pubbliche, quindi si
scrive **solo** AuthUserGuard. Un guard generico "per entrambe le entità" oggi non ha un secondo
chiamante: sarebbe la stessa astrazione prematura che la migrazione a Prisma ha già smontato una
volta, quando `authenticate(entityModel, ...)` è diventata due funzioni esplicite.

### 4.3 La dependency injection chiude una dipendenza nascosta

Oggi `authService` importa il singleton prisma direttamente:

```ts
import { prisma } from '../prisma/client';
```

È una dipendenza **nascosta**: non si vede nella firma di nessuna funzione, e per isolarla nei test
serve `jest.mock('../prisma/client', ...)`. Come provider, la stessa dipendenza diventa esplicita nel
costruttore, e nei test si sostituisce con un override del provider nel TestingModule invece di
patchare il sistema di moduli.

È il principio "dipendenze esplicite invece di stato nascosto" di Clean Code, e qui non è teoria: **5
delle 15 suite basate su mock esistono in quella forma solo per aggirare dei singleton a livello di
modulo** (`authService`, `registerService`, `productController`, `profileUserController`,
`authUserMiddleware`). È il guadagno architetturale più concreto di tutta la migrazione, ed è anche
la ragione per cui la riscrittura dei test non è puro costo.

Per chi viene da PHP: è la differenza fra `new PDO(...)` dentro la classe e il `PDO` passato dal
container di Symfony. Concetto identico.

### 4.4 La catena di upload: il punto difficile, e una complessità che svanisce

Questa è la parte più lontana dal modello NestJS, e vale la pena essere precisi sul *perché*. Non è
"express-validator contro class-validator". La catena attuale ha quattro caratteristiche che
`ValidationPipe` non riproduce:

1. un **accumulatore condiviso** (`req.validationErrors`) attraversato da quattro middleware;
2. un **corto circuito** su `isFatal` (il superamento dell'hard limit di multer vince su tutto);
3. un **raggruppamento per campo**, con gli errori sulle immagini raggruppati per filename;
4. **effetti collaterali**: `validateProductImageMiddleware` cancella i file temporanei dal disco
   quando la validazione fallisce.

La parte sui campi del prodotto (name, description, price, quantity) è una semplificazione vera: un
`CreateProductDto` con i decoratori di class-validator sostituisce le 15 righe di catena
`body(...).notEmpty()...` di `productRoutes.ts`.

La parte sull'immagine no. NestJS offre `FileInterceptor` (anch'esso multer) più `ParseFilePipe` con
`MaxFileSizeValidator` e `FileTypeValidator`, che coprono mimetype e byte. **Non coprono** il
controllo sulle dimensioni in pixel contro `imageConfig` maxWidth/maxHeight fatto con `image-size`,
né la pulizia dei file temporanei: serve un **FileValidator custom**, ed è codice da scrivere.

**La buona notizia**: il punto 2 sparisce gratis. `isFatal` esiste solo perché
`handleMulterErrorsMiddleware` deve chiamare `next()` per lasciar rispondere il validation handler a
valle — quindi l'errore fatale deve viaggiare *insieme* agli altri e poi essere ripescato con un
find. In NestJS un'eccezione lanciata interrompe la richiesta immediatamente: il superamento
dell'hard limit diventa una `PayloadTooLargeException` prima che la pipe di validazione venga
eseguita. La priorità dell'errore fatale passa da **flag da ricordare** a **proprietà strutturale**.
È complessità accidentale che si elimina, non un requisito che si perde.

La decisione aperta è la **forma della risposta d'errore** (**D2**), e va presa consapevolmente
perché è l'unico punto in cui questa migrazione può rompere il contratto API.

### 4.5 La configurazione: la politica fail-fast va preservata, non ereditata per caso

Il progetto ha una politica deliberata e documentata: **nessun fallback silenzioso**. I controlli
vivono sparsi (`server.ts` per PORT, `tokenService.ts` per JWT_SECRET e JWT_EXPIRES_IN,
`config/databaseUrl.ts` per le variabili del DB) e sono `throw` a livello di modulo.

`@nestjs/config` con uno schema di validazione fa la stessa cosa meglio: valida **tutte** le
variabili in un punto solo all'avvio, ed elenca tutte quelle mancanti insieme invece di fermarsi
alla prima. Ma sposta *quando* il controllo avviene, e su questo il progetto è sensibile, perché il
commento in `tokenService.ts` argomenta esplicitamente che il controllo sta a livello di modulo per
essere eseguito al primo import, "ben prima che server.ts chiami app.listen()".

Verifica: con `@nestjs/config` la validazione gira durante `NestFactory.create`, quindi **prima di
`app.listen()`**. La garanzia che conta — l'app non parte mai con un segreto indovinato — è
preservata. È la **decisione D5**.

Nota collaterale: cancellare `listRoutes` (D8) rimuove `SHOW_ROUTES` dal contratto di `.env`, quindi
tocca anche `.env.example` e la documentazione.

---

## 5. La suite di test: dove sta il lavoro vero

140 test, 28 suite alla stesura di questo assessment; **145 test / 29 suite** dopo F0, che ne ha
aggiunti 5 (i 3 di `errorHandling.test.ts` più 2 sul contratto di arità). La ripartizione qui sotto si
riferisce alle 28 suite originali:

| Destino | Suite | Test | Quali |
|---|---|---|---|
| **Intatti** | 9 | 31 | i 6 `*.model.test.ts` (20 test, DB reale, non sanno cosa sia Express) + `emailNormalizer`, `tokenService`, `InvalidImageTypeError` |
| **Adattati al bootstrap** | 4 | 28 | i 4 `*Routes.test.ts` con supertest |
| **Riscritti** | 15 | 81 | le suite basate su mock di controller e middleware |

**I 28 test end-to-end sono la rete di sicurezza della migrazione**, e questo determina l'ordine
delle fasi. Asseriscono su status HTTP e forma del body — cioè esattamente il contratto che la
migrazione deve conservare — e attraversano tutto lo stack fino a PostgreSQL. L'unica cosa che
cambia in loro è il bootstrap: da `import app from '../index'` a
`Test.createTestingModule(...)` più `app.getHttpServer()`. Le asserzioni restano.

Da qui una conseguenza controintuitiva ma importante: **vanno adattati per primi** (fase F1, quando
NestJS ancora non serve nemmeno un endpoint proprio e i router legacy sono montati dentro), non per
ultimi. Se li si adatta alla fine, si riscrive tutto senza rete.

Gli 81 test da riscrivere non sono copertura perduta: come detto in 4.3, buona parte di essi esiste
nella forma attuale per aggirare i singleton. Nel TestingModule diventano più corti e più diretti.
Alcuni **scompaiono legittimamente** perché verificano codice che il framework assorbe:
`noPathMiddleware` (1 test — il 404 è del framework), `listRoutesController` (4 test, se si accetta
D8), e parte di `responseFormatter` (7 test).

**Papercut pre-esistente, non causato da questa analisi**: `docker compose run --rm test_backend`
oggi **falla** con `sh: prisma: not found`, perché quel servizio ha un volume anonimo
`/app/node_modules` stantio rispetto all'immagine. La suite l'ho eseguita nel container `backend`
già in esecuzione (stessa immagine, stesso DB), da cui i 140 verdi. Conviene sistemarlo quando si
tocca Docker in F0/F1, non prima.

---

## 6. Decisioni prese

Decise il 2026-09-12. Tutte le raccomandazioni sono state accolte **tranne D3**, dove la scelta è
ricaduta sull'opzione (b): `@nestjs/passport` + `passport-jwt`. Le conseguenze di quella scelta sono
descritte in §4.2.

| # | Decisione | Opzioni | Esito |
|---|---|---|---|
| **D1** ✓ | Stile degli errori nei controller | (a) `throw HttpException` idiomatico; (b) conservare `res.error` via `@Res()` | **(a)**. (b) rinuncia a interceptor e filter, cioè al motivo per cui si migra |
| **D2** ✓ | Forma della risposta di errore di validazione | (a) preservarla identica con `exceptionFactory` custom; (b) adottare il default NestJS; (c) ibrida: envelope e raggruppamento per campo conservati, `isFatal` eliminato | **(c)**. (b) è un breaking change che costringe a riscrivere le asserzioni dei 28 test e2e proprio dove servono; (a) porta avanti anche la complessità accidentale |
| **D3** ⚠ | Autenticazione | (a) guard scritto a mano; (b) `@nestjs/passport` + `passport-jwt` | **(b) — scelta dell'utente**, contro la mia raccomandazione (a). Motivazione: riconoscibilità in ambito enterprise. Impatto reale in §4.2 |
| **D4** ✓ | Accesso a Prisma | (a) `PrismaService` iniettabile; (b) mantenere il singleton | **(a)**. È ciò che rende iniettabile tutto il resto. Attenzione: `seed.ts` e `seed-dev.ts` girano fuori da NestJS e devono continuare a funzionare |
| **D5** ✓ | Configurazione | (a) `@nestjs/config` con validazione centralizzata; (b) lasciare i throw sparsi | **(a)**, la politica no-fallback è preservata (vedi 4.5) |
| **D6** ✓ | Toolchain | (a) `@nestjs/cli` (`nest start --watch`); (b) restare su nodemon + ts-node | **(a)**. Richiede di rifare il wiring del debugger: `--debug 0.0.0.0:9229` al posto del flag `--inspect` attuale, e `CMD` nel Dockerfile |
| **D7** ✓ | Il bug di arità di `errorMiddleware` | (a) correggerlo **prima**, in Express, con un test e2e che prima falla; (b) lasciarlo assorbire dalla migrazione | **(a)**. Un exception filter non può riprodurre il bug, quindi con (b) la correzione avviene senza che nessun test l'abbia mai dimostrata. Con (a) si guadagna un test di regressione sul JSON malformato → 400 |
| **D8** ✓ | `listRoutesController` + `GET /routes` | (a) cancellare (eventualmente `@nestjs/swagger` al suo posto); (b) portarlo | **(a)**. Restituisce già un array vuoto, 120 righe su 156 sono commentate, e dipende da un interno di Express. Swagger dà un vero OpenAPI in poche righe |
| **D9** ✓ | Gli altri file morti | `profileCustomerController` (vuoto), `skipIfValidationErrorsMiddleware` (no-op) | cancellare entrambi. Su `exampleController`, che fu tenuto su tua richiesta: **decidi tu** — resta fuori dal grafo dei moduli o esce dal repo |
| **D10** ✓ | Logger | (a) adapter Winston come `LoggerService` di NestJS; (b) lasciare il singleton | **(a)**, basso costo. Con (b) i log del framework vanno su stdout e quelli applicativi in `logs/`: due sistemi separati |

---

## 7. Piano a fasi

Ogni fase è un commit (o pochi), e **ogni fase finisce con la suite verde**. Le stime sono per
sessione serale.

| Fase | Contenuto | Sessioni |
|---|---|---|
| **F0** ✅ | Dipendenze, flag dei decoratori in `tsconfig`, fix di `test_backend`, D7 (fix arità + test). Nessun cambio di comportamento voluto, tranne D7. **Fatta**, vedi §8 | 1 |
| **F1** | `main.ts`, `AppModule`, `PrismaService`, `ConfigModule` con validazione (**spostata qui da F0**: `ConfigModule.forRoot({ validate })` richiede un grafo dei moduli, che in F0 non esiste ancora), interceptor + exception filter + logger. NestJS fa da host e **monta tutti i router legacy** via `app.use()`. I 4 test e2e ripuntati sul TestingModule. **Checkpoint: 145 verdi** — è qui che la strategia si dimostra | 1-2 |
| **F2** | CustomerModule (3 endpoint, nessun guard, nessun upload): il dominio più semplice, stabilisce l'idioma controller/service/DTO e applica D1+D2 | 1 |
| **F3** | AuthUserGuard, `@CurrentUser()`, UserModule (6 endpoint). Muoiono `authUserMiddleware` e i quattro controlli ridondanti di `profileUserController` | 2 |
| **F4** | ProductModule: `GET /products` e tutta la catena di upload/validazione (la parte difficile). Qui rientra la **paginazione** sospesa dal percorso PostgreSQL, dato che l'handler viene riscritto comunque | 2-3 |
| **F5** | Rimozione dello scaffolding legacy e del codice morto (D8, D9), uscita di `express-validator`, aggiornamento di `AGENTS.md`, `CLAUDE.md`, `API.md`, `TESTING.md`, `CHECKPOINT.md` e del Design Decisions Log | 1 |
| **F6** | `createProduct` implementato nativamente in NestJS, con transazione. È l'obiettivo di apprendimento rinviato, e **qui il protocollo di trade-off sui dati si attiva davvero** (Concurrency, Duplication) | 1-2 |

**Totale: 9-13 sessioni**, coerente con la stima 10-15 già data, ora ancorata all'inventario.

Un'osservazione sull'ordine: F4 è l'unica fase con incognite reali (il FileValidator custom, la
forma della risposta d'errore). F2 e F3 vengono prima non per facilità, ma perché stabiliscono
l'idioma del progetto su domini dove non c'è niente da inventare — così in F4 si discute solo del
problema difficile.

---

## 8. Registro di esecuzione — F0 (completata il 2026-09-12)

Stato finale: **29 suite / 145 test verdi**, type-check pulito, lint con il solo warning pre-esistente
su `hardLimitMB`. Nessun codice NestJS ancora scritto: F0 prepara il terreno e non cambia
comportamento, con l'unica eccezione voluta di D7.

### Fatto

- Dipendenze aggiornate e NestJS 12 installato: `@nestjs/core`/`common`/`platform-express`/`testing`
  12.0.1, `@nestjs/config`/`passport`/`cli` 12.0.0, passport 0.7.0, passport-jwt 4.0.1,
  class-validator 0.15.1, class-transformer 0.5.1, rxjs 7.8.2, reflect-metadata 0.2.2. Aggiornati
  anche eslint 10.10.0, typescript-eslint 8.70.0, @types/node 26.5.1.
- `experimentalDecorators` e `emitDecoratorMetadata` attivati in `tsconfig.json`, con il commento che
  spiega perché servono entrambi e perché dimenticare il secondo non produce un errore di
  compilazione.
- **D7 eseguito**: corretta l'arità di `errorMiddleware`. Aggiunto prima il test che dimostra il bug
  (`__tests__/errorHandling.test.ts`), verificato rosso, poi applicata la correzione.
- `docker-compose.yml`: volume `node_modules` da anonimo a nominato e condiviso, e `DB_HOST` aggiunto
  a `test_backend`.
- `docs/API.md` e `docs/TESTING.md` aggiornati.

### Cose emerse solo implementando (nessuna prevista dall'assessment)

1. **TypeScript resta a 6.0.3: non può salire a 7.** La richiesta era di aggiornare tutto all'ultima
   versione, e TypeScript 7.0.2 esiste, ma due peer dependency lo escludono: `ts-jest` dichiara
   `typescript: >=4.3 <7` e `typescript-eslint` dichiara `>=4.8.4 <6.1.0`. Aggiornarlo romperebbe il
   transformer che fa girare l'intera suite — cioè la rete di sicurezza della migrazione — e il
   linter. Da rivalutare quando ts-jest supporterà la linea 7.
2. **Il pin di multer di NestJS reintroduceva 4 vulnerabilità high** (vedi la correzione in §2).
   Risolto con `overrides: { "multer": "$multer" }` in `package.json`: la sintassi `$nome` significa
   "ogni copia annidata usa la stessa versione della dipendenza diretta", quindi non va tenuta
   allineata a mano a ogni aggiornamento. Nota: npm rifiuta un override che contraddice una
   dipendenza diretta (`EOVERRIDE`), quindi il range diretto è stato portato a `^2.3.0`. Verificato
   che la copia annidata non viene più creata e che l'audit è tornato da 8 a 5 high.
3. **Il servizio `test_backend` era rotto da due cause indipendenti, non una.** Il volume anonimo
   `/app/node_modules` conteneva ancora i binari `sequelize` e `sequelize-cli`: Compose **riusa** il
   volume anonimo di un servizio invece di reinizializzarlo dall'immagine, quindi quel volume
   risaliva a prima della migrazione a Prisma e non conteneva `prisma`. Risolto il primo problema, ne
   è emerso un secondo: `test_backend` non ha mai avuto `DB_HOST`, che non sta in `.env` ma solo nel
   blocco `environment` del servizio `backend` — quindi `config/databaseUrl.ts` si rifiutava di
   comporre l'URL. **Conseguenza da tenere a mente: il comando documentato
   `docker compose run --rm test_backend` non funzionava dalla migrazione a Prisma in poi**, e la
   suite veniva eseguita per altre vie. Ora funziona.
4. **Correggere l'arità ha fatto emergere 5 errori di compilazione**, tutti nei punti di chiamata di
   `errorMiddleware.test.ts` (`Expected 4 arguments, but got 3`). È un effetto desiderabile: il
   contratto con Express, che prima viveva solo in un commento, è ora verificato dal compilatore ai
   punti di chiamata.
5. **`eslint --fix` ha rimosso due volte la direttiva `eslint-disable-next-line`** prima che ne
   capissi il motivo. La prima volta perché elencava anche una regola non necessaria
   (`no-unused-vars`): la config del progetto ignora già `next` fra i parametri non usati
   (`argsIgnorePattern: 'next|^_'`), quindi la direttiva risultava in parte inutilizzata e `--fix` la
   cancella. La seconda perché `disable-next-line` vale per la riga immediatamente successiva, e
   spezzando la firma su più righe la riga con `any` non era più quella dopo il commento. Ora la
   direttiva sta direttamente sopra il parametro `err`.
6. **Prettier non è imposto da nessuno script del progetto** e tre dei file toccati risultavano già
   non conformi prima di queste modifiche (`tsconfig.json`, `errorMiddleware.ts`,
   `errorMiddleware.test.ts`). Verificato confrontando con le versioni a HEAD, e **deliberatamente
   non riformattati**: l'avrebbe trasformato in un commit di rumore. `eslint-config-prettier` serve
   solo a disattivare le regole eslint in conflitto, non a formattare.

### Debito aperto, da affrontare in F4

**`image-size` ha 2 advisory high senza correzione disponibile** (denial of service per loop infinito
nei parser ICNS, JXL e HEIF). Non è transitiva: è la libreria con cui
`validateProductImageMiddleware` misura le dimensioni dei file **caricati dagli utenti**. Il
middleware chiama `sizeOf` solo se il mimetype è `image/jpeg` o `image/png`, ma quel mimetype arriva
dall'header `Content-Type` della richiesta, che è sotto controllo di chi carica: un file ICNS
dichiarato come `image/png` raggiunge il parser vulnerabile. Va affrontato quando quella validazione
viene riscritta in F4 — le strade sono validare i **magic bytes** invece di fidarsi del mimetype
dichiarato, oppure sostituire la libreria.

Nota sulle 3 advisory high che restano (`deepmerge-ts` e `mysql2`, via `@prisma/config`): sono
transitive della CLI di Prisma, che è una devDependency e non gira in produzione. `npm audit fix
--force` le "risolverebbe" **retrocedendo prisma a 6.19.3**, disfacendo la migrazione a Prisma 7: non
va eseguito.

---

## 9. Cosa questo assessment non copre

- **Il frontend**, fermo allo scaffold Vite, non è toccato. Il backend continua a servire solo JSON e
  a permettere CORS da `localhost:3000`.
- **La performance.** La migrazione non rende niente più veloce: lo stack HTTP è lo stesso (§2). La
  paginazione mancante di `GET /products` resta un problema reale e viene risolta in F4 perché
  l'handler si riscrive comunque, non come effetto della migrazione.
- **La checklist di validazione** di `CLAUDE.md` non si applica a questo documento (nessun codice
  generato), ma si applicherà a ogni fase: F3 e F4 toccano auth e input utente, quindi lì Input /
  Confini del dominio / Fallimento / Sicurezza / Leggibilità futura vanno percorsi in prosa, non
  saltati.
