---
id: N-0005
titolo: Dove si trova il container usato da main.ts
area: backend
stato: da-verificare
padre: "[[N-0004-import-usati-come-chiave]]"
collegati: []
riferimenti: [backend/main.ts, backend/node_modules/@nestjs/core/nest-factory.js, backend/node_modules/@nestjs/core/injector/container.js, backend/node_modules/@nestjs/core/injector/module.js]
---

**Domanda:** Il container da cui main.ts prende ConfigService e WinstonLoggerService, dove si trova?
**Risposta:** Non è un file né una tabella: è un oggetto nella memoria (RAM) del processo Node.
Lo crea NestFactory.create, riga 25 di main.ts: dentro nest-factory.js c'è `new NestContainer(...)`, poi l'oggetto viene passato a `new NestApplication(container, ...)`.
È quindi dentro la variabile app di main.ts, ed è lì che cerca app.get() (righe 33 e 46).
Dentro è fatto di Map, gli array associativi di JavaScript: un elenco di moduli, e per ogni modulo una Map `_providers` chiave → oggetto (injector/module.js).
Vive quanto il processo: nasce all'avvio, serve tutte le richieste, sparisce allo spegnimento e viene ricostruito da zero al riavvio (anche a ogni salvataggio con npm run dev).
In PHP sarebbe come una variabile $services creata in index.php, ma che non muore a fine richiesta.
Ordine nel tempo: prima girano gli import (righe 1-7), che caricano il codice e rendono disponibili le classi; solo dopo, dentro bootstrap, create costruisce il container usando quelle classi. Gli import non dipendono dal container: è il container che dipende dagli import.

## Risposta completa

**Dove eravamo (N-0004):** dei sette import di main.ts, due (ConfigService e WinstonLoggerService) non vengono mai istanziati né chiamati. Servono solo come nome da passare ad app.get(...), che restituisce l'oggetto già costruito all'avvio. N-0003 aveva chiarito che come chiave serve un valore che esiste a runtime, come una classe o una stringa.

### La risposta breve

Il container non è un file, non è una tabella del database e non è scritto da nessuna parte su disco. È un oggetto nella memoria (RAM) del processo Node, e in main.ts sta dentro la variabile `app`.

### Dove nasce

Alla riga 25 di main.ts:

```ts
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { ... });
```

Dentro NestFactory.create, nel codice di NestJS (node_modules/@nestjs/core/nest-factory.js), succede questo:

```js
const container = new NestContainer(applicationConfig, appOptions);
// ... qui legge AppModule e costruisce tutti gli oggetti dentro il container ...
const instance = new NestApplication(container, httpServer, applicationConfig, graphInspector, appOptions);
```

Viene creato il container, viene riempito, e poi viene consegnato all'oggetto applicazione. Quell'oggetto applicazione è quello che create restituisce e che main.ts mette in app. Il container quindi viaggia dentro app.

Per questo main.ts non lo vede mai per nome: non c'è nessuna variabile container in main.ts. Ci arriva solo attraverso app:

- riga 33: `app.get(WinstonLoggerService)`
- riga 46: `app.get(ConfigService)`

app.get è il metodo che cerca dentro il container che app si porta dietro.

### Com'è fatto dentro

Sono Map, cioè la versione JavaScript di un array associativo PHP. Nel file di NestJS injector/module.js, ogni modulo ha:

```js
_providers = new Map();
```

È l'elenco chiave → oggetto di quel modulo. Il container tiene l'elenco dei moduli, e ogni modulo il suo elenco di oggetti. È lo stesso schema del `$services['ConfigService']` di N-0003, solo diviso per modulo.

### Quanto vive

Qui torna il salto mentale rispetto a PHP:

- In PHP, se index.php creasse un array `$services`, quell'array starebbe nella memoria del processo PHP e sparirebbe a fine richiesta. Alla richiesta successiva verrebbe ricostruito da capo.
- Qui il container nasce una volta, alla riga 25, quando parte il processo. Resta in memoria finché il processo è vivo e serve tutte le richieste, per ore o giorni. Sparisce solo quando il processo si spegne, e al riavvio viene ricostruito da zero.

Un effetto pratico che vedi già: con `npm run dev`, ogni volta che salvi un file il processo riparte. Quindi il container viene buttato e ricostruito, e con lui ConfigService rilegge .env e il client Prisma riapre le connessioni.

### Chiarimento successivo: a cosa servivano allora gli import?

**Domanda dell'utente:** "Ma allora tutto quel discorso che mi hai fatto sugli import a che è servito se il container viene istanziato dopo? Se leggi N-0002, io sto chiedendo solo per gli import."

Hai ragione: da N-0003 in poi ci si è allontanati dalla domanda, che riguardava solo gli import. Il discorso sul container non serviva a capirli: riguarda le righe 33 e 46, non le righe 1-7. Le informazioni non sono sbagliate, ma portavano fuori strada.

**Cosa resta vero sugli import (N-0002):** quello che dice N-0002 vale per intero e non dipende in alcun modo dal container. In sintesi, quando Node esegue main.ts:

1. **Righe 1-7, gli import.** Vengono eseguiti per primi, prima di qualunque altra riga del file. Ognuno carica un file (o un pacchetto da node_modules), lo esegue la prima volta e consegna a main.ts i nomi che quel file esporta. Alla fine di questa fase main.ts ha in mano:
   - delle classi, cioè gli "stampi" dai quali si costruiscono gli oggetti: NestFactory, ConfigService, FastifyAdapter, AppModule, WinstonLoggerService;
   - una funzione e una costante: configureApp e NEST_APP_OPTIONS;
   - un solo oggetto già costruito: winstonLogger, creato nel momento in cui config/logger.ts viene eseguito.

   L'interfaccia NestFastifyApplication invece sparisce in compilazione.
2. **Righe 21-52.** Qui viene solo definita la funzione bootstrap. Nessuna di queste righe viene ancora eseguita.
3. **Riga 58.** bootstrap() viene chiamata, e solo adesso parte tutto il resto.

**Dove si colloca il container in questa sequenza:** il container nasce dopo gli import, alla riga 25, dentro bootstrap. Ed è lui ad aver bisogno degli import, non il contrario: per costruire gli oggetti, NestFactory.create usa le classi che gli import hanno già reso disponibili. AppModule in particolare ha caricato a catena tutte le classi dell'applicazione. Senza gli import non ci sarebbe niente da costruire.

In termini PHP: gli import sono i require_once in cima a index.php, che rendono disponibili funzioni e classi senza ancora fare nulla. Il container è la parte successiva del codice, che con quelle classi costruisce gli oggetti. Sono due momenti distinti, uno dopo l'altro.

Per gli import, quindi, N-0002 è il nodo di riferimento. N-0003, N-0004 e N-0005 sono una deviazione verso il corpo di main.ts.

> **Ordine nel tempo:** prima girano gli import (righe 1-7), che caricano il codice e rendono disponibili le classi; solo dopo, dentro bootstrap, create costruisce il container usando quelle classi. Gli import non dipendono dal container: è il container che dipende dagli import.

**Aperte:**
- Cosa succede agli oggetti del container quando il processo si spegne (riga 39, enableShutdownHooks)?
