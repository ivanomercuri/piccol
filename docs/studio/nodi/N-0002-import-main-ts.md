---
id: N-0002
titolo: Cosa fanno gli import in cima a main.ts
area: backend
stato: da-verificare
padre: "[[N-0001-avvio-main-ts]]"
collegati: []
riferimenti: [backend/main.ts, backend/dist/main.js, backend/tsconfig.json, backend/config/logger.ts, backend/app.module.ts, backend/common/logger/winston-logger.service.ts]
---

**Domanda:** Cosa fanno, nel dettaglio, i sette import in cima a backend/main.ts?
**Risposta:** Con "module": "CommonJS" (tsconfig) ogni import diventa un require(), eseguito nell'ordine in cui è scritto (verificabile in dist/main.js).
Un import è simile a require_once che restituisce un valore: il file viene eseguito solo la prima volta, il risultato resta in una cache del processo, e chi lo importa dopo riceve LO STESSO oggetto (main.ts e app.module.ts condividono la stessa istanza Winston).
A differenza di include, il file importato ha uno scope proprio: si ricevono solo i nomi esportati, scelti tra graffe (import nominale) o col nome che si vuole (import default).
Percorso senza "./" = pacchetto in node_modules; con "./" = file del progetto, estensione omessa.
Le interfacce (NestFastifyApplication) esistono solo per il compilatore e spariscono nel JS; le classi restano, ed è per questo che ConfigService e WinstonLoggerService possono fare da "chiave" in app.get().
import AppModule innesca a catena l'import di tutta l'applicazione.
winstonLogger usa un import default su un modulo con `export =`: funziona grazie a esModuleInterop (__importDefault in dist/main.js).

## Risposta completa

**Dove eravamo (N-0001):** main.ts gira una volta all'avvio e non a ogni richiesta. Crea l'app con NestFactory.create sopra Fastify, collega Winston, attiva gli hook di spegnimento, chiama configureApp e si mette in ascolto su 0.0.0.0. Se l'avvio fallisce, il catch scrive l'errore nel log ed esce con codice 1. Fra le domande aperte c'erano cosa costruisce davvero NestFactory.create e perché ci sono due logger.

Ora gli import. Prima come funziona il meccanismo, poi le sette righe una per una.

### Cosa diventa un import quando il codice gira

Node non esegue il TypeScript: esegue il JavaScript che il compilatore scrive in dist/. In tsconfig.json c'è `"module": "CommonJS"`, che è il vecchio sistema di moduli di Node. Con questa impostazione ogni import viene tradotto in una chiamata require(). Si vede in dist/main.js, il file compilato:

```js
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const logger_1 = __importDefault(require("./config/logger"));
const app_module_1 = require("./app.module");
const app_setup_1 = require("./app.setup");
const winston_logger_service_1 = require("./common/logger/winston-logger.service");
```

Ne seguono quattro cose.

**1. Gli import vengono eseguiti, nell'ordine in cui sono scritti.** Importare un file significa farlo girare dall'inizio alla fine, come fa include in PHP. Se il file crea oggetti al primo livello, li crea in quel momento. Per questo nel progetto si ripete che "l'ordine degli import decide lo stato del processo". Fino alla fase F7 un import nel posto sbagliato faceva leggere a Prisma un .env non ancora caricato.

**2. Somiglia più a require_once che a include, ma con una differenza importante.** Il file viene eseguito solo la prima volta che qualcuno lo importa. Il risultato resta in una cache del processo, e chi lo importa dopo riceve lo stesso oggetto già pronto. Un esempio concreto: sia main.ts sia app.module.ts importano ./config/logger. Il logger Winston viene creato una volta sola, e i due file hanno in mano la stessa istanza. In PHP questa cache durerebbe una richiesta. Qui dura quanto il processo, cioè giorni.

**3. Il file importato ha un suo scope.** Con include in PHP le variabili del file incluso finiscono nello scope di chi include, e se due file usano $config si pestano i piedi. Con import invece ricevi solo quello che il file ha deciso di esportare con export, e lo ricevi col nome che scegli tu. Tutto il resto del file resta privato.

**4. Il percorso dice dove cercare.**

- Senza `./` davanti (come `'@nestjs/core'`): è un pacchetto installato, e Node lo cerca in node_modules. È il corrispettivo di una libreria in una cartella vendor.
- Con `./` (come `'./app.module'`): è un file del progetto, con percorso relativo a main.ts, come `require __DIR__ . '/app.module.php'`. L'estensione si omette. Nel codice compilato diventa app.module.js.

### Due forme di import

```ts
import { NestFactory } from '@nestjs/core';   // import nominale
import winstonLogger from './config/logger';  // import default
```

- **Nominale**, con le graffe: un file può esportare molti nomi, e tu scegli quali prendere. Il nome dev'essere esattamente quello esportato.
- **Default**, senza graffe: il file dichiara un valore principale, e chi lo importa gli dà il nome che vuole. winstonLogger è un nome scelto da main.ts, non sta scritto in logger.ts.

