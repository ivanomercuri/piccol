---
id: N-0001
titolo: Cosa fa main.ts all'avvio del backend
area: backend
stato: da-verificare
padre: nessuno
collegati: []
riferimenti: [backend/main.ts, backend/app.setup.ts, backend/app.module.ts, backend/config/logger.ts, backend/docs/AVVIO.md]
---

**Domanda:** Cosa fa backend/main.ts, riga per riga, e perché in quell'ordine?
**Risposta:** main.ts gira UNA volta, all'avvio del processo, non a ogni richiesta (a differenza di index.php).
bootstrap() è async perché quasi ogni passo restituisce una Promise.
1. NestFactory.create costruisce l'app: legge AppModule e crea una volta sola tutti gli oggetti (service, guard, Prisma...), collegati fra loro; FastifyAdapter sceglie Fastify come server HTTP. bufferLogs trattiene i log finché non c'è Winston.
2. useLogger(app.get(WinstonLoggerService)): da qui i log di NestJS passano da Winston.
3. enableShutdownHooks: SIGTERM/SIGINT fanno scattare gli hook di chiusura (es. il pool di Prisma).
4. configureApp: CORS, parser JSON, plugin multipart; va fatto prima di listen.
5. Porta da ConfigService (già validata), poi listen su 0.0.0.0 (il default 127.0.0.1 di Fastify non è raggiungibile fuori dal container).
Se un passo lancia, bootstrap().catch logga con Winston "puro" (l'app potrebbe non esistere) ed esce con codice 1.

## Risposta completa

Ecco cosa fa backend/main.ts, dall'alto in basso.

### Il salto mentale prima di tutto

In PHP, index.php parte a ogni richiesta, risponde e muore. main.ts invece gira una volta sola, quando lanci il processo (npm start, o il container che si avvia). Costruisce tutto, si mette in ascolto su una porta e da lì il processo resta vivo, anche per giorni. Le richieste HTTP non rieseguono main.ts: arrivano a oggetti che main.ts ha già creato. Come se il tuo index.php facesse una volta sola i require, il new PDO e le configurazioni, e poi restasse acceso a servire tutti i visitatori con quella stessa connessione.

### La funzione bootstrap

È dichiarata async perché quasi ogni passo restituisce una Promise, cioè un'operazione che finisce "più tardi" (aprire connessioni, registrare plugin, aprire la porta). In PHP una chiamata come new PDO(...) blocca lo script finché non ha finito. In Node si scrive await davanti alla chiamata per ottenere lo stesso effetto, e await si può usare solo dentro una funzione async. Per questo tutto l'avvio sta in una funzione invece che sciolto nel file.

### 1. NestFactory.create (righe 25-31)

È la riga che fa più lavoro. NestJS legge AppModule (che elenca tutti i moduli: utenti, clienti, prodotti, Prisma, configurazione…) e costruisce una volta sola ogni oggetto dell'applicazione: i service, i guard, il client Prisma. Poi li collega fra loro. Se un service ha bisogno del client Prisma, NestJS glielo passa nel costruttore, invece di lasciare che sia il service a fare un require o un new. È questo che si chiama dependency injection: oggetti già pronti, consegnati da fuori. Il meccanismo merita un nodo a parte, è fra le domande aperte.

Gli argomenti:

- `new FastifyAdapter()`: NestJS non è un server HTTP, organizza il codice e delega la parte di rete a una "piattaforma". Qui si sceglie Fastify. Fino alla fase F7 al suo posto c'era Express.
- `...NEST_APP_OPTIONS`: le tre puntine "spalmano" le opzioni condivise con i test (definite in app.setup.ts). In pratica contengono `bodyParser: false`, che spegne il parser JSON di NestJS perché il progetto usa il proprio.
- `bufferLogs: true`: durante la costruzione NestJS scrive dei log, ma Winston non è ancora collegato. Con questa opzione quei log restano in attesa invece di finire sulla console di default e non arrivare mai in logs/.

Il costrutto TypeScript `create<NestFastifyApplication>` è un generic, e PHP non ha niente di equivalente: la cosa più vicina è un commento @return in un docblock, che però il linguaggio non controlla. Qui serve a dire al compilatore "l'oggetto che ottieni è un'app su Fastify". Da quel momento l'editor e tsc conoscono i metodi specifici di Fastify, come app.register usato in configureApp, e segnalano errore se ne usi uno che non esiste.

### 2. useLogger (riga 33)

`app.get(WinstonLoggerService)` ripesca dal "magazzino" di oggetti appena costruiti il logger Winston. Da qui in avanti i log di NestJS passano da lui, compresi quelli trattenuti da bufferLogs. app.get funziona solo dopo create: prima quel magazzino non esiste.

### 3. enableShutdownHooks (riga 39)

Altra cosa che in PHP non esiste. Lì lo script muore a fine richiesta e PHP chiude da solo connessioni e file. Qui il processo vive a lungo e tiene aperto un pool di connessioni al database. Quando Docker lo ferma (docker compose stop manda SIGTERM) o premi Ctrl+C (SIGINT), questa riga fa sì che NestJS avvisi i moduli che vogliono saperlo. PrismaModule lo usa per chiudere le connessioni in modo pulito invece di troncarle.

### 4. configureApp (riga 41)

Configura l'istanza Fastify: CORS, il parser JSON del progetto (quello che produce "errore json: ...") e il plugin per gli upload multipart. Sta in un file separato perché anche i test la chiamano: così i test verificano la stessa app che gira davvero. L'ordine conta: i plugin Fastify vanno registrati prima che il server sia in ascolto, altrimenti vengono rifiutati.

### 5. Porta e listen (righe 46-51)

- La porta arriva da ConfigService, che all'avvio ha già letto e validato .env (è un numero, ed è presente, altrimenti l'app non sarebbe arrivata fin qui). `getOrThrow` è una seconda difesa che dice a chi legge: "qui un valore mancante non è previsto".
- `'0.0.0.0'` significa "ascolta su tutte le interfacce di rete". Fastify per default ascolta solo su 127.0.0.1, cioè solo dall'interno del container, e la porta pubblicata da Docker non risponderebbe. Express ascoltava ovunque da solo, per questo prima non serviva scriverlo.

