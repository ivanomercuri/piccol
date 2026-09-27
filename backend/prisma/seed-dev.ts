import { prisma } from './client';

/**
 * Seed di SVILUPPO: popola il database con un volume di dati realistico,
 * separato da prisma/seed.ts (che crea i tre utenti di prova e basta).
 *
 * PERCHÉ SERVE, e perché non bastano tre righe: PostgreSQL sceglie come
 * eseguire una query in base a quante righe stima di dover leggere. Su una
 * tabella minuscola ignora gli indici e la scorre tutta, perché leggere
 * poche pagine in sequenza è più veloce che saltare avanti e indietro fra
 * indice e tabella. Con tre prodotti qualunque EXPLAIN direbbe sempre la
 * stessa cosa, e non si imparerebbe nulla: gli indici e i piani di
 * esecuzione diventano osservabili solo quando i dati ci sono davvero.
 */

// Numero di prodotti generati. 5.000 è un compromesso: abbastanza perché il
// planner cambi strategia a seconda della query, poco abbastanza da
// generarli in pochi secondi.
const PRODUCT_COUNT = 5_000;

// Le righe vengono inserite a blocchi invece che tutte insieme: ogni valore
// diventa un parametro della query, e una singola INSERT con decine di
// migliaia di parametri supererebbe i limiti del driver.
const BATCH_SIZE = 1_000;

const CATEGORY_NAMES = [
  'Elettronica', 'Informatica', 'Telefonia', 'Fotografia', 'Audio',
  'Elettrodomestici', 'Casa e Cucina', 'Giardinaggio', 'Fai da te', 'Sport',
  'Abbigliamento', 'Calzature', 'Accessori', 'Libri', 'Giochi',
  'Musica', 'Film', 'Bellezza', 'Salute', 'Animali',
];

const ADJECTIVES = [
  'Classico', 'Premium', 'Compatto', 'Professionale', 'Portatile',
  'Wireless', 'Ultraleggero', 'Resistente', 'Ricaricabile', 'Smart',
];

const NOUNS = [
  'Auricolare', 'Tastiera', 'Monitor', 'Zaino', 'Lampada',
  'Sedia', 'Orologio', 'Borraccia', 'Cavo', 'Supporto',
];

/**
 * Generatore pseudo-casuale deterministico (Mulberry32).
 *
 * Non si usa Math.random di proposito: con un seme fisso, due esecuzioni
 * producono esattamente gli stessi dati. Significa che i tempi e i piani di
 * esecuzione osservati oggi sono confrontabili con quelli di domani, e che
 * un comportamento strano è riproducibile invece di svanire al riavvio.
 */
