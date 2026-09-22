import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient, Product, User } from '@prisma/client';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { toQuantity } from './dto/product-field-rules';
import type { NewProductForm } from './upload/new-product-form';
import { discardUploadedFiles, publicUrlOf } from './upload/uploaded-files';

/** Una pagina di prodotti, con i dati per chiedere le altre. */
export interface ProductPage {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Un prodotto con le sue immagini: ciò che POST /products/new restituisce. */
export type ProductWithImages = Prisma.ProductGetPayload<{ include: { images: true } }>;

/**
 * Finestra entro cui un secondo invio identico dello stesso utente è
 * considerato un doppione (doppio click, retry di rete) e non un nuovo
 * prodotto. Decisione presa in F6, vedi il Design Decisions Log di AGENTS.md.
 */
export const DUPLICATE_WINDOW_MS = 10_000;

/**
 * Primo numero della coppia che identifica un advisory lock di PostgreSQL.
 * Il secondo è l'id dell'utente. Lo spazio dei lock è unico per tutto il
 * database: un prefisso per ogni tipo di lock evita che un lock futuro (ad
 * esempio sulle giacenze, con gli ordini) collida con questo per caso.
 */
const PRODUCT_CREATION_LOCK = 1;

/**
 * Prodotti: elenco visibile all'utente e creazione. Sostituisce
 * controllers/product/productController.ts.
 */
@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Una pagina dei prodotti che l'utente può vedere.
   *
   * ORDINAMENTO STABILE
   * Dal più recente al più vecchio, e a parità di data per id. Il secondo
   * criterio non è un dettaglio: righe create nello stesso istante (il seed di
   * sviluppo ne inserisce migliaia in pochi secondi) hanno la stessa createdAt,
   * e PostgreSQL non garantisce l'ordine fra righe "uguali". Senza un criterio
   * univoco, la stessa riga potrebbe comparire in due pagine, o in nessuna.
   *
   * Le due query (pagina e totale) non sono in una transazione: se un prodotto
   * viene creato fra l'una e l'altra, `total` può differire di uno da ciò che
   * le pagine contengono. Per un elenco amministrativo è accettabile (Design
   * Decisions Log di AGENTS.md, F4).
   *
   * Nota emersa in F6: racchiuderle in `$transaction([...])` NON basterebbe. Al
   * livello predefinito di PostgreSQL, READ COMMITTED, ogni istruzione vede i
   * dati confermati fino al proprio inizio, anche dentro la stessa
   * transazione: le due query vedrebbero comunque due fotografie diverse.
   * Servirebbe REPEATABLE READ, che fissa la fotografia alla prima istruzione,
   * e le due query non potrebbero più partire in parallelo.
   */
  async list(user: User, query: ListProductsQueryDto): Promise<ProductPage> {
    const where = visibleProductsFor(user);

    // Le due query partono insieme invece che una dopo l'altra: sono
    // indipendenti, e Promise.all ne attende la fine in parallelo.
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  /**
   * Crea un prodotto con la sua immagine, oppure restituisce quello appena
   * creato se questa richiesta ne è il doppione.
   *
   * COSA SUCCEDE, IN ORDINE, DENTRO UNA SOLA TRANSAZIONE
   * 1. lock per utente: una seconda richiesta dello stesso utente aspetta qui
   *    che la prima abbia finito (commit o rollback);
   * 2. ricerca di un doppione: stesso utente, stessi campi, creato negli ultimi
   *    DUPLICATE_WINDOW_MS;
   * 3. se non c'è, inserimento di prodotto e riga dell'immagine con UNA
   *    scrittura annidata.
   *
   * PERCHÉ SERVE UNA TRANSAZIONE INTERATTIVA
   * Prodotto e immagine da soli non la richiederebbero: una create annidata
   * (`images: { create: ... }`) Prisma la esegue già in una transazione, e se
   * l'inserimento dell'immagine fallisce il prodotto non resta. Ma il lock del
   * punto 1 vale solo finché la transazione è aperta: deve comprendere anche il
   * controllo e l'inserimento, altrimenti due richieste potrebbero controllare
   * entrambe "nessun doppione" prima che una delle due abbia scritto. Per chi
   * viene da PHP: è `$em->wrapInTransaction(function () { ... })` di Doctrine.
   *
   * IL FILE SU DISCO NON È NELLA TRANSAZIONE, E NON SERVE CHE CI SIA
   * - Se la transazione fallisce, l'eccezione risale attraverso
   *   ProductImageUploadInterceptor, che cancella il file (fase F4).
   * - Se la richiesta è un doppione, la risposta è un successo e l'interceptor
   *   non interviene: il file che questa richiesta ha caricato non verrà mai
   *   referenziato, e lo cancella il service, DOPO il commit.
   */
  async create(user: User, form: NewProductForm): Promise<ProductWithImages> {
    const { product, isDuplicate } = await this.prisma.$transaction(async (tx) => {
      await lockProductCreationFor(tx, user.id);

      const duplicate = await findRecentDuplicate(tx, user, form);

      if (duplicate) {
        return { product: duplicate, isDuplicate: true };
      }

      return { product: await insertProduct(tx, user, form), isDuplicate: false };
    });

    if (isDuplicate) {
      await discardUploadedFiles([form.image], this.logger);
    }

    return product;
  }

}

/**
 * Quali prodotti può vedere un utente: tutti per un superadmin, solo i propri
 * per un admin.
 *
 * CONTROLLO DI ESAUSTIVITÀ CON `never`
 * Il ramo `default` assegna `user.level` a una variabile di tipo `never`, il
 * tipo che non ammette nessun valore. Finché tutti i livelli dell'enum sono
 * gestiti dai `case`, lì dentro TypeScript sa che `level` non può valere
 * nulla, e l'assegnazione compila. Se un giorno lo schema aggiungesse un
 * livello (es. "editor") senza aggiornare questa funzione, la compilazione
 * FALLIREBBE qui, invece di lasciare quel livello a un comportamento non
 * deciso.
 *
 * Il legacy rispondeva 403 a un livello sconosciuto, ma solo a runtime. In
 * PHP 8 il `match` su un enum lancerebbe UnhandledMatchError, anche lui a
 * runtime: qui il controllo avviene prima, alla compilazione.
 */
function visibleProductsFor(user: User): Prisma.ProductWhereInput {
  switch (user.level) {
    case 'superadmin':
      return {};
    case 'admin':
      return { createdBy: user.id };
    default: {
      const unhandledLevel: never = user.level;

      throw new Error(`Livello utente non gestito: ${String(unhandledLevel)}`);
    }
  }
}

/**
 * Serializza le creazioni di prodotti dello stesso utente, fino alla fine della
 * transazione.
 *
 * ADVISORY LOCK DI POSTGRESQL
 * È un lock su un numero scelto dall'applicazione, non su una riga: qui non
 * esiste ancora nessuna riga da bloccare (il prodotto sta per essere creato),
 * quindi un `SELECT ... FOR UPDATE` non avrebbe niente su cui agire. La
 * variante `_xact_` si rilascia da sola al commit o al rollback: non esiste un
 * percorso d'errore in cui resti preso. Per chi viene da PHP: è un flock() su
 * un file, ma dentro il database e legato alla transazione.
 *
 * Il lock è per utente, non globale: due admin diversi creano prodotti in
 * parallelo senza aspettarsi, perché un doppione può nascere solo dallo stesso
 * utente.
 *
 * `$executeRaw` e non `$queryRaw`: la funzione restituisce `void`, un tipo che
 * non serve leggere. I `::int4` scelgono in modo esplicito la variante della
 * funzione con due interi, invece di lasciarla dedurre dai parametri.
 */
async function lockProductCreationFor(tx: Prisma.TransactionClient, userId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PRODUCT_CREATION_LOCK}::int4, ${userId}::int4)`;
}

/**
 * Il prodotto creato di recente dallo stesso utente con gli stessi campi, se
 * esiste.
 *
 * PERCHÉ FUNZIONA SOLO CON READ COMMITTED (il livello predefinito)
 * Una richiesta che ha aspettato il lock esegue questa query DOPO il commit
 * della prima. In READ COMMITTED ogni istruzione vede i dati confermati fino a
 * quel momento, quindi trova il prodotto appena creato. In REPEATABLE READ
 * vedrebbe invece i dati com'erano alla sua PRIMA istruzione, cioè al momento
 * della richiesta del lock, prima del commit dell'altra: non troverebbe il
 * doppione e ne creerebbe un secondo. Non alzare il livello di isolamento di
 * questa transazione.
 *
 * I campi confrontati sono quelli scelti per la decisione: nome, descrizione,
 * prezzo e quantità. Il prezzo si confronta come numero, non come testo:
 * PostgreSQL considera uguali 9.9 e 9.90. L'immagine non si confronta: un
 * doppio click invia lo stesso file.
 *
 * Il limite di tempo usa l'orologio dell'applicazione e createdAt quello del
 * database: nei container girano sullo stesso orologio di sistema.
 */
function findRecentDuplicate(
  tx: Prisma.TransactionClient,
  user: User,
  form: NewProductForm
): Promise<ProductWithImages | null> {
  const { name, description, price, quantity } = form.fields;

  return tx.product.findFirst({
    where: {
      createdBy: user.id,
      name,
      description,
      price,
      quantity: toQuantity(quantity),
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    include: { images: true },
  });
}

/**
 * Inserisce prodotto e riga dell'immagine con una sola create annidata.
 *
 * I campi sono mappati uno per uno, mai con uno spread del DTO: è qui che si
 * decide che cosa arriva al database. `createdBy` viene dal token, non dal
 * form. `price` resta la stringa validata, che Prisma converte in Decimal
 * senza passare dai numeri a virgola mobile.
 */
function insertProduct(
  tx: Prisma.TransactionClient,
  user: User,
  form: NewProductForm
): Promise<ProductWithImages> {
  const { name, description, price, quantity } = form.fields;

  return tx.product.create({
    data: {
      name,
      description,
      price,
      quantity: toQuantity(quantity),
      createdBy: user.id,
      images: { create: [{ image_url: publicUrlOf(form.image), sort_order: 0 }] },
    },
    include: { images: true },
  });
}
