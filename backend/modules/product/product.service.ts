import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, Product, User } from '@prisma/client';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { NewProductForm } from './upload/new-product-form';

/** Una pagina di prodotti, con i dati per chiedere le altre. */
export interface ProductPage {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Prodotti: elenco visibile all'utente e (in futuro) creazione. Sostituisce
 * controllers/product/productController.ts.
 */
@Injectable()
export class ProductService {
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
   * le pagine contengono. Per un elenco amministrativo è accettabile; una
   * transazione di sola lettura lo eviterebbe, ed è un tema del percorso
   * PostgreSQL (fase F6).
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
   * ⚠️ STUB, come il createProduct legacy: non crea nulla, e il file caricato
   * resta in uploads/. L'implementazione, con la transazione che deve salvare
   * insieme prodotto e immagine, è la fase F6.
   *
   * Riceve comunque i dati già validati, così la firma è quella definitiva.
   */
  async create(_user: User, _form: NewProductForm): Promise<Record<string, never>> {
    return {};
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
