# Assessment: migrazione da Express a NestJS

Stato: **migrazione completata, F0–F5** (registri in §8–§13); resta **F6** (`createProduct` con una transazione). Segue il metodo già usato per la migrazione a Prisma:
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
| Controller | 6, di cui **2 non vivi** (erano 7: `exampleController` è stato cancellato, vedi §8) | vedi sotto |
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
- ~~`controllers/exampleController.ts`~~ — **cancellato** (vedi §8). Non era montato su nessuna route
  ed era marcato nel file come esempio da non imitare. Era stato mantenuto su richiesta esplicita come
  prova che la connessione diretta a PostgreSQL funzionasse: avendola data, non serve più.

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

> **Risolto in F1** (§9): vince sempre il router legacy, montato prima. Verificato nel sorgente di
> `init()` e da `__tests__/nestHosting.test.ts`.

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
| **D4** ✓ | Accesso a Prisma | (a) `PrismaService` iniettabile; (b) mantenere il singleton | **(a)**, affinata in F1: il token iniettabile è la classe `PrismaClient` stessa, con `useValue` sul singleton esistente, invece di una `PrismaService extends PrismaClient` che creerebbe un secondo pool (§9). `seed.ts` e `seed-dev.ts` continuano a usare il singleton, fuori da NestJS |
| **D5** ✓ | Configurazione | (a) `@nestjs/config` con validazione centralizzata; (b) lasciare i throw sparsi | **(a)**, la politica no-fallback è preservata (vedi 4.5) |
| **D6** ✓ | Toolchain | (a) `@nestjs/cli` (`nest start --watch`); (b) restare su nodemon + ts-node | **(a)**. Richiede di rifare il wiring del debugger: `--debug 0.0.0.0:9229` al posto del flag `--inspect` attuale, e `CMD` nel Dockerfile |
| **D7** ✓ | Il bug di arità di `errorMiddleware` | (a) correggerlo **prima**, in Express, con un test e2e che prima falla; (b) lasciarlo assorbire dalla migrazione | **(a)**. Un exception filter non può riprodurre il bug, quindi con (b) la correzione avviene senza che nessun test l'abbia mai dimostrata. Con (a) si guadagna un test di regressione sul JSON malformato → 400 |
| **D8** ✓ | `listRoutesController` + `GET /routes` | (a) cancellare (eventualmente `@nestjs/swagger` al suo posto); (b) portarlo | **(a)**. Restituisce già un array vuoto, 120 righe su 156 sono commentate, e dipende da un interno di Express. Swagger dà un vero OpenAPI in poche righe |
| **D9** ✓ | Gli altri file morti | `profileCustomerController` (vuoto), `skipIfValidationErrorsMiddleware` (no-op), `exampleController` | cancellare tutti e tre. `exampleController` cancellato in F0 (§8), `profileCustomerController` in F2 insieme al suo dominio (§10); `skipIfValidationErrorsMiddleware` in F4, insieme alla catena di upload (§12) |
| **D10** ✓ | Logger | (a) adapter Winston come `LoggerService` di NestJS; (b) lasciare il singleton | **(a)**, basso costo. Con (b) i log del framework vanno su stdout e quelli applicativi in `logs/`: due sistemi separati |

---

## 7. Piano a fasi

Ogni fase è un commit (o pochi), e **ogni fase finisce con la suite verde**. Le stime sono per
sessione serale.

| Fase | Contenuto | Sessioni |
|---|---|---|
| **F0** ✅ | Dipendenze, flag dei decoratori in `tsconfig`, fix di `test_backend`, D7 (fix arità + test). Nessun cambio di comportamento voluto, tranne D7. **Fatta**, vedi §8 | 1 |
| **F1** ✅ | `main.ts`, `AppModule`, `PrismaService`, `ConfigModule` con validazione (**spostata qui da F0**: `ConfigModule.forRoot({ validate })` richiede un grafo dei moduli, che in F0 non esiste ancora), interceptor + exception filter + logger. NestJS fa da host e **monta tutti i router legacy** via `app.use()`. I 4 test e2e ripuntati sul TestingModule. **Checkpoint: 145 verdi** — è qui che la strategia si dimostra | 1-2 |
| **F2** ✅ | CustomerModule (3 endpoint, nessun guard, nessun upload): il dominio più semplice, stabilisce l'idioma controller/service/DTO e applica D1+D2 | 1 |
| **F3** ✅ | AuthUserGuard, `@CurrentUser()`, UserModule (6 endpoint). Muoiono `authUserMiddleware` e i quattro controlli ridondanti di `profileUserController` | 2 |
| **F4** ✅ | ProductModule: `GET /products` e tutta la catena di upload/validazione (la parte difficile). Qui rientra la **paginazione** sospesa dal percorso PostgreSQL, dato che l'handler viene riscritto comunque | 2-3 |
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

   > **Correzione emersa in F1: le cause erano tre, non due.** `test_backend` girava su un'immagine
   > propria, `piccol-test_backend`, ferma a 9 mesi prima (Node 20.19.6), che nessuno ricostruiva.
   > In F0 la suite passava solo perché il volume condiviso l'aveva creato per primo il container
   > `backend`, con l'immagine aggiornata. Dettagli e correzione al punto 8 di §9.
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

### Coda di F0: cancellato `exampleController`

Deciso dopo il resto di F0. Il file esisteva come prova che la connessione diretta a PostgreSQL con `pg`
funzionasse, prova che è stata data; non era montato su nessuna route e contraddiceva l'architettura a
livelli di AGENTS.md (un controller che apre una connessione per conto proprio).

Due conseguenze sulle dipendenze, decise in modo diverso perché i due casi non sono simmetrici:

- **`@types/pg` rimosso** dalle devDependencies. Era stato aggiunto solo per questo file (`pg` non
  spedisce i propri tipi) e nessun altro file del progetto importa `pg`. Non sparisce comunque da
  `node_modules`: `@prisma/adapter-pg` lo dichiara fra le proprie dipendenze, quindi la nostra era una
  seconda dichiarazione della stessa cosa. Type-check verificato pulito dopo la rimozione.
- **`pg` mantenuto** fra le dipendenze, pur non essendo più importato da nessun file del progetto. Non
  è una dimenticanza: è il driver con cui l'app parla davvero con PostgreSQL, usato *attraverso*
  `@prisma/adapter-pg`, e la documentazione di Prisma per quell'adapter prescrive di installarlo
  esplicitamente (`npm install pg @prisma/adapter-pg`). Rimuoverlo funzionerebbe — l'adapter lo porta
  come propria dipendenza — ma renderebbe invisibile in `package.json` quale driver usa il progetto,
  che è esattamente il tipo di scelta che questo repository documenta altrove con cura.

Aggiornato anche un commento di `docker-compose.yml` che descriveva perché certe variabili *non* erano
lì citando questo file e `config/config.js` di Sequelize, entrambi ormai inesistenti.

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

## 9. Registro di esecuzione — F1 (completata il 2026-09-13)

Stato finale: **33 suite / 174 test verdi**, type-check pulito, lint con il solo warning pre-esistente su
`hardLimitMB`. Verificata anche l'app in esecuzione con `nest start --watch`: health-check, JSON
malformato, 404, e un flusso completo registrazione → profilo → logout → stesso token rifiutato con
"Token non più valido". Nessun comportamento visibile dal client è cambiato.

Conteggio: 145 − 8 (i test unitari di `errorMiddleware` e `noPathMiddleware`, rimossi con i middleware;
i loro casi sono stati portati nei nuovi test) + 37 nuovi = 174.

### Fatto

- **Avvio**: `main.ts` (sostituisce `index.ts` e `server.ts`), `app.module.ts`, e `app.setup.ts`, che
  contiene `configureApp` — la stessa funzione chiamata da main.ts e dall'helper dei test, perché i test
  attraversino la stessa catena della produzione.
- **Infrastruttura trasversale** in `common/`: `AllExceptionsFilter`, `ResponseEnvelopeInterceptor`,
  `WinstonLoggerService`. Più `middlewares/jsonSyntaxErrorMiddleware.ts` e `config/env.validation.ts`.
- **`PrismaModule`** globale e **`ConfigModule`** con validazione.
- **CLI di NestJS** (D6): `nest-cli.json`, `tsconfig.build.json`, script `dev`/`build`/`start`;
  `nodemon` rimosso; `dist/` aggiunto a `.gitignore`, `.dockerignore` ed eslint.
- **Le 5 suite e2e ripuntate** su `__tests__/helpers/createTestApp.ts`. Cambiato solo il bootstrap:
  le chiamate `request(app)` e **tutte le asserzioni sono rimaste identiche**, come previsto da §5.
- **Nuovi test** (37): `allExceptionsFilter`, `jsonSyntaxErrorMiddleware`, `responseEnvelopeInterceptor`,
  `envValidation`, `winstonLoggerService` (unitari) e `nestHosting` (e2e, con controller di prova).
- Documentazione allineata: `CLAUDE.md` (che ora rimanda anche a questo documento), `AGENTS.md`,
  `TESTING.md`, `API.md`, `.env.example`.

### L'incognita di §3, risolta

Dal sorgente di `@nestjs/core/nest-application.js`: `app.use()` scrive sull'istanza Express nel momento
della chiamata, mentre `init()` registra, **in quest'ordine**, body parser, rotte NestJS, gestore 404 e
gestore errori. Quindi la catena effettiva è:

    responseFormatter → CORS → express.json() → jsonSyntaxErrorMiddleware
    → router legacy → rotte NestJS → 404 NestJS → gestore errori NestJS

**Regola operativa per F2–F4**: su uno stesso metodo e percorso vince il router legacy. Il router di un
dominio va tolto da `mountLegacyRouters` **nello stesso commit** in cui nasce il suo modulo NestJS,
altrimenti la rotta nuova non è raggiungibile. `nestHosting.test.ts` lo verifica esplicitamente con un
controller NestJS su `GET /`, che resta oscurato dal router customer.

### Cose emerse solo implementando

1. **Tutti i pacchetti di NestJS 12 sono ESM-only, e questo ha imposto Node 24.** L'app compilata in
   CommonJS li carica anche su Node 20.19+, ma il caricatore di moduli di Jest no: la condizione, letta
   nel sorgente di `jest-runtime`, è che esista `vm.SourceTextModule.prototype.hasAsyncGraph`, cioè
   **Node 24.9+ e il flag `--experimental-vm-modules`**. Provato su Node 24.21 senza flag: fallisce
   ancora. Con il flag: 137/137 verdi, comprese le 15 suite basate su `jest.mock`. Immagine passata a
   `node:24-alpine`, flag nello script `test` (non nel Dockerfile: serve al test runner, non all'app),
   vincolo dichiarato in `engines`. Alternative scartate: tornare a NestJS 11 (contraddice la richiesta
   di usare le ultime versioni); la modalità ESM nativa di Jest (obbligherebbe a riscrivere tutti i
   `jest.mock` di 15 suite che F2–F4 riscrivono comunque). Node 20 era inoltre fuori supporto dal 30
   aprile 2026.
2. **Il body parser di NestJS andava disattivato.** `init()` lo registra dopo gli `app.use()`: i router
   legacy avrebbero ricevuto `req.body` vuoto. Soluzione: `bodyParser: false` e `express.json()` montato
   esplicitamente in testa. **Nota per F5**: quando i router legacy spariscono si potrà tornare al parser
   di NestJS, ma `jsonSyntaxErrorMiddleware` va conservato (o sostituito), altrimenti il messaggio
   "errore json: ..." si perde per il motivo del punto 3.
3. **`ExpressAdapter.mapException` converte il SyntaxError del parser in `new BadRequestException(message)`
   perdendo l'errore originale**: il filter non potrebbe più distinguere un JSON malformato da un 400
   qualsiasi. La traduzione in "errore json: ..." avviene quindi al confine Express, subito dopo il
   parser, dove l'informazione c'è ancora.
4. **Il 404 di NestJS non è distinguibile in modo strutturato** da una `NotFoundException` lanciata da un
   controller: il suo gestore lancia `NotFoundException('Cannot <METODO> <URL>')`. Il filter lo
   riconosce confrontando il messaggio esatto, URL compreso. È un accoppiamento al formato di NestJS,
   accettato consapevolmente e presidiato da `errorHandling.test.ts`.
5. **D4 affinata: niente `PrismaService extends PrismaClient`.** Sarebbe stata una seconda istanza, cioè
   un secondo pool di connessioni accanto al singleton usato dai router legacy — cosa che `AGENTS.md`
   vieta. Il token iniettabile è la classe `PrismaClient` stessa, con `useValue` sul singleton:
   `constructor(private readonly prisma: PrismaClient)`. `nestHosting.test.ts` verifica che l'istanza
   iniettata sia **la stessa** del codice legacy.
6. **Cambio deliberato di sicurezza nel filter.** Il vecchio `errorMiddleware` rispondeva con `err.message`
   anche per errori imprevisti, esponendo al client dettagli interni (testo di errori del database, nomi
   di tabelle). Il filter risponde 500 con "Qualcosa è andato storto!" per tutto ciò che non è una
   HttpException, e il dettaglio va solo nei log. Logga inoltre solo i 5xx, come già faceva `res.error`.
   Nessun test esistente dipendeva dal vecchio comportamento.
7. **Trappola per F2: le POST NestJS rispondono 201 di default**, quelle legacy 200. Migrando `POST
   /register` e `POST /login` serve `@HttpCode(200)`, altrimenti il contratto cambia. Fissato in un test.
8. **`test_backend` girava su un'immagine di 9 mesi prima.** Compose costruisce un'immagine per ogni
   servizio con `build:` (`piccol-test_backend`), e quella non veniva mai ricostruita: Node 20.19.6,
   dipendenze precedenti a Prisma. Il volume `node_modules` condiviso introdotto in F0 mascherava il
   problema a metà, perché si inizializza dall'immagine del **primo** container che lo crea: dopo un reset
   del volume, la suite funzionava o no a seconda di quale servizio partiva per primo. Ora entrambi i
   servizi dichiarano `image: piccol-backend` e girano per costruzione sulla stessa immagine; la vecchia è
   stata rimossa. **Corregge quanto scritto in F0** (§8, punto 3): i 145 test di allora erano verdi, ma
   non sullo stesso Node del container `backend`.
9. **`MAX_FILE_SIZE` vale `3# in MB` dentro il container.** Il parser `env_file` di Compose non riconosce
   un commento in linea senza uno spazio prima del `#`, e `.env.example` aveva `MAX_FILE_SIZE=3# in MB`.
   Il middleware legacy funziona per caso, perché `parseInt` si ferma alla prima non-cifra. Due
   conseguenze: validarla come numero avrebbe impedito l'avvio (resta fuori dalla validazione fino a
   F4), e **un bug visibile al client**: il messaggio di file troppo grande interpola la variabile grezza
   e dice "dimensione massima di 3# in MB MB". `.env.example` è corretto e verificato col parser di
   Docker; **il `.env` locale va corretto a mano**.
10. **Dipendenza nascosta scoperta da un test unitario.** `config/env.validation.ts` usa `@Type` di
    class-transformer, che chiama `Reflect.getMetadata`: nell'app funzionava perché NestJS carica
    `reflect-metadata` prima, cioè solo per ordine degli import. Il test, che carica il modulo da solo,
    falliva. Ora il modulo importa esplicitamente ciò di cui ha bisogno.
11. **Limite onesto della validazione aggregata.** Finché i moduli legacy restano nel grafo degli import,
    i loro controlli a livello di modulo (`tokenService.ts`, `databaseUrl.ts`) scattano all'import, prima
    di `ConfigModule`: una variabile del database mancante produce ancora il messaggio di `databaseUrl.ts`,
    non l'elenco completo. La politica "nessun fallback" è rispettata in entrambi i casi; l'elenco
    completo diventa il comportamento effettivo man mano che i moduli legacy migrano.

### Rifinitura dopo F1: `useTestApp` al posto di `createTestApp`

