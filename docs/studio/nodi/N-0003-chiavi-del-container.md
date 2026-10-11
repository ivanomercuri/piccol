---
id: N-0003
titolo: Cosa può fare da chiave nel container di NestJS
area: backend
stato: da-verificare
padre: "[[N-0002-import-main-ts]]"
collegati: []
riferimenti: [backend/main.ts, backend/app.module.ts, backend/prisma/prisma.module.ts, backend/modules/product/product.service.ts, backend/dist/modules/product/product.service.js, backend/node_modules/@nestjs/core/constants.js]
---

**Domanda:** Cosa vuol dire "solo le classi possono fare da chiave nel container"?
**Risposta:** Il container è come un array associativo riempito all'avvio: chiave → oggetto già costruito. app.get(chiave) è una ricerca fatta mentre il programma gira, quindi la chiave deve esistere a runtime.
CORREZIONE alla frase di partenza: la chiave può essere qualunque valore runtime, anche una stringa (APP_FILTER vale 'APP_FILTER', in @nestjs/core/constants.js). Ciò che non può farlo è un'interfaccia o un type: spariscono in compilazione. Fra i TIPI TypeScript, solo le classi sopravvivono.
In JS una classe è un valore (come una closure in PHP): si passa, si confronta per identità, non per nome; due classi omonime in file diversi sono chiavi diverse.
Si preferiscono le classi perché il tipo scritto nel costruttore fa anche da chiave: constructor(private readonly prisma: PrismaClient) diventa nel JS __metadata("design:paramtypes", [PrismaClient]), e NestJS cerca la chiave PrismaClient. Con una stringa serve @Inject('...') esplicito.
La classe-chiave è un'etichetta, non dice come l'oggetto è costruito: PrismaClient e WinstonLoggerService sono riempiti con useFactory.

**Aperte:**
- useClass, useValue, useFactory: i tre modi di riempire una chiave, e quando scegliere quale.
- Il container crea un'istanza sola per chiave? Cosa sono gli scope dei provider?
- Come i test sostituiscono l'oggetto di una chiave (provide: PrismaClient, useValue: finto).