function createRandom(seed: number) {
  let state = seed;

  return function random(): number {
    state |= 0;

    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260912);

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

async function main() {
  console.log(`Seed di sviluppo: genero ${PRODUCT_COUNT} prodotti...`);

  // Gli utenti devono già esistere: li crea `npm run seed`. Non vengono
  // duplicati qui, perché i prodotti hanno una FK verso di loro e servono
  // autori stabili.
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });

  if (users.length === 0) {
    throw new Error(
      'Nessun utente nel database. Esegui prima `npm run seed` per creare gli utenti di prova.'
    );
  }

  // Pulizia dei dati generati in precedenza, per rendere lo script
  // ripetibile. L'ordine non è casuale: prima le tabelle che referenziano,
  // poi quelle referenziate, altrimenti le foreign key bloccano la
  // cancellazione. Gli utenti NON vengono toccati.
  await prisma.productCategory.deleteMany();

  await prisma.productImage.deleteMany();

  await prisma.product.deleteMany();

  await prisma.category.deleteMany();

  const categories = await prisma.category.createManyAndReturn({
    data: CATEGORY_NAMES.map((name) => ({ name })),
  });

  console.log(`  categorie: ${categories.length}`);

  // DISTRIBUZIONE VOLUTAMENTE SBILANCIATA fra gli autori: il primo utente
  // possiede circa il 70% dei prodotti, il secondo il 25%, il terzo il 5%.
  //
  // Non è un dettaglio estetico: è ciò che rende osservabile la
  // SELETTIVITÀ di un indice. Cercare i prodotti del terzo utente significa
  // leggere poche centinaia di righe su 5.000, e un indice su createdBy
  // conviene; cercare quelli del primo ne restituisce la maggioranza, e
  // spesso il planner preferisce scorrere tutta la tabella invece di usare
  // l'indice. Con una distribuzione uniforme questa differenza non si
  // vedrebbe mai.
  function pickAuthorId(): number {
    const roll = random();

    if (roll < 0.7) return users[0].id;

    if (roll < 0.95) return users[Math.min(1, users.length - 1)].id;

    return users[Math.min(2, users.length - 1)].id;
  }

  let created = 0;

  while (created < PRODUCT_COUNT) {
    const size = Math.min(BATCH_SIZE, PRODUCT_COUNT - created);

    const batch = Array.from({ length: size }, (_, offset) => {
      const index = created + offset;

      return {
        name: `${pick(NOUNS)} ${pick(ADJECTIVES)} ${index}`,
        description:
          // Un prodotto su quattro resta senza descrizione: serve ad avere
          // valori NULL veri su cui osservare come si comportano i filtri.
          random() < 0.75 ? `Descrizione del prodotto numero ${index}.` : null,
        // I prezzi sono stringhe: la colonna è DECIMAL e Prisma accetta
        // (e restituisce) valori decimali come stringa per non perdere
        // precisione, cosa che un float non garantirebbe.
        price: (randomInt(500, 250_000) / 100).toFixed(2),
        quantity: random() < 0.1 ? 0 : randomInt(1, 500),
        available: random() < 0.85,
        // sku ha un vincolo UNIQUE ed è nullable: l'indice va generato
        // univoco, e una parte dei prodotti lo lascia vuoto per avere anche
        // qui dei NULL reali.
        sku: random() < 0.8 ? `SKU-${String(index).padStart(6, '0')}` : null,
        createdBy: pickAuthorId(),
      };
    });

    // createMany invece di create in un ciclo: genera una sola INSERT con
    // molte righe anziché una query per prodotto. Su 5.000 righe la
    // differenza è fra qualche secondo e diversi minuti — è la prima lezione
    // pratica sul costo delle query, prima ancora di parlare di indici.
    await prisma.product.createMany({ data: batch });

    created += size;

    console.log(`  prodotti: ${created}/${PRODUCT_COUNT}`);
  }

  // Gli id dei prodotti servono per le tabelle collegate. Si leggono in un
  // colpo solo selezionando il solo id: caricare l'intera riga di 5.000
  // prodotti per usarne un campo sarebbe sprecare memoria e banda.
  const productIds = await prisma.product.findMany({ select: { id: true } });

  const images = productIds.flatMap(({ id }) => {
    // Da 0 a 3 immagini per prodotto: alcuni non ne hanno nessuna, così le
    // query con JOIN devono davvero gestire il caso "prodotto senza
    // immagini" invece di trovarne sempre almeno una.
    const count = randomInt(0, 3);

    return Array.from({ length: count }, (_, position) => ({
      product_id: id,
      image_url: `/uploads/seed/product-${id}-${position}.jpg`,
      sort_order: position,
    }));
  });

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    await prisma.productImage.createMany({
      data: images.slice(i, i + BATCH_SIZE),
    });
  }

  console.log(`  immagini: ${images.length}`);

  const links = productIds.flatMap(({ id }) => {
    const count = randomInt(1, 3);

    // Set: un prodotto non può essere collegato due volte alla stessa
    // categoria (indice univoco su product_id + category_id), quindi le
    // estrazioni duplicate vanno scartate prima dell'insert.
    const chosen = new Set<number>();

    while (chosen.size < count) {
      chosen.add(pick(categories).id);
    }

    return Array.from(chosen, (categoryId) => ({
      product_id: id,
      category_id: categoryId,
    }));
  });

  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    await prisma.productCategory.createMany({
      data: links.slice(i, i + BATCH_SIZE),
    });
  }

  console.log(`  collegamenti prodotto-categoria: ${links.length}`);

  console.log('Seed di sviluppo completato.');
}

main()
  .catch((error) => {
    console.error('Seed di sviluppo fallito:', error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
