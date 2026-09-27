# Avvio dell'applicazione: `backend/main.ts` riga per riga

Questo documento spiega **che cosa succede, e in quale ordine, dal momento in cui Node
carica `main.ts` al momento in cui l'applicazione risponde alla prima richiesta**, e poi
di nuovo quando si ferma.

È un documento di studio: descrive il *perché* di ogni riga, non solo il cosa. Se cerchi
il contratto delle API, vedi [API.md](API.md); se cerchi la storia delle scelte,
[MIGRAZIONE-NESTJS.md](MIGRAZIONE-NESTJS.md); se cerchi le regole del progetto,
`CLAUDE.md` e `AGENTS.md` alla radice del repo.

---

## 1. Prima di tutto: chi esegue `main.ts`, e in che forma

`main.ts` **non viene mai eseguito come TypeScript**. Viene compilato in `dist/main.js` ed
è quel file a girare, in tutti e tre i modi in cui l'app parte:

| Comando | Cosa fa davvero |
|---|---|
| `npm run dev` | `nest start --watch --debug 0.0.0.0:9229`: compila in `dist/` e riesegue `dist/main.js` a ogni modifica, con il debugger in ascolto. È il comando del container `backend` (`CMD` del Dockerfile). |
| `npm run build` + `npm start` | Compila una volta ed esegue `node dist/main`, senza watch né debugger. |
| I test | **Non usano `main.ts`.** `__tests__/helpers/useTestApp.ts` costruisce l'app con lo stesso `AppModule` e la stessa `configureApp`, ma senza `listen()`. È il motivo per cui quella funzione esiste separata: vedi §7. |

Il fatto che giri da `dist/` ha una conseguenza pratica che ritorna subito, alla riga 21:
i percorsi relativi non partono da `backend/`, partono da `backend/dist/`.

---

## 2. Le prime due righe, e perché l'ordine è tutto

```ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
```

### 2.1 Perché il caricamento di `.env` è la PRIMA istruzione del file

Non è una preferenza stilistica: è un vincolo.

Quando TypeScript compila in CommonJS, ogni `import` diventa una `require()`, e quelle
`require()` vengono emesse **nello stesso ordine in cui gli import compaiono nel
sorgente**, intervallate dalle istruzioni scritte fra loro. Mettendo `dotenv.config()`
prima degli import dell'applicazione, si ottiene questo ordine di esecuzione reale:

1. `require('dotenv')`, `require('path')`;
2. **`dotenv.config(...)`** — le variabili finiscono in `process.env`;
3. `require('./app.module')` e tutto ciò che quel file trascina con sé.

Il punto 3 non è innocuo. Importare `app.module.ts` significa importare `PrismaModule`,
che importa `prisma/client.ts`, che **al momento dell'import** costruisce il client:

```ts
const adapter = new PrismaPg({ connectionString: buildDatabaseUrl() });
```

`buildDatabaseUrl()` (in `config/databaseUrl.ts`) legge `DB_USER`, `DB_ROOT_PASSWORD`,
`DB_HOST` e `DB_NAME` e **lancia un errore se una manca**. Se `.env` non fosse ancora
stato caricato, l'app morirebbe durante gli import, con un errore sulle variabili del
database, prima ancora di arrivare a `bootstrap()`.

