# Protocollo dei nodi di studio

I nodi sono appunti di studio del proprietario del progetto, non documentazione del progetto.
Coprono l'intero progetto (backend, frontend, database, Docker).
Vivono in `docs/studio/nodi/`, un file per nodo, scritti in italiano.

## Nome e formato

Nome file: `N-<numero a 3 cifre>-<slug>.md`, per esempio `N-007-prisma-traduce-query.md`.
Per l'ID nuovo leggi la cartella e prendi il massimo esistente + 1: non indovinarlo.
I link tra nodi usano il nome file senza estensione: `[[N-007-prisma-traduce-query]]`.

```
---
id: N-007
titolo: Come Prisma Client traduce una query in SQL
area: backend   # backend | frontend | database | docker | trasversale
stato: da-verificare   # verificato solo dopo che il proprietario ha controllato sul codice
riferimenti: [backend/modules/product/product.service.ts]
---
Padre: [[N-003-slug-del-padre]] · Collegati: [[N-004-slug]], [[N-012-slug]]

**Domanda:** ...
**Risposta:** ... (massimo 10 righe)
**Aperte:** domande nate da qui che non hanno ancora un nodo
```

Per il primo nodo, o per un nodo senza padre, scrivi `Padre: nessuno`.

## Regole

1. La risposta in chat resta quella di sempre (con il perché, le analogie PHP procedurale, la
   checklist se c'è codice). Il nodo ne è la sintesi, non una copia.
2. Una domanda merita un nodo solo se apre un concetto nuovo. Un dettaglio risolvibile in una riga
   va aggiunto al nodo corrente, non diventa un nodo.
3. Le domande nate dalla risposta vanno in "Aperte". Non rispondere a quelle non scelte dal
   proprietario: le affronta lui, una alla volta, ripartendo dal nodo.
4. Ogni nodo cita i file reali del progetto in "riferimenti", con percorsi relativi alla radice
   del repo. Il codice è la fonte di verità: se un nodo lo contraddice, correggi il nodo.
   Le decisioni di progetto stanno in AGENTS.md (Design Decisions Log), non nei nodi: rimanda lì.
5. Le relazioni vanno SEMPRE nella riga "Padre · Collegati" con link `[[...]]`: il frontmatter
   da solo non crea linee nel grafo.
6. Aggiorna sempre `INDICE.md` (ID, titolo, area, padre) quando crei un nodo. Nell'indice scrivi
   gli ID in testo semplice, senza `[[...]]`, per non trasformarlo in un hub che inquina il grafo.
7. Chiudi ogni risposta di studio con una riga: `Nodo: N-007 · padre N-003 · aperte: 2`.

## Ripresa

Se il proprietario scrive "riparti da N-007": leggi solo quel nodo e i suoi collegati diretti
(non l'intero grafo), riassumi in 3 righe dove eravamo e continua da lì.