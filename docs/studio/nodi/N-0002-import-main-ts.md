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

**Aperte:**
- Cosa sono i decoratori (@Module, @Injectable) e come emitDecoratorMetadata rende possibile la DI.
- CommonJS ed ESM: come fa un'app compilata in CommonJS a caricare NestJS 12, che è ESM-only?
- Come Node risolve un percorso di pacchetto (node_modules, campo "exports" di package.json).
