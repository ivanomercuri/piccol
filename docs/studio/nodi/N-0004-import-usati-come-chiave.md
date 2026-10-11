---
id: N-0004
titolo: Perché main.ts importa classi che non istanzia mai
area: backend
stato: da-verificare
padre: "[[N-0003-chiavi-del-container]]"
collegati:
  - "[[N-0002-import-main-ts]]"
riferimenti: [backend/main.ts, backend/app.module.ts, backend/prisma/prisma.module.ts]
---

**Domanda:** Perché, parlando degli import di main.ts, entra in gioco il container?
**Risposta:** Per due soli import su sette. Gli altri cinque si usano direttamente: NestFactory si chiama, FastifyAdapter si istanzia con new, winstonLogger si usa come oggetto, AppModule e NEST_APP_OPTIONS si passano a create, configureApp si chiama.
ConfigService e WinstonLoggerService invece non vengono né istanziati né chiamati: compaiono solo dentro app.get(...).
main.ts non vuole la classe, vuole l'oggetto già costruito all'avvio da NestFactory.create (ConfigService con .env già validato, WinstonLoggerService collegato a Winston). L'import fornisce il nome da cercare, app.get restituisce l'oggetto.
Un new ConfigService() in main.ts creerebbe invece un secondo oggetto, scollegato da quello configurato in app.module.ts.
Analogia PHP: è come fare require di un file solo per avere a disposizione la chiave con cui leggere $services['ConfigService'].

## Risposta completa

**Dove eravamo (N-0003):** la chiave nel container può essere qualunque valore che esiste a runtime (una classe, una stringa, un Symbol), non un'interfaccia o un type.

Hai ragione, ho fatto un salto senza spiegarlo. Il collegamento c'è, ma riguarda solo due dei sette import.

### Come main.ts usa ciò che importa

Se guardi cosa fa main.ts con ciascun nome importato, cinque si comportano come ti aspetti:

| Import | Come lo usa main.ts |
|---|---|
| NestFactory | chiama un suo metodo: `NestFactory.create(...)` |
| FastifyAdapter | lo istanzia: `new FastifyAdapter()` |
| winstonLogger | usa l'oggetto direttamente: `winstonLogger.error(...)` |
| AppModule, NEST_APP_OPTIONS | li passa come argomenti a create |
| configureApp | la chiama: `configureApp(app)` |

Gli altri due fanno una cosa strana:

```ts
app.useLogger(app.get(WinstonLoggerService));           // riga 33
const port = app.get(ConfigService).getOrThrow('PORT'); // riga 46
```

ConfigService e WinstonLoggerService non vengono mai istanziati con new, e main.ts non chiama nessun loro metodo direttamente. Compaiono solo come argomento di `app.get(...)`. Allora perché importarli?

### Perché servono solo come nome da cercare

main.ts non vuole quelle classi. Vuole gli oggetti di quelle classi già costruiti da NestFactory.create alla riga 25:

- un ConfigService che ha già letto e validato .env (con PORT già convertita in numero);
- un WinstonLoggerService già collegato all'istanza Winston, come configurato in app.module.ts.

Quegli oggetti esistono già, li ha creati NestJS mentre costruiva l'app. main.ts deve solo chiederli, e per chiederli deve dire quale vuole. L'import fornisce proprio questo: il nome da usare per la richiesta. `app.get(ConfigService)` significa "dammi l'oggetto ConfigService che hai già costruito".

È qui che entra in gioco il "container" di cui si parlava: è semplicemente il posto dove NestJS tiene quegli oggetti già pronti. In termini PHP, è come se fosse stato costruito all'avvio un array `$services`, e main.ts facesse require di un file solo per avere a disposizione la chiave con cui leggere `$services['ConfigService']`.

### Perché non fare new ConfigService()

Scrivere `new ConfigService()` in main.ts creerebbe un secondo oggetto, nuovo e scollegato da quello configurato in app.module.ts, senza la validazione di validateEnvironment. Per esempio PORT arriverebbe come stringa e non come numero. Con app.get si usa invece l'unico oggetto configurato, lo stesso che usa il resto dell'applicazione.

### Per tornare al filo

Sugli import di main.ts, N-0002 resta il nodo principale: cosa diventano nel compilato, la cache, lo scope, i percorsi. Questo nodo aggiunge un solo dettaglio: due di quegli import non servono a usare la classe, ma a richiedere un oggetto che esiste già. N-0003, cioè cosa può fare da chiave, è stato un approfondimento laterale partito da una frase imprecisa.

**Aperte:**
- Perché main.ts non può usare app.get prima di NestFactory.create, e cosa succede se ci prova.