Le 6 suite end-to-end ripetevano a mano lo stesso ciclo di vita (variabili, `beforeAll` di avvio,
`nestApp.close()` in coda all'`afterAll` di pulizia), con un vincolo invisibile: la chiusura doveva venire
dopo la pulizia. Verificato perché conta:

- nello stesso blocco Jest esegue gli `afterAll` **nell'ordine di scrittura**, e quelli di un `describe`
  **prima** di quelli alla radice del file;
- **una query Prisma dopo `$disconnect()` non fallisce: si riconnette in silenzio**, anche con l'adapter
  `pg`. Una chiusura scritta prima della pulizia non avrebbe quindi prodotto nessun test rosso, ma un pool
  riaperto e mai chiuso, cioè Jest appeso a fine esecuzione senza indicazione del file responsabile.

`helpers/useTestApp.ts` registra da sé avvio e chiusura e va chiamato alla radice del file: l'ordine
giusto diventa una conseguenza della struttura invece di una regola da ricordare, e dimenticare la
chiusura non è più possibile. `createTestApp` non è più esportata, così non esiste un secondo modo di
avviare un'app senza chiuderla. L'accesso a `testApp` prima dell'avvio produce un errore che spiega il
problema (verificato con un file temporaneo), invece di un `undefined` che esplode dentro supertest.
Suite invariata: 33 suite / 174 test, e processo Jest terminato pulito.

### Da ricordare nelle fasi successive

- **F2**: `@HttpCode(200)` sulle POST; togliere `customerRoutes` da `mountLegacyRouters` nello stesso
  commit; `exceptionFactory` della `ValidationPipe` per la forma d'errore decisa in D2.
- **F3**: il messaggio di successo (es. "Logout effettuato con successo") oggi l'interceptor lo lascia
  vuoto; il meccanismo per impostarlo va progettato lì, con un chiamante vero.
- **F4**: `MAX_FILE_SIZE` nel contratto di `env.validation.ts`, dopo la correzione del `.env` locale.
- **F5**: valutare il ritorno al body parser di NestJS (punto 2) senza perdere "errore json: ...".

---

## 10. Registro di esecuzione — F2 (completata il 2026-09-14)

Stato finale: **34 suite / 181 test verdi** al primo giro, type-check pulito, lint con il solo warning
pre-esistente. Verificati anche sull'app in esecuzione: `GET /` servito da NestJS, un body JSON array e
un'email di soli spazi (stesso comportamento del legacy).

Conteggio: 174 − 9 test Customer legacy + 16 nuovi = 181. I 9 rimossi sono i 5 di
`authCustomerController.test.ts` e i 2+2 Customer di `authService.test.ts` e `registerService.test.ts`,
portati in `customerAuthService.test.ts`. Uno solo non ha un corrispondente, di proposito: "un indirizzo
mancante diventa null". Il DTO rende l'indirizzo obbligatorio, come già faceva la validazione legacy, quindi
nessun chiamante può più ometterlo.

### Fatto

- `modules/customer/`: `CustomerModule`, `CustomerController`, `CustomerAuthService`, DTO di registrazione
  e login. `health.controller.ts` per `GET /`, dichiarato in AppModule: stava nel router customer solo
  perché quel router era montato alla radice.
- `ValidationPipe` globale come `APP_PIPE` (whitelist, transform) con
  `common/validation/validation-exception.factory.ts` come `exceptionFactory` (**D2 applicata**).
- Rimossi `routes/customerRoutes.ts` (e il suo mount, nello stesso commit), `authCustomerController.ts`,
  `profileCustomerController.ts` (il file vuoto del D9, cancellato ora insieme al suo dominio invece che in
  F5), `authenticateCustomer` e `registerCustomer`.
- Test: `customerAuthService` e `validationExceptionFactory` (unitari), 5 casi nuovi in `customerRoutes`.
  `nestHosting.test.ts`: il controller "oscurato" passa da `GET /` (non più legacy) a `GET /products`.

### Scelte fatte implementando, e perché

1. **La logica di sicurezza resta in funzioni condivise, non duplicata.** `completeAuthentication` e
   `issueTokenFor` sono state esportate da `authService.ts` e `registerService.ts` e le usano sia il codice
   legacy di User sia `CustomerAuthService`. Spostarle in un provider NestJS ora avrebbe richiesto una copia
   per il codice legacy di User, che CLAUDE.md vieta. **In F3**, quando migra anche User, diventano un
   provider iniettabile, con `ConfigService` al posto della lettura di `JWT_SECRET` all'import.
2. **Il service lancia `UnauthorizedException`**, il controller non traduce esiti in risposte (D1). Un
   service che lancia eccezioni HTTP è legato al trasporto HTTP: è l'idioma di NestJS, accettabile finché
   gli unici chiamanti sono controller. Se in futuro servissero chiamanti non HTTP (code, job), andrà
   rivisto con eccezioni di dominio.
3. **Il messaggio mostrato per un campo non dipende dall'ordine dei decoratori.** In `constraints` di
   class-validator l'ordine delle chiavi segue l'ordine di *applicazione* dei decoratori, che in TypeScript
   è dal basso verso l'alto. Invertire due righe in un DTO avrebbe cambiato il messaggio senza nessun
   segnale. La factory dà priorità esplicita a `isNotEmpty`; un test prova entrambi gli ordini.
4. **`@IsString` sui campi testuali: due 500 diventano 400.** Registrazione con `password: 123` (arrivava a
   Prisma) e login con `email: 123` (il `toLowerCase` della normalizzazione esplodeva). Fissati in test.
5. **`whitelist: true` come difesa dal mass assignment**: `id` e `current_token` inviati dal client vengono
   scartati. Il service mappava già i campi uno per uno; un test e2e verifica che un `current_token` scelto
   dal client non arrivi al database.
6. **`AuthResult` è diventata un'unione discriminata** (`{ success: true; token } | { success: false;
   message }`). Prima `token` e `message` erano entrambi opzionali. Il compilatore ha subito segnalato 3
   punti nei test che leggevano `result.token` senza aver verificato l'esito.
7. **Corretti due refusi nei messaggi**: "Nome è richiesta" e "Cognome è richiesta".
8. **Email duplicata: 500 conservato, messaggio non più esposto.** Vedi la decisione aperta qui sotto.

### Decisione aperta (protocollo di AGENTS.md, categoria *Duplication*)

> **Risolta in F3: opzione B, 409 "Email già registrata"** — vedi §11, decisione A.

**Cosa succede se la stessa registrazione arriva due volte?** Oggi il vincolo `unique` sull'email fa
lanciare a Prisma un errore P2002, che arriva al filter come errore imprevisto: **500**, "Qualcosa è andato
storto!". È il comportamento legacy, conservato in F2 perché la migrazione non cambia i contratti senza una
scelta esplicita.

| | Opzione A — lasciare il 500 generico (attuale) | Opzione B — 409 "Email già registrata" |
|---|---|---|
| Come | Nessuna modifica | `CustomerAuthService.register` intercetta **solo** l'errore Prisma P2002 e lancia `ConflictException` |
| Pro | Nessun cambio di contratto. Non rivela se un'email è registrata | Il client capisce che cosa è successo e può proporre il login. Un 500 per un input del client è semanticamente sbagliato, e finisce nei log come errore imprevisto a ogni tentativo |
| Contro | Il client riceve "qualcosa è andato storto" per un caso del tutto previsto, e ogni duplicato sporca i log degli errori veri | Cambia il contratto (500 → 409). Rivela che un'email è registrata; però il login lo rivela già oggi, distinguendo "Utente non trovato" da "Password errata" |

Da decidere prima di F3, perché la stessa scelta varrà per la registrazione degli User.

### Da segnalare, non risolto in F2

- **La registrazione non è atomica.** `create` del cliente e salvataggio del token sono due query separate:
  se la seconda fallisce, il cliente esiste senza token, il client riceve un 500 e un nuovo tentativo
  fallisce per email duplicata. Il comportamento è identico a quello legacy. È un caso concreto e piccolo per
  la **transazione** del percorso PostgreSQL (candidato per F6, insieme a `createProduct`).
- **Enumerazione degli account.** I due messaggi distinti del 401 ("Utente non trovato" / "Password errata")
  permettono di scoprire se un'email è registrata. Sono condivisi con User tramite `completeAuthentication`:
  la scelta di un messaggio unico va fatta in F3, per entrambe le identità insieme.

### Da ricordare nelle fasi successive

- **F3**: le funzioni condivise diventano un provider; decidere la risposta all'email duplicata e ai
  messaggi del 401; il messaggio di successo per logout e cambio password.
- **F4**: quando `productRoutes` migra, il test "vince il router legacy" in `nestHosting.test.ts` va
  spostato su una rotta ancora legacy, o rimosso se non ne resta nessuna.

---

## 11. Registro di esecuzione — F3 (completata il 2026-09-14)

Stato finale: **35 suite / 197 test verdi**, type-check pulito, lint con il solo warning pre-esistente.
Verificato anche sull'app in esecuzione: registrazione, profilo, rifiuto dello schema `Basic`, logout, e
soprattutto la **compatibilità incrociata**: un token firmato da NestJS è accettato dal middleware legacy dei
prodotti, e dopo il logout lo rifiutano entrambi con "Token non più valido".

Conteggio: 181 − 27 test legacy + 43 nuovi = 197. Rimossi `authUserController` (5), `profileUserController`
(9), `authService` (5), `registerService` (4) e 4 dei 5 test di `tokenService`. I loro casi sono in
`credentialsService`, `userAuthService`, `userProfileService`, `jwtUserStrategy`, `authUserGuard` e in 11
casi nuovi di `userRoutes`.

**Le 11 asserzioni end-to-end che esistevano per lo User sono passate invariate al primo avvio riuscito
dell'app**, compresa l'invalidazione del token al logout: il guard con passport riproduce i cinque messaggi
del middleware legacy.

### Fatto

- `modules/auth/`: `CredentialsService` (hash, confronto password, firma e salvataggio dei token),
  `JwtUserStrategy` (con `passReqToCallback: true`), `AuthUserGuard`, `@CurrentUser()`, `AuthModule` con
  `JwtModule.registerAsync` su `ConfigService`, e il DTO di login condiviso dalle due identità.
- `modules/user/`: controller con le 6 rotte, `UserAuthService`, `UserProfileService`, 3 DTO.
- `@ResponseMessage()` in `common/decorators/`, letto dall'interceptor con il `Reflector`: è il meccanismo
  del messaggio di successo, rinviato da F1 finché non c'era un chiamante.
- Aggiunta **`@nestjs/jwt`** 12.0.1: non era nell'assessment. È il compagno standard di `@nestjs/passport`,
  scelto con lo stesso criterio di riconoscibilità della decisione D3. Audit invariato.
- Rimossi `routes/adminRoutes.ts`, `routes/userRoutes.ts` (e il mount `/admin`, nello stesso commit),
  `controllers/user/`, `services/authService.ts`, `services/registerService.ts`. `services/tokenService.ts`
  ridotto al solo `JWT_SECRET`, che serve ancora al middleware legacy dei prodotti fino a F4.

### Cose emerse solo implementando

1. **L'app non partiva: "Nest can't resolve dependencies of the AuthUserGuard".** Due cause, trovate nel
   sorgente installato dopo che la prima ipotesi (ri-esportare `PassportModule`) si era rivelata sbagliata.
   Primo: `PassportModule` importato senza `register()` non fornisce **nessun** provider, quindi
   `AuthModuleOptions` non esisteva. Secondo: in `AuthGuard` quella dipendenza è `@Optional`, ma
   l'injector di NestJS 12 legge il flag con `Reflect.getOwnMetadata`, cioè solo sulla classe stessa. Una
   sottoclasse come `AuthUserGuard` eredita il tipo del parametro, **non** il fatto che sia opzionale.
   Soluzione: `PassportModule.register({})`, esportato da AuthModule.
2. **Importare passport ha rotto il type-check di un file legacy mai toccato.** `@types/passport`
   dichiara `Express.User`, e dentro `namespace Express` il nome `User` del file dei tipi del progetto ha
   smesso di indicare il tipo di Prisma: `req.user` è diventato un'interfaccia vuota, e `productController`
   non poteva più leggere `level`. È uno *shadowing* di un nome. La soluzione prevista da passport è
   estendere `Express.User` con il tipo di Prisma, invece di dichiarare `user` due volte.
3. **L'unione discriminata `AuthResult` di F2 è sparita**, e va detto perché: esisteva per il codice
   legacy di User, che doveva tradurre un esito in `res.error`. In F3 nessun chiamante ha più bisogno di un
   codice di ritorno, quindi `CredentialsService.authenticate` lancia direttamente. È servita per una fase,
   ed è stata una scelta giusta per quella fase.
4. **`CredentialsService.authenticate` accetta anche l'entità `null`.** Il "non trovato" fa parte
   dell'esito del login: gestirlo lì evita che i due service di identità ripetano lo stesso controllo con lo
   stesso messaggio. Così **i messaggi del 401 di login stanno in un solo punto**, che è dove si applicherà
   la decisione B qui sotto.
5. **Il costo di bcrypt era scritto a mano in tre punti** (registrazione User, registrazione Customer,
   cambio password): ora è una costante sola.
6. **Una precisazione onesta su `@CurrentUser()`.** TypeScript non verifica che ciò che un decoratore di
   parametro restituisce corrisponda al tipo scritto accanto al parametro. A rendere vero `user: User` è il
   controllo a runtime nel decoratore, che lancia se l'utente manca. Il guadagno rispetto a `req.user!` è
   che l'assenza non passa più in silenzio: `nestHosting.test.ts` lo verifica con una rotta senza guard.

### Comportamenti cambiati di proposito (tutti fissati in test)

- **Schema `Bearer` obbligatorio.** Il middleware legacy prendeva la seconda parola dell'header
  qualunque fosse lo schema, e accettava un token valido anche come `Basic <token>`.
- **Un errore interno durante l'autenticazione risponde 500**, non più `401 Token scaduto o non valido`.
  Nel legacy un database irraggiungibile sembrava un token sbagliato, e il client avrebbe fatto logout
  invece di riprovare.
- **Algoritmo dei token fissato a HS256** in firma e in verifica, e un payload senza `id` intero è
  rifiutato con un 401 prima di arrivare a Prisma. Difese in più, invisibili per un client corretto.
- **I 500 di profilo, cambio password e logout hanno il messaggio generico** del filter invece dei messaggi
  dedicati dei controller legacy.
- Campi non stringa → 400; campi non previsti (compreso `level` in registrazione) scartati.

### Decisioni aperte → prese il 2026-09-14

**Tutte e quattro risolte con l'opzione raccomandata**, su scelta esplicita dell'utente, e applicate subito
dopo F3 (vedi "Applicazione delle decisioni" in fondo a questa sezione). Registrate anche nel Design
Decisions Log di AGENTS.md. La tabella resta com'era al momento della scelta, per memoria delle
alternative.

| | Domanda | Opzioni | Dove si applica |
|---|---|---|---|
| **A** | Email già registrata (User e Customer) | (a) 500 generico, come oggi; (b) 409 "Email già registrata" | `register` dei due service di identità: intercettare solo l'errore Prisma P2002 |
| **B** | Messaggio del 401 di login | (a) due messaggi, come oggi: rivelano quali email sono registrate; (b) un unico "Credenziali non valide" | `CredentialsService.authenticate` |
| **C** | Il cambio password invalida il token? | (a) no, come oggi: un token rubato sopravvive al cambio password; (b) sì, azzerando `current_token`: il client deve rifare login; (c) sì, emettendo e restituendo un nuovo token: `data` diventa il token invece di `{}` | `UserAuthService.changePassword` |
| **D** | Formato dell'email per gli User | (a) nessun controllo, come oggi (i Customer invece lo hanno); (b) `@IsEmail` in registrazione e aggiornamento profilo, come per i Customer | `RegisterUserDto`, `UpdateProfileDto` |

Pro e contro in sintesi. **A**: vedi §10. **B**: (b) toglie a un attaccante un modo di scoprire gli
account, al prezzo di un messaggio meno preciso per chi ha sbagliato email; A(b) rivelerebbe comunque
l'esistenza di un'email in registrazione, quindi A e B vanno decise insieme. **C**: (a) contraddice il
pattern di invalidazione che CLAUDE.md descrive come intenzionale; (b) è la più semplice e sicura; (c) evita
di disconnettere l'utente ma cambia la forma della risposta. **D**: (b) rende coerenti le due identità e
impedisce di salvare email inservibili, ma rifiuta con un 400 richieste che oggi vengono accettate.

### Applicazione delle decisioni (2026-09-14)

Stato finale: **36 suite / 203 test verdi**, lint pulito, tutte e quattro verificate anche sull'app in
esecuzione. Prima di aggiornare i test, la suite è stata eseguita sul codice già modificato: sono falliti
**esattamente i 12 test** che fissavano i comportamenti vecchi (8 per B, 3 per C, 1 per A) e nessun altro.
Nessun test esistente usava email malformate per gli User, quindi D ha richiesto test nuovi.

- **A — 409 "Email già registrata"**, in registrazione (User e Customer) **e in aggiornamento del profilo
  degli User**: l'estensione al profilo non era nella tabella, ma è lo stesso caso di duplicazione e avrebbe
  lasciato un 500 incoerente. L'errore si intercetta *dopo* la scrittura e non con un controllo preventivo,
  che sarebbe esposto a una race condition fra due registrazioni simultanee.
  **Scoperta**: con l'adapter `pg` l'errore P2002 non ha `meta.target`, quindi si controlla solo il codice
  (verificato con una doppia create reale).
- **B — "Credenziali non valide"** per entrambi i casi. In più, **bcrypt viene eseguito anche per gli
  account inesistenti**, con un hash fittizio: con il solo messaggio unico, la *durata* della risposta
  avrebbe continuato a rivelare quali email esistono. Il test verifica il confronto, non i tempi, che in
  una suite sarebbero instabili.
- **C — Il cambio password invalida il token**: password e `current_token = null` nella stessa query,
  quindi atomiche. Il messaggio di successo ora avvisa di rifare login. Verificato che il vecchio token è
  rifiutato sia dalle rotte NestJS sia da quelle legacy dei prodotti.
- **D — `@IsEmail`** in registrazione e aggiornamento del profilo degli User. Il login resta senza, così
  un'email malformata continua a produrre il 401 uniforme di B.

**Nota per scrivere test simili**: due Promise destinate a fallire vanno avviate e attese una alla volta,
ciascuna dentro il proprio `expect`. Avviandole insieme, la seconda può essere rifiutata mentre si attende
la prima, senza ancora un gestore, e Jest fa fallire il test per rifiuto non gestito.

### Da ricordare in F4

- `ProductModule` userà `AuthUserGuard` e `@CurrentUser()`: con la migrazione dei prodotti spariscono
  `authUserMiddleware`, `services/tokenService.ts` e l'estensione di `Express.Request` per `validationErrors`.
- Il test "vince il router legacy" in `nestHosting.test.ts` va spostato su una rotta ancora legacy
  (`GET /routes`, fino a F5) o rimosso.
- Restano da F1–F2: `MAX_FILE_SIZE` nel contratto dell'ambiente (dopo la correzione del `.env` locale), il
  debito su `image-size`, la paginazione di `GET /products`.

---

## 12. Registro di esecuzione — F4 (completata il 2026-09-14)

Stato finale: **32 suite / 204 test verdi**, type-check pulito, **lint senza nessun problema** (il warning
pre-esistente su `hardLimitMB` è sparito con il middleware che lo conteneva). Verificato sull'app in
esecuzione con i 5.000 prodotti del seed di sviluppo: `GET /products` passa da **1,2 MB a 5.209 byte**
(18 ms), e un file ICNS travestito da PNG viene rifiutato senza conseguenze per il processo.

Conteggio: 203 − 35 test legacy + 36 nuovi = 204. Rimossi `productController`, `authUserMiddleware`,
`validateProductImageMiddleware`, `checkNumberFilesMiddleware`, `handleMulterErrorsMiddleware`,
`validationHandlerMiddleware`, `tokenService` e `InvalidImageTypeError`. Gli 8 test end-to-end dei prodotti
esistenti sono rimasti, con un'unica modifica voluta (`data` → `data.items`).

### Fatto

- `modules/product/`: controller (guard sulla classe), `ProductService` con elenco paginato e `create` ancora
  stub, DTO di query e di creazione, e `upload/` con `ProductImageUploadInterceptor`, `ProductImageValidator`,
  `NewProductFormPipe` e `image-inspection.ts`.
- `MAX_FILE_SIZE` e `MAX_FILE_HARD_SIZE` nel contratto di `env.validation.ts`, con il vincolo che il limite di
  business non superi quello hard. Il limite hard è letto davvero dalla variabile.
- Rimossi nello stesso commit `routes/productRoutes.ts` (e il suo mount), `controllers/product/`, sette
  middleware (compreso `skipIfValidationErrorsMiddleware` del D9, anticipato da F5 perché apparteneva alla
  catena rimossa), `services/tokenService.ts`, la cartella `classes/` e la dipendenza `express-validator`, che
  non aveva più importatori. `req.validationErrors` è sparito dai tipi.

### Scelte fatte implementando, e perché

1. **Paginazione con i metadati in `data`** (`{ items, page, limit, total, totalPages }`), scelta dall'utente
   fra questa e l'array con metadati negli header. Default 20, massimo 100, ordinamento `createdAt` e poi
   `id` decrescenti: il secondo criterio serve perché righe create nello stesso istante (il seed ne crea
   migliaia in pochi secondi) non hanno un ordine garantito, e senza un criterio univoco una riga potrebbe
   comparire in due pagine o in nessuna. Pagina e totale sono due query parallele, **non** in transazione:
   il totale può differire di uno in presenza di scritture concorrenti, accettabile per un elenco.
2. **L'autorizzazione per livello usa un controllo di esaustività con `never`**: se lo schema aggiungesse un
   livello utente, la compilazione fallirebbe in `visibleProductsFor` invece di lasciarlo senza regola. Il
   legacy rispondeva 403 a un livello sconosciuto, ma solo a runtime.
3. **Interceptor di upload scritto nel progetto invece di `FilesInterceptor`.** Quello di NestJS fissa le
   opzioni di multer nel decoratore (quindi nel sorgente, come il limite scritto a mano del legacy) e
   restituisce i messaggi inglesi di multer. Il nostro ricalca il suo funzionamento in circa venti righe,
   legge il limite da `ConfigService` e classifica gli errori con lo stesso elenco di NestJS.
4. **L'interceptor che crea i file temporanei li cancella a qualunque errore successivo**, grazie al fatto,
   verificato nel sorgente, che le pipe girano dentro il flusso osservato dagli interceptor. Il legacy li
   cancellava solo per errori sull'immagine.
5. **Campi e immagine validati insieme in una pipe su un parametro unico.** Con `@Body` e `@UploadedFiles`
   separati, la `ValidationPipe` avrebbe lanciato sui campi prima di controllare l'immagine, e il client
   avrebbe scoperto gli errori in due richieste successive. La forma di D2 li vuole in una sola risposta.
6. **Niente `fileFilter` in multer**: ogni file entro il limite hard viene salvato, e il tipo lo verifica il
   validatore guardando i byte reali. Tutti gli errori sulle immagini nascono così in un solo punto, senza
   bisogno di uno stato appeso alla richiesta per passare i rifiuti dal filtro alla validazione. Il costo è
   la scrittura temporanea su disco di un file non valido, cancellato subito dopo.
7. **Il prezzo resta una stringa** nel DTO: in virgola mobile 0.1 + 0.2 non fa 0.3, e la colonna è
   `DECIMAL(10,2)`. La conversione avverrà in F6, senza passare dai numeri a virgola mobile.

### Il debito su `image-size`, chiuso

Verificato nel sorgente della libreria: il rilevatore sceglie il formato dal primo byte e, se quel formato non
si conferma, **prova in ordine tutti i 20 formati**, compresi i tre con i parser vulnerabili. Due difese
indipendenti in `image-inspection.ts`:

- i **magic bytes** di JPEG (FF D8 FF) e PNG (8 byte) vengono verificati prima di chiamare la libreria; con
  quei byte i validatori di ICNS, HEIF e JXL non possono riconoscere il file;
- **`disableTypes`** disattiva nella libreria ogni formato tranne JPG e PNG, così anche un cambiamento futuro
  del rilevatore non porterebbe al parser di un formato vulnerabile. Un test lo verifica passando un GIF
  valido direttamente a `imageSize`.

Con l'occasione la lettura del file è diventata asincrona: il legacy usava `readFileSync`, che blocca tutte le
richieste per la durata della lettura.

### Comportamenti cambiati di proposito (fissati in test)

- `GET /products` paginata (vedi sopra); un errore inatteso risponde 500 invece di `403 Errore server`.
- Limite hard superato: **413** invece di 400, stesso messaggio.
- File in un campo diverso da `image` o multipart malformato: 400 con messaggio italiano (il legacy
  aggiungeva un errore inglese raggruppato sotto una chiave `undefined`).
- File temporanei sempre cancellati in caso di errore.
- Il messaggio sul peso usa il numero validato: niente più "3# in MB MB".

### Da ricordare in F5

- Resta legacy solo `GET /routes`: con lei spariscono `listRoutes.ts`, `listRoutesController.ts`,
  `responseFormatter.ts`, i metodi `res.success/res.error` in `types/express.d.ts`, `mountLegacyRouters` e il
  test "vince il router legacy" di `nestHosting.test.ts`. `SHOW_ROUTES` esce dal contratto di `.env` (D8).
- Valutare il ritorno al body parser di NestJS (§9, punto 2) senza perdere "errore json: ...".
- Pagina e totale non sono in transazione; `createProduct` deve salvare prodotto e immagine insieme: entrambi
  temi per F6. Un indice per l'elenco degli admin (`createdBy`, `createdAt`, `id`) è il prossimo passo naturale
  del percorso PostgreSQL, da affrontare con `EXPLAIN` e non in anticipo.

---

## 13. Registro di esecuzione — F5 (completata il 2026-09-14)

Stato finale: **29 suite / 191 test verdi**, type-check pulito, lint senza problemi. Verificato sull'app di
sviluppo in esecuzione: `GET /` 200, `GET /routes` 404 `Non trovato`, JSON malformato 400 `errore json: ...`,
body di form fermato dalla validazione.

Conteggio: 204 − 15 + 2 = 191. Rimossi i 13 test di `listRoutes`, `listRoutesController` e
`responseFormatter`, e i 2 test di convivenza con i router legacy di `nestHosting.test.ts`; aggiunti i 2 test
descritti sotto.

**Con F5 la migrazione è finita: nessun router Express, ogni rotta è un controller NestJS.**

### Fatto

- Cancellati `routes/listRoutes.ts`, `controllers/listRoutesController.ts` (D8) e
  `middlewares/responseFormatter.ts`, con i loro test e i metodi `res.success` / `res.error` in
  `types/express.d.ts`. Spariscono le cartelle `routes/`, `controllers/` e `middlewares/`.
- `configureApp` monta solo CORS, `express.json()` e la traduzione degli errori JSON: `mountLegacyRouters` non
  esiste più.
- `jsonSyntaxErrorMiddleware.ts` passa in `common/middleware/json-syntax-error.middleware.ts`.
- `nestHosting.test.ts` diventa `appInfrastructure.test.ts`: senza più router legacy, il test "vince il router
  legacy" non ha più nulla da verificare.
- `SHOW_ROUTES` esce da `.env.example` (non era mai stata nel contratto validato); la voce "List Routes" esce
  dalla collection Postman.
- Rimosse le dipendenze `cors` e `@types/cors`: nessun file le importa più dal passaggio ad
  `app.enableCors()` in F1, e `@nestjs/platform-express` dichiara `cors` come propria dipendenza.
- Aggiornati i commenti che descrivevano il legacy come ancora presente (filter, interceptor, logger,
  strategia JWT, `app.module.ts`, `env.validation.ts`, `main.ts`), senza toccare quelli che lo citano come
  storia.

### Il ritorno al body parser di NestJS, valutato e scartato

Era il punto aperto da §9 (punto 2). **Il parser esplicito resta**, per un motivo diverso da quello originale.

- Dal sorgente (`nest-application.js`): NestJS registra il suo parser dentro `init()`, dopo tutti gli
  `app.use()` di `configureApp`. Express fa avanzare un errore solo verso i middleware registrati dopo quello
  che l'ha generato, quindi il traduttore degli errori JSON starebbe prima del parser e non ne vedrebbe mai
  gli errori.
- Registrarlo dopo `init()` non funziona: finirebbe dietro al gestore 404, che risponde a tutto.
- Trasformarlo in un `NestMiddleware` non funziona: `middleware-module.js` lo avvolge in una funzione
  `(req, res, next)`, e la firma a 4 parametri, l'unica che Express riconosce come gestore d'errore, andrebbe
  persa.
- Riconoscere il JSON malformato in `AllExceptionsFilter` vorrebbe dire leggere il testo del messaggio di
  `JSON.parse`, perché `mapException` scarta l'errore originale (§9, punto 3). Troppo fragile.
- In più il parser di NestJS attiva anche `express.urlencoded`: l'API accetterebbe in silenzio i body
  `application/x-www-form-urlencoded`.

**Trappola trovata verificando**: con `bodyParser: true` e `express.json()` ancora montato, il JSON malformato
continua a funzionare, perché NestJS salta il proprio parser JSON se ne trova già uno con lo stesso nome di
funzione (`isMiddlewareApplied`). Aggiunge però quello urlencoded. Un test che guardasse solo il JSON
malformato non se ne accorgerebbe.

### Test aggiunti (in `errorHandling.test.ts`)

- **I body urlencoded non vengono letti**: un login inviato come form si ferma alla validazione (400 con i
  campi richiesti). Verificato che il test **fallisce** riattivando il parser di NestJS: 401, cioè il body è
  stato letto e il login è arrivato al service.
- **`GET /routes` risponde 404 `Non trovato`**: il cambio di contratto della decisione D8, fissato come quelli
  delle fasi precedenti.

### Non fatto, di proposito

- **`@nestjs/swagger`**, citato in D8 come possibile sostituto di `GET /routes`. È una funzionalità nuova e non
  una pulizia: resta un'opzione da decidere. Richiederebbe di decorare DTO e controller, e la documentazione
  delle API oggi è `docs/API.md`.
- `services/emailNormalizer.ts` resta dov'è: è una funzione pura, usata da due moduli, e spostarla non
  cambierebbe nulla del comportamento.

---

## 14. Cosa questo assessment non copre

- **Il frontend**, fermo allo scaffold Vite, non è toccato. Il backend continua a servire solo JSON e
  a permettere CORS da `localhost:3000`.
- **La performance.** La migrazione non rende niente più veloce: lo stack HTTP è lo stesso (§2). La
  paginazione mancante di `GET /products` resta un problema reale e viene risolta in F4 perché
  l'handler si riscrive comunque, non come effetto della migrazione.
- **La checklist di validazione** di `CLAUDE.md` non si applica a questo documento (nessun codice
  generato), ma si applicherà a ogni fase: F3 e F4 toccano auth e input utente, quindi lì Input /
  Confini del dominio / Fallimento / Sicurezza / Leggibilità futura vanno percorsi in prosa, non
  saltati.