### Il catch finale (righe 58-65)

`bootstrap()` restituisce una Promise. Se un passo qualunque fallisce (porta occupata, .env non valido, database irraggiungibile), la Promise viene "rifiutata" e .catch riceve l'errore. Lì dentro:

- Si usa `winstonLogger`, il logger semplice di config/logger.ts, e non quello registrato con useLogger. Il motivo: se l'avvio fallisce dentro create, l'app e il suo logger non esistono ancora.
- `error: unknown` è un altro costrutto TypeScript da notare. In JavaScript si può lanciare qualunque cosa, anche una stringa o un numero, non solo oggetti Error come in PHP 8. TypeScript quindi non può garantire che error abbia .message, e obbliga a controllarlo: `error instanceof Error ? error.message : String(error)`. Dopo l'instanceof il compilatore sa che è un Error (si chiama narrowing) e permette di leggere .message e .stack.
- `process.exit(1)`: esce con un codice diverso da zero. È il segnale a Docker (o a chi ha lanciato il processo) che l'avvio è fallito, invece di lasciare un processo vivo che non serve niente.

Una spiegazione più lunga, con i guasti tipici, è in backend/docs/AVVIO.md.

### Un'osservazione dalla lettura

Il commento su `export =` in config/logger.ts cita file .js che fanno require() del logger. Da main.ts il logger viene importato con import, quindi quel commento potrebbe essere superato. È fra le domande aperte, senza verifica.

**Aperte:**
- Cosa costruisce davvero NestFactory.create: moduli, provider e dependency injection.
- Come enableShutdownHooks e PrismaModule chiudono il pool di connessioni.
- Perché esistono due logger (config/logger.ts e WinstonLoggerService) e come si dividono il lavoro.
- Il commento su `export =` in config/logger.ts parla di file .js con require(): è ancora attuale?