### Riga per riga

```ts
import { NestFactory } from '@nestjs/core';
```

NestFactory è l'oggetto che costruisce l'applicazione. In main.ts si usa una volta sola, per chiamare create.

```ts
import { ConfigService } from '@nestjs/config';
```

È la classe del servizio che legge e valida le variabili d'ambiente. main.ts non la usa per crearne una nuova con new. La usa come chiave: `app.get(ConfigService)` significa "dammi l'oggetto ConfigService che hai già costruito all'avvio". La scatola che conserva questi oggetti si chiama container. Funziona come un array associativo di oggetti già pronti, e la classe fa da chiave. (Approfondito in N-0003.)

```ts
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
```

Questa riga prende due nomi di natura diversa, ed è il punto TypeScript più interessante di tutto il blocco:

- `FastifyAdapter` è una classe, cioè codice che esiste quando il programma gira. main.ts la istanzia con `new FastifyAdapter()`.
- `NestFastifyApplication` è un'interfaccia. Le interfacce TypeScript esistono solo per il compilatore: descrivono la forma di un oggetto e nel JavaScript scompaiono del tutto. In main.ts si usa solo dentro `create<NestFastifyApplication>`, per dire all'editor che tipo di app si ottiene. In dist/main.js non ne resta traccia: c'è solo `require("@nestjs/platform-fastify")`, che serve per FastifyAdapter.

In PHP un'interface esiste anche a runtime e si può controllare con instanceof. In TypeScript no. Ne viene una regola utile da ricordare: solo le classi possono fare da chiave nel container, perché sono le uniche che esistono ancora quando il programma gira. È il motivo per cui ConfigService e WinstonLoggerService sono classi. (Questa regola viene corretta in N-0003.) Per inciso, app.setup.ts importa la stessa interfaccia con `import type`, che dichiara esplicitamente "questo è solo un tipo". Il risultato è identico, ma lì l'intenzione è scritta.

```ts
import winstonLogger from './config/logger';
```

È l'istanza Winston creata in config/logger.ts: scrive sulla console e nei file logs/error.log e logs/combined.log. main.ts la usa solo nel catch finale, perché se l'avvio fallisce l'app e il suo logger potrebbero non esistere ancora. Un dettaglio tecnico: logger.ts esporta con `export =`, la sintassi del vecchio CommonJS, e quindi non ha davvero un "default". L'import default funziona grazie all'opzione esModuleInterop del tsconfig. Il compilatore avvolge il require in `__importDefault`, che vedi nel codice compilato qui sopra.

```ts
import { AppModule } from './app.module';
```

Questa riga è piccola ma fa partire una catena lunghissima. app.module.ts importa i moduli di Customer, User e Product, il filter degli errori, l'interceptor, la configurazione. Ognuno di questi importa i propri controller, service e DTO, e così via. Quando questa riga ha finito, ogni file dell'applicazione è stato caricato. Attenzione però: caricare i file non vuol dire costruire gli oggetti. I service esistono solo come classi, cioè come "stampi". Gli oggetti veri li crea NestFactory.create dentro bootstrap.

```ts
import { NEST_APP_OPTIONS, configureApp } from './app.setup';
```

Due nomi dallo stesso file: una costante (le opzioni di creazione, con `bodyParser: false`) e una funzione (configureApp). Stanno in un file separato perché anche i test li importano. Se fossero scritti dentro main.ts, i test non potrebbero usarli senza avviare il server.

```ts
import { WinstonLoggerService } from './common/logger/winston-logger.service';
```

Anche questa classe si usa come chiave: `app.get(WinstonLoggerService)`. L'oggetto vero lo costruisce app.module.ts con una "factory", cioè una funzione che lo crea passandogli l'istanza Winston importata da config/logger:

```ts
provide: WinstonLoggerService,
useFactory: () => new WinstonLoggerService(winstonLogger),
```

Questo risponde in parte a una delle domande aperte di N-0001. I due logger non sono due sistemi diversi: WinstonLoggerService è un adattatore che fa scrivere sulla stessa istanza Winston anche i log di NestJS. È la stessa istanza grazie alla cache degli import descritta sopra.

### In sintesi

Il blocco degli import non configura niente. Prepara gli ingredienti: carica tutto il codice dell'app e crea l'unico oggetto che nasce al momento dell'import, cioè il logger Winston. Gli oggetti dell'applicazione li costruisce bootstrap.

**Aperte:**
- Cosa sono i decoratori (@Module, @Injectable) e come emitDecoratorMetadata rende possibile la DI.
- CommonJS ed ESM: come fa un'app compilata in CommonJS a caricare NestJS 12, che è ESM-only?
- Come Node risolve un percorso di pacchetto (node_modules, campo "exports" di package.json).
