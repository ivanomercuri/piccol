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

## Risposta completa

**Dove eravamo (N-0002):** ogni import diventa un require() eseguito nell'ordine in cui è scritto. Il file importato gira una volta sola e poi resta in cache per tutta la vita del processo. Le interfacce esistono solo per il compilatore e nel JavaScript spariscono, mentre le classi restano: per questo ConfigService e WinstonLoggerService possono stare dentro app.get().

### Prima una correzione

La frase "solo le classi possono fare da chiave" era imprecisa. Rileggendo il codice c'è un controesempio nel progetto stesso, in app.module.ts:

```ts
{ provide: APP_FILTER, useClass: AllExceptionsFilter },
```

APP_FILTER non è una classe: in node_modules/@nestjs/core/constants.js è definita come `export const APP_FILTER = 'APP_FILTER';`, cioè una stringa. La versione corretta è questa: la chiave può essere qualunque valore che esiste mentre il programma gira (una classe, una stringa, un Symbol). Non può esserlo un'interfaccia o un type. Fra i tipi TypeScript, le classi sono le uniche che sopravvivono alla compilazione. Il nodo N-0002 era già scritto in modo corretto, l'errore stava solo nella frase in chat.

### Cos'è il container, in termini PHP

Immagina che il tuo index.php, all'avvio, facesse questo:

```php
$services = [];
$services['PrismaClient']   = new PrismaClient($config);
$services['ProductService'] = new ProductService($services['PrismaClient']);
// ...
```

e che poi ogni pagina, invece di fare new, prendesse l'oggetto da lì: `$services['ProductService']`. Quello è un container: un array associativo che va da una chiave a un oggetto già costruito, riempito una volta all'avvio. Qui il processo resta vivo, quindi quegli oggetti servono tutte le richieste per giorni. `app.get(ConfigService)` in main.ts equivale a `$services['ConfigService']`.

Il punto decisivo è che app.get fa una ricerca mentre il programma gira. Per cercare serve un valore concreto da confrontare con le chiavi, che esista in quel momento.

### Perché un'interfaccia non può fare da chiave

Un'interfaccia TypeScript è un'istruzione per il compilatore, non codice. Dopo la compilazione non ne resta niente. Se provassi a scrivere:

```ts
app.get(NestFastifyApplication);
```

tsc si fermerebbe con un errore del tipo "'NestFastifyApplication' only refers to a type, but is being used as a value here". Il compilatore ti sta dicendo che stai cercando di passare come valore qualcosa che a runtime non esisterà. In PHP non c'è un equivalente, perché lì anche le interface esistono a runtime.

### Perché una classe sì, e perché è diversa da PHP

In JavaScript una classe è un valore, come lo sono un numero o una closure in PHP: la puoi mettere in una variabile, passare a una funzione, confrontare. Nel compilato, `app.get(ConfigService)` diventa `app.get(config_1.ConfigService)`: viene passato l'oggetto-classe vero e proprio, non il suo nome.

Questo crea una differenza sottile con PHP. In PHP ti riferisci a una classe col suo nome: `ProductService::class` è la stringa "ProductService". In JavaScript la chiave è l'oggetto-classe, confrontato per identità. Due classi che si chiamano entrambe Logger ma vivono in file diversi sono due chiavi diverse e non si scontrano mai. Due stringhe 'Logger', invece, sarebbero la stessa chiave.

### Perché il progetto preferisce le classi alle stringhe

C'è un vantaggio pratico: con una classe, il tipo scritto nel costruttore fa anche da chiave. In product.service.ts:

```ts
constructor(private readonly prisma: PrismaClient) {}
```

Nel file compilato, dist/modules/product/product.service.js, quella firma lascia questa traccia:

```js
__metadata("design:paramtypes", [client_1.PrismaClient])
```

All'avvio NestJS legge "il primo parametro vuole PrismaClient", cerca nel container la chiave PrismaClient e passa quell'oggetto al costruttore. Con un'interfaccia al posto della classe, in quella lista non ci sarebbe nulla di utile da cercare. Con una chiave stringa bisognerebbe dichiararla a mano, parametro per parametro, con `@Inject('...')`. Come quella riga `__metadata` finisca nel compilato è la prima domanda aperta di N-0002, sui decoratori.

### La classe-chiave non dice come è fatto l'oggetto

Un ultimo dettaglio facile da fraintendere: usare una classe come chiave non significa che il container faccia new di quella classe. È un'etichetta. In prisma.module.ts la chiave PrismaClient viene riempita da una funzione:

```ts
provide: PrismaClient,
inject: [ConfigService],
useFactory: (config: ConfigService): PrismaClient => createPrismaClient({ ... }),
```

Lo stesso vale per WinstonLoggerService in app.module.ts. Chi chiede PrismaClient riceve quello che la factory ha prodotto.

**Aperte:**
- useClass, useValue, useFactory: i tre modi di riempire una chiave, e quando scegliere quale.
- Il container crea un'istanza sola per chiave? Cosa sono gli scope dei provider?
- Come i test sostituiscono l'oggetto di una chiave (provide: PrismaClient, useValue: finto).
