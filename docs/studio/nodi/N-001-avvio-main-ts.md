---
id: N-001
titolo: Cosa fa main.ts all'avvio del backend
area: backend
stato: da-verificare
riferimenti: [backend/main.ts, backend/app.setup.ts, backend/app.module.ts, backend/config/logger.ts, backend/docs/AVVIO.md]
---
Padre: nessuno · Collegati: nessuno

**Domanda:** Cosa fa backend/main.ts, riga per riga, e perché in quell'ordine?
**Risposta:** main.ts gira UNA volta, all'avvio del processo, non a ogni richiesta (a differenza di index.php).
bootstrap() è async perché quasi ogni passo restituisce una Promise.
1. NestFactory.create costruisce l'app: legge AppModule e crea una volta sola tutti gli oggetti (service, guard, Prisma...), collegati fra loro; FastifyAdapter sceglie Fastify come server HTTP. bufferLogs trattiene i log finché non c'è Winston.
2. useLogger(app.get(WinstonLoggerService)): da qui i log di NestJS passano da Winston.
3. enableShutdownHooks: SIGTERM/SIGINT fanno scattare gli hook di chiusura (es. il pool di Prisma).
4. configureApp: CORS, parser JSON, plugin multipart; va fatto prima di listen.
5. Porta da ConfigService (già validata), poi listen su 0.0.0.0 (il default 127.0.0.1 di Fastify non è raggiungibile fuori dal container).
Se un passo lancia, bootstrap().catch logga con Winston "puro" (l'app potrebbe non esistere) ed esce con codice 1.

**Aperte:**
- Cosa costruisce davvero NestFactory.create: moduli, provider e dependency injection.
- Come enableShutdownHooks e PrismaModule chiudono il pool di connessioni.
- Perché esistono due logger (config/logger.ts e WinstonLoggerService) e come si dividono il lavoro.
- Il commento su `export =` in config/logger.ts parla di file .js con require(): è ancora attuale?
