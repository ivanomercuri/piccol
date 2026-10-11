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

**Aperte:**
- Perché main.ts non può usare app.get prima di NestFactory.create, e cosa succede se ci prova.
