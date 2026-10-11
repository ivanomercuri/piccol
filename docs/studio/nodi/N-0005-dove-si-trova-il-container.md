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

**Aperte:**
- Cosa succede agli oggetti del container quando il processo si spegne (riga 39, enableShutdownHooks)?
