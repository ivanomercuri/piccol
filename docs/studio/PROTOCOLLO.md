# Protocollo dei nodi di studio

I nodi sono appunti di studio del proprietario del progetto, non documentazione del progetto.
Coprono l'intero progetto (backend, frontend, database, Docker).
Vivono in `docs/studio/nodi/`, un file per nodo, scritti in italiano.

## Nome e formato

Nome file: `N-<numero a 4 cifre>-<slug>.md`, per esempio `N-0007-prisma-traduce-query.md`.
Per l'ID nuovo leggi la cartella e prendi il massimo esistente + 1: non indovinarlo.
I link tra nodi usano il nome file senza estensione: `[[N-0007-prisma-traduce-query]]`.

Il file inizia con un frontmatter delimitato da due righe `---`, mai da un blocco di codice.
Le relazioni stanno nel frontmatter, come proprietà, con i link `[[...]]` **tra virgolette**
(senza virgolette il YAML si rompe):

```
---
id: N-0007
titolo: Come Prisma Client traduce una query in SQL
area: backend   # backend | frontend | database | docker | trasversale
stato: da-verificare   # verificato solo dopo che il proprietario ha controllato sul codice
padre: "[[N-0003-slug-del-padre]]"
collegati:
  - "[[N-0004-slug]]"
  - "[[N-0012-slug]]"
riferimenti: [backend/modules/product/product.service.ts]
---

## Domanda
Il testo esatto della domanda del proprietario.

## Sintesi
5-10 righe: il concetto in breve, per ripassarlo al volo.

## Spiegazione completa
Copia INTEGRALE della risposta data in chat: stesso testo, stessi blocchi di codice, stesse
analogie, stessa checklist. Non riassumere, non accorciare, non omettere parti.

## Aperte
Domande nate da qui che non hanno ancora un nodo.
```

Per un nodo senza padre scrivi `padre: nessuno` (senza virgolette né link).
Per un nodo senza collegati scrivi `collegati: []`.
Non scrivere nel corpo del file una riga "Padre · Collegati": le relazioni vivono solo
nel frontmatter, per non avere due fonti da tenere allineate.

## Regole

1. La risposta in chat resta quella di sempre (con il perché, le analogie PHP procedurale, la
   checklist se c'è codice). Il nodo contiene sia una sintesi breve sia la copia integrale
   di quella risposta, sotto "Spiegazione completa". Scrivi prima la risposta in chat e
   poi riporta nel nodo lo stesso identico testo: se dopo correggi qualcosa in chat,
   aggiorna anche il nodo.
2. Una domanda merita un nodo solo se apre un concetto nuovo. Un dettaglio risolvibile in una riga
   va aggiunto al nodo corrente, non diventa un nodo.
3. Le domande nate dalla risposta vanno in "Aperte". Non rispondere a quelle non scelte dal
   proprietario: le affronta lui, una alla volta, ripartendo dal nodo.
4. Ogni nodo cita i file reali del progetto in "riferimenti", con percorsi relativi alla radice
   del repo. Il codice è la fonte di verità: se un nodo lo contraddice, correggi il nodo.
   Le decisioni di progetto stanno in AGENTS.md (Design Decisions Log), non nei nodi: rimanda lì.
5. Le relazioni vanno SEMPRE nelle proprietà `padre` e `collegati` del frontmatter, con link
   `[[...]]` tra virgolette e il nome file esatto del nodo di destinazione. Un nome sbagliato
   crea un link non risolto e il grafo non disegna la linea: controlla che il file esista.
6. Aggiorna sempre `INDICE.md` (ID, titolo, area, padre) quando crei un nodo. Nell'indice scrivi
   gli ID in testo semplice, senza `[[...]]`, per non trasformarlo in un hub che inquina il grafo.
7. Chiudi ogni risposta di studio con una riga: `Nodo: N-0007 · padre N-0003 · aperte: 2`.

## Ripresa

Se il proprietario scrive "riparti da N-0007": leggi solo quel nodo e i nodi indicati in
`padre` e `collegati` nel suo frontmatter (non l'intero grafo), riassumi in 3 righe dove
eravamo e continua da lì. La "Sintesi" basta per orientarsi: rileggi la "Spiegazione
completa" solo se la domanda nuova ne dipende.

## Scelta del padre

- "studio: riparti da N-xxx. <domanda>": il padre è N-xxx.
- "studio: <domanda>" senza riferimento: NON indovinare il padre. Se la domanda sembra
  continuare l'ultimo nodo discusso in questa conversazione, proponilo ("Lo collego a
  N-0002?") e attendi conferma prima di creare il file. Se non c'è un candidato chiaro,
  chiedi se è un argomento nuovo (nodo radice, `padre: nessuno`) o a quale nodo collegarlo.
- Una domanda che tocca anche un altro nodo esistente lo cita in `collegati`, ma il padre
  resta uno solo.
- `collegati` serve solo per nodi di un ALTRO ramo. Non inserirvi il padre, il nonno o altri
  antenati: sono già raggiungibili risalendo la catena dei padri. Se non c'è un nodo di
  un altro ramo da collegare, scrivi `collegati: []`.
- Nel corpo del nodo non scrivere link `[[...]]`, nemmeno nella "Spiegazione completa" se
  la copia ne conterrebbe: le relazioni stanno solo nel frontmatter. Se devi citare un
  altro nodo nel testo, scrivi il suo ID in testo semplice (es. N-0001).
- Il proprietario può indicare più nodi: "studio: padre N-0003, collegato N-0002. <domanda>".
  Il padre va in `padre`, gli altri in `collegati`. Se indica più ID senza dire chi è il
  padre, chiedi quale lo è. Una richiesta esplicita di collegare anche un antenato PREVALE
  sulla regola "collegati solo per altri rami": non toglierlo e non obiettare, ma usa
  `collegati` e non scrivere link nel corpo.
- Il nuovo nodo va SEMPRE in `docs/studio/nodi/`, qualunque sia il padre, con ID = massimo
  esistente + 1. Prima di creare il file, leggi i nodi indicati e verifica che i nomi file
  dei link esistano.
- Rispondi esattamente alla domanda scritta dopo l'indicazione dei nodi. I nodi indicati
  servono solo a stabilire i link e il contesto: non cambiano l'argomento e non vanno
  usati per dedurlo. Se la domanda manca, chiedila e non crearla dal padre o dalle
  sue "Aperte".
- Se la domanda riguarda un file preciso (es. backend/main.ts), resta su quel file
  e mettilo in "riferimenti". Non allargare ad altri concetti, a meno che il proprietario
  non lo chieda.