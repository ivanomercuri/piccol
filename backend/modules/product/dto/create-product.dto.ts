import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsProductPrice, IsProductQuantity } from './product-field-rules';

/** Lunghezza della colonna products.name, VARCHAR(255). */
export const MAX_PRODUCT_NAME_LENGTH = 255;

/**
 * Campi testuali di POST /products/new (form multipart), con gli stessi
 * messaggi della catena express-validator di routes/productRoutes.ts.
 *
 * I VALORI RESTANO STRINGHE, DI PROPOSITO
 * In un form multipart ogni campo arriva come testo. `price` in particolare
 * non va convertito in number: 0.1 + 0.2 in virgola mobile fa
 * 0.30000000000000004, e un prezzo deve restare esatto fino al centesimo. La
 * colonna del database è DECIMAL(10,2), e Prisma accetta un Decimal anche da
 * una stringa: ProductService.create la passa così com'è, senza mai passare
 * dai numeri a virgola mobile. Le regole di prezzo e quantità, aggiunte in F6,
 * sono in product-field-rules.ts.
 *
 * Non viene usato con la ValidationPipe globale ma da NewProductFormPipe, che
 * lo valida insieme all'immagine per restituire un'unica risposta d'errore
 * (vedi new-product-form.ts).
 */
export class CreateProductDto {
  // MaxLength (F6): la colonna è VARCHAR(255), e un nome più lungo faceva
  // fallire l'INSERT con un 500. @IsString resta l'ultima riga, cioè il primo
  // vincolo applicato: un valore che non è un testo (un campo inviato due volte
  // arriva come array) viola anche MaxLength, e il messaggio giusto è il suo.
  @IsNotEmpty({ message: 'Nome del prodotto è richiesto' })
  @MaxLength(MAX_PRODUCT_NAME_LENGTH, {
    message: `Nome del prodotto non può superare ${MAX_PRODUCT_NAME_LENGTH} caratteri`,
  })
  @IsString({ message: 'Nome del prodotto deve essere un testo' })
  name!: string;

  @IsNotEmpty({ message: 'Descrizione del prodotto è richiesta' })
  @IsString({ message: 'Descrizione del prodotto deve essere un testo' })
  description!: string;

  // Maggiore o uguale a zero, al massimo 2 decimali, al massimo 99999999.99
  // (fase F6, vedi product-field-rules.ts). Resta una stringa.
  @IsNotEmpty({ message: 'Prezzo del prodotto è richiesto' })
  @IsProductPrice()
  price!: string;

  // Intero maggiore di zero, scritto come testo, entro il massimo di un
  // `integer` di PostgreSQL (fase F6, vedi product-field-rules.ts).
  @IsNotEmpty({ message: 'Quantità del prodotto è richiesta' })
  @IsProductQuantity()
  quantity!: string;
}