> **Nota onesta.** `config/databaseUrl.ts` chiama a sua volta `dotenv.config()`, quindi in
> pratica funzionerebbe anche senza la riga 21. Ma quel caricamento esiste per un'altra
> ragione (serve alla CLI di Prisma, che esegue `prisma.config.ts` fuori dal ciclo di vita
> dell'app), ed è un **effetto collaterale nascosto dentro un altro modulo**: l'avvio
> dell'applicazione non deve dipendere da qualcosa che un giorno potrebbe essere spostato
> o rimosso. La riga 21 rende la dipendenza esplicita, che è la regola del progetto.

### 2.2 Il percorso `../../.env`

`__dirname` a runtime è `backend/dist`. Risalendo di due livelli si arriva alla radice del
repository, dove `.env` vive accanto a `docker-compose.yml`. La posizione è deliberata:
**un unico file letto da due mondi**, Docker Compose (che lo interpola nel YAML e lo inietta
nei container con `env_file`) e l'app Node.

### 2.3 Dentro Docker quel file non esiste, e va bene così

Nel container è montata solo `backend/`, quindi `/app/../../.env` non esiste e dotenv non
trova niente. Nessun problema: le variabili sono già in `process.env`, iniettate da
`env_file`. E dotenv **non sovrascrive mai** una variabile già presente, quindi anche
quando entrambe le strade funzionano (esecuzione diretta sull'host) non c'è conflitto.

La riga 21 è quindi una rete di sicurezza per chi esegue l'app fuori da Docker.

---

## 3. Gli import successivi: cosa accade *solo importandoli*

```ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import winstonLogger from './config/logger';
import { AppModule } from './app.module';
import { NEST_APP_OPTIONS, configureApp } from './app.setup';
import { WinstonLoggerService } from './common/logger/winston-logger.service';
```

Un import non è mai "gratis": esegue il modulo. Al termine di questo blocco, **prima che
`bootstrap()` venga chiamato**, sono già successe tre cose:

- **il logger Winston esiste** (`config/logger.ts` crea l'istanza al volo con i suoi tre
  trasporti: console, `logs/error.log`, `logs/combined.log`);
- **il client Prisma esiste**, con la stringa di connessione già composta (vedi §2.1). La
  connessione vera al database però non è ancora stata aperta: Prisma la apre alla prima
  query;
- **i decoratori sono stati eseguiti.** `@Module`, `@Injectable`, `@Controller` sono
  funzioni: caricare `app.module.ts` le esegue tutte, e ognuna attacca metadati alle
  classi. Il "grafo" dell'applicazione a questo punto è solo una raccolta di metadati:
  nessun servizio è stato ancora costruito.

Nota su `NestFastifyApplication`: è **solo un tipo** (`import` di un'interfaccia), non
codice. Serve a dire a TypeScript che l'app espone anche i metodi specifici della
piattaforma Fastify — `register` per i plugin, `getHttpAdapter().getInstance()` per
l'istanza sottostante — che `configureApp` usa.

---

## 4. `bootstrap()`, istruzione per istruzione

### 4.1 `NestFactory.create(...)`: nasce l'applicazione, ma non ascolta ancora

```ts
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
  ...NEST_APP_OPTIONS,
  bufferLogs: true,
});
```

Tre argomenti, tre decisioni distinte.

**`AppModule`** è la radice del grafo. Qui NestJS fa il lavoro pesante:

1. legge i metadati dei moduli e ne costruisce l'albero;
2. esegue `ConfigModule.forRoot({ validate: validateEnvironment })`, cioè **valida tutto
   il contratto di `.env`** (`config/env.validation.ts`). Un solo errore che elenca tutte
   le variabili mancanti o non valide;
3. **istanzia i provider**: service, filter, interceptor, pipe, guard globali. È il momento
   in cui la dependency injection risolve i costruttori.

Se qualcosa non torna — una variabile d'ambiente non valida, un provider che NestJS non sa
risolvere — l'errore nasce **qui**, e l'app non parte affatto. È la garanzia "fail fast"
del progetto: meglio non partire che partire con un segreto indovinato.

> **Per chi viene da Symfony**: è l'equivalente della costruzione del container dei servizi
> durante il boot del Kernel. La differenza è che qui succede a ogni avvio del processo,
> non c'è un container compilato su disco.

**`new FastifyAdapter()`** è la piattaforma HTTP. NestJS **non è un server**: è un
framework che sta sopra un server, e questo è il punto in cui si sceglie quale. Fino alla
fase F6 era Express (`@nestjs/platform-express`); dalla fase F7 è Fastify. Tutto il resto
del codice non se ne accorge, a patto che nessuno usi tipi o metodi della piattaforma — ed
è il motivo per cui `AllExceptionsFilter` parla alla risposta solo tramite `HttpAdapterHost`.

**Le opzioni**, che sono due cose diverse fuse in un oggetto:

- `...NEST_APP_OPTIONS` porta `bodyParser: false`. Disattiva il parser JSON che NestJS
  registrerebbe da sé, perché il progetto ne installa uno proprio in `configureApp` per
  conservare il messaggio `errore json: ...`. Con entrambi, **Fastify rifiuta di partire**:
  "Content type parser 'application/json' already present";
- `bufferLogs: true` dice a NestJS di **trattenere** i messaggi di log prodotti durante la
  costruzione, invece di scriverli subito con il logger di default. Senza, le righe di
  avvio del framework (moduli inizializzati, rotte registrate) finirebbero sulla console e
  non in `logs/`. Quando vengono rilasciati è spiegato in §4.2, ed è meno ovvio di quanto
  sembri.

Da notare: al termine di `create()` l'applicazione **esiste ma non è inizializzata**. Le
rotte non sono ancora registrate sul server HTTP e nessuno ascolta su una porta. Succede in
`init()`, che `listen()` chiama per noi (vedi §4.6).

### 4.2 `app.useLogger(app.get(WinstonLoggerService))`

```ts
app.useLogger(app.get(WinstonLoggerService));
```

`app.get(...)` chiede al container l'istanza di un provider: qui l'adapter che traduce le
chiamate di log di NestJS in chiamate a Winston (`common/logger/winston-logger.service.ts`,
costruito in `AppModule` con una factory). Registrandolo, **i log del framework e quelli
dell'applicazione finiscono nello stesso posto e nello stesso formato**. Senza questa riga
il progetto avrebbe due sistemi di log paralleli: il framework sulla console,
l'applicazione in `backend/logs/`.

**Quando vengono scritti i messaggi trattenuti da `bufferLogs`.** Non qui, contrariamente
a quanto verrebbe da pensare. Verificato nel sorgente installato:

- `useLogger()` svuota il buffer solo se qualcuno ha attivato `flushLogsOnOverride`, e
  `NestFactory.create()` — quella delle applicazioni HTTP — **non lo attiva** (lo fa
  `createApplicationContext`, usata dalle app senza server);
- lo scarico avviene invece **dentro `listen()`**, nella callback con cui il server
  comunica di essere in ascolto (`nest-application.js`: `if (this.appOptions?.autoFlushLogs
  ?? true) this.flushLogs()`).

Da qui una conseguenza pratica sull'ordine delle righe di `bootstrap()`: `useLogger` deve
venire **prima** di `listen`. Se fossero invertite, il buffer verrebbe scaricato quando il
logger registrato è ancora quello di default, e i log di avvio finirebbero sulla console
invece che in `logs/` — senza nessun errore a segnalarlo.

### 4.3 `app.enableShutdownHooks()`

```ts
app.enableShutdownHooks();
```

Dice a NestJS di mettersi in ascolto dei **segnali di sistema** (`SIGTERM` da
`docker compose stop`, `SIGINT` da Ctrl+C) e, quando arrivano, di chiamare gli hook del
ciclo di vita dei moduli prima di lasciar morire il processo.

Nel progetto serve a una cosa concreta: `PrismaModule` implementa
`onApplicationShutdown()` e lì chiude il pool di connessioni con `$disconnect()`. Senza
questa riga quell'hook scatterebbe **solo** con una chiamata esplicita a `app.close()` —
cioè nei test, dove `useTestApp` la fa, ma non in produzione, dove il processo verrebbe
ucciso lasciando connessioni aperte lato PostgreSQL.

### 4.4 `await configureApp(app)`

```ts
await configureApp(app);
```

È la funzione di `app.setup.ts`, **condivisa con i test**. Configura l'istanza Fastify che
sta sotto l'app:

1. `app.enableCors()` — CORS senza opzioni, quindi tutte le origini ammesse (il frontend
   gira su un'altra porta);
2. registra il **parser JSON del progetto**
   (`common/middleware/json-content-type-parser.ts`), quello che produce
   `errore json: <dettaglio>` invece del messaggio grezzo di `JSON.parse`;
3. registra il plugin **`@fastify/multipart`** con il limite hard `MAX_FILE_HARD_SIZE`,
   letto da `ConfigService` (il container esiste già, quindi il valore è quello validato);
4. crea la cartella `uploads/tmp/`, perché il plugin ci scrive dentro ma non la crea.

**Perché è `await`.** La registrazione di un plugin Fastify è asincrona. Ed è anche il
motivo per cui deve avvenire *prima* dell'inizializzazione: un plugin registrato dopo
l'avvio viene rifiutato con "Fastify instance is already listening".

**Perché esiste come funzione separata invece di stare qui dentro.** È un errore classico
dei progetti NestJS: `main.ts` configura l'app, i test ne costruiscono una senza quella
configurazione, e quindi verificano un'applicazione diversa da quella che gira davvero.
Con una sola funzione chiamata da entrambi, i test attraversano esattamente la stessa
catena della produzione.

### 4.5 La porta

```ts
const port = app.get(ConfigService).getOrThrow<number>('PORT');
```

`PORT` è già stata validata da `validateEnvironment` durante `create()`, ed è già un
numero (la validazione la converte). `getOrThrow` è quindi **ridondante per il
compilatore, ma non per chi legge**: dichiara che un valore mancante qui non è
un'eventualità prevista, coerentemente con la politica "nessun fallback" del progetto.

### 4.6 `await app.listen(port, '0.0.0.0')`

```ts
await app.listen(port, '0.0.0.0');
```

È la riga che fa succedere il resto. Verificato nel sorgente di
`@nestjs/core/nest-application.js`: `listen()` chiama `init()` se l'app non è ancora
inizializzata, e `init()` esegue **in quest'ordine**:

1. il parser dei body (saltato: `bodyParser: false`);
2. l'inizializzazione dei moduli;
3. la **registrazione delle rotte** sul server HTTP;
4. il gestore **404** e il gestore degli **errori**, in coda a tutto.

Poi il server si mette in ascolto e i log trattenuti vengono scaricati.

**Perché `'0.0.0.0'`.** Il default di Fastify è `127.0.0.1`, cioè "solo connessioni dalla
stessa macchina". Dentro un container quella macchina è il container stesso: la porta
pubblicata da Docker non raggiungerebbe nessuno, e `curl localhost:5001` dall'host
fallirebbe con connessione rifiutata. Express ascoltava di default su tutte le interfacce,
quindi fino alla fase F6 questo parametro non serviva. È esattamente il tipo di dettaglio
che cambia quando si cambia piattaforma e che nessun test unitario può cogliere.

---

## 5. La rete di sicurezza finale

```ts
bootstrap().catch((error: unknown) => {
  winstonLogger.error('Avvio fallito:', { message: ..., stack: ... });

  process.exit(1);
});
```

`bootstrap()` è `async`, quindi restituisce una Promise: senza `catch`, un errore di avvio
diventerebbe un *unhandled rejection*, con un messaggio poco leggibile e un codice di
uscita che dipende dalla versione di Node.

Tre dettagli deliberati:

- **si usa `winstonLogger` direttamente**, non l'adapter registrato con `useLogger()`. Se
  l'avvio fallisce, l'app — e quindi quel logger — può non esistere proprio: qui serve
  qualcosa che funzioni comunque;
- **`error instanceof Error`** prima di leggere `message` e `stack`: in JavaScript si può
  lanciare qualunque valore, anche una stringa, e leggere `.stack` da una stringa darebbe
  `undefined` senza dire niente di utile;
- **`process.exit(1)`**: un container che esce con codice diverso da zero è un container
  fallito, e Docker (o un orchestratore) può accorgersene e riavviarlo. Uscire con 0
  significherebbe "ho finito il mio lavoro, va tutto bene".

---

## 6. La sequenza completa, in ordine

1. Node carica `dist/main.js`.
2. `dotenv` legge `.env` (fuori da Docker) e riempie `process.env`.
3. Gli import eseguono i moduli: nasce il logger Winston, nasce il client Prisma (senza
   connettersi), i decoratori registrano i metadati.
4. `NestFactory.create`: albero dei moduli → **validazione di `.env`** → costruzione di
   tutti i provider. Se qualcosa manca, si ferma qui.
5. `useLogger`: da qui in poi i log del framework passano a Winston (quelli trattenuti
   restano in attesa fino al passo 9).
6. `enableShutdownHooks`: i segnali di sistema diventano hook del ciclo di vita.
7. `configureApp`: CORS, parser JSON del progetto, plugin multipart, cartella temporanea.
8. Lettura di `PORT` dalla configurazione validata.
9. `listen`: rotte registrate, 404 e gestore errori in coda, server in ascolto su tutte le
   interfacce, e **scarico dei log trattenuti** — che a questo punto vanno su Winston.
10. Da qui in poi l'app risponde. Per il percorso di una singola richiesta — guard,
    interceptor, pipe, handler, filter — vedi la sezione "Convenzioni di risposta ed
    errore" di `CLAUDE.md`.

---

## 7. Cosa fanno i test al posto di tutto questo

`__tests__/helpers/useTestApp.ts` ripete i passi 4, 7 e l'inizializzazione, ma **non il 9**:
non c'è nessuna porta in ascolto, supertest parla direttamente con il server HTTP. In più
attende `ready()` di Fastify, perché rotte e plugin si costruiscono in modo asincrono e
`init()` di NestJS non lo comprende.

Quello che i test **non** eseguono è `main.ts`: quindi il caricamento di `.env` della riga
21, l'adapter Winston e `enableShutdownHooks` non fanno parte di ciò che la suite verifica.
Nei test le variabili d'ambiente arrivano dal comando (`NODE_ENV=test` più `env_file` del
container), e la chiusura dell'app è esplicita.

---

## 8. Guasti tipici e come si manifestano

| Sintomo | Causa | Dove guardare |
|---|---|---|
| L'app non parte e l'errore elenca più variabili d'ambiente | `validateEnvironment` durante `create()` | `config/env.validation.ts` |
| L'app non parte per **una** variabile del database | Il controllo di `databaseUrl.ts`, che scatta prima, all'import | `config/databaseUrl.ts` |
| `Content type parser 'application/json' already present` | Qualcuno ha rimesso `bodyParser: true` | `app.setup.ts`, `NEST_APP_OPTIONS` |
| `Fastify instance is already listening` | Un plugin registrato dopo `listen()` | l'ordine in `bootstrap()` |
| `curl` dall'host non si connette, ma nel container funziona | Ascolto su `127.0.0.1` | il secondo argomento di `listen` |
| `Nest can't resolve dependencies of ...` | Un provider non esportato dal suo modulo | il modulo che dichiara la classe |
| I log di avvio del framework non finiscono in `logs/` | `useLogger` mancante, o chiamato dopo `listen` | §4.2 |
| Connessioni PostgreSQL che restano aperte dopo lo stop | `enableShutdownHooks` rimosso | §4.3 |

---

## 9. Lo spegnimento

1. Arriva `SIGTERM` (da `docker compose stop`) o `SIGINT` (Ctrl+C).
2. Grazie a `enableShutdownHooks`, NestJS smette di accettare nuove richieste e chiama gli
   hook del ciclo di vita.
3. `PrismaModule.onApplicationShutdown()` esegue `$disconnect()`: il pool di connessioni a
   PostgreSQL si chiude in modo pulito.
4. Il processo termina.

---

## 10. Per chi viene dal PHP procedurale

L'analogia giusta non è un framework, è il tuo `index.php`:

```php
<?php
require 'config.php';                  // credenziali e costanti
$pdo = new PDO($dsn, $user, $pass);    // connessione
// ...poi, in base a $_GET['page'], includi la pagina e stampi l'HTML
```

`bootstrap()` è **la prima metà di quel file**: la parte che prepara tutto prima di
servire qualcosa.

Il salto sta in **quando** gira:

| | PHP procedurale | Qui |
|---|---|---|
| Chi ascolta sulla porta | Apache o php-fpm, già avviati | **l'applicazione stessa**: è lei il server |
| Quando gira `index.php` / `main.ts` | a ogni richiesta, da capo | **una volta sola**, all'avvio del processo |
| Dopo la risposta | il processo muore, tutto viene buttato | il processo resta vivo e aspetta la prossima richiesta |
| `require 'config.php'` | rifatto a ogni richiesta | gli `import` girano una volta sola (§3) |
| La connessione al database | `new PDO(...)` a ogni richiesta | aperta una volta, riusata da tutte le richieste |
| Fine del lavoro | niente da chiudere: muore tutto | serve uno spegnimento esplicito (§9) |

Quindi `main.ts` non è l'`index.php` che gira a ogni click: è un `index.php` che eseguiresti
**una volta sola all'accensione del server**, e che poi resta in memoria. Le richieste
successive non ricaricano nessun file: chiamano funzioni già pronte.

Due conseguenze pratiche che in PHP non ti riguardavano:

- **lo stato sopravvive fra le richieste.** Il pool di connessioni aperto all'avvio è lo
  stesso per tutti. È un vantaggio (non si riapre niente ogni volta), ma significa che una
  variabile globale sporcata da una richiesta la vedono anche le successive;
- **fermare l'applicazione è un'operazione vera**, con una procedura: è tutta la §9, e in
  PHP semplicemente non esisteva.

Una differenza di linguaggio, non di architettura, ma che spiega la forma del file: in PHP
ogni istruzione blocca finché non ha finito, quindi scrivi le righe una dopo l'altra e basta.
In Node alcune operazioni restituiscono una *promessa* di risultato, che va attesa con
`await`, e `await` si può usare solo dentro una funzione dichiarata `async`. Da qui la
necessità di racchiudere i passi di avvio in `async function bootstrap()` invece di
scriverli al livello principale del file.
