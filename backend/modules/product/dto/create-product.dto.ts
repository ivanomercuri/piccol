import { IsNotEmpty, IsNumberString, IsString, Matches } from 'class-validator';

/**
 * Campi testuali di POST /products/new (form multipart), con gli stessi
 * messaggi della catena express-validator di routes/productRoutes.ts.
 *
 * I VALORI RESTANO STRINGHE, DI PROPOSITO
 * In un form multipart ogni campo arriva come testo. `price` in particolare
 * non va convertito in number: 0.1 + 0.2 in virgola mobile fa
 * 0.30000000000000004, e un prezzo deve restare esatto fino al centesimo. La
 * colonna del database è DECIMAL(10,2), e Prisma accetta un Decimal anche da
 * una stringa: la conversione, quando createProduct verrà implementato (fase
 * F6), avverrà senza passare dai numeri a virgola mobile.
 *
 * Non viene usato con la ValidationPipe globale ma da NewProductFormPipe, che
 * lo valida insieme all'immagine per restituire un'unica risposta d'errore
 * (vedi new-product-form.ts).
 */
export class CreateProductDto {
  @IsNotEmpty({ message: 'Nome del prodotto è richiesto' })
  @IsString({ message: 'Nome del prodotto deve essere un testo' })
  name!: string;

  @IsNotEmpty({ message: 'Descrizione del prodotto è richiesta' })
  @IsString({ message: 'Descrizione del prodotto deve essere un testo' })
  description!: string;

  // Stessa regola del legacy (isNumeric di express-validator e @IsNumberString
  // usano la stessa funzione della libreria validator): ammette decimali e
  // segno. Un prezzo negativo passerebbe, come prima: va deciso in F6, quando
  // il prezzo verrà davvero salvato.
  @IsNotEmpty({ message: 'Prezzo del prodotto è richiesto' })
  @IsNumberString({}, { message: 'Prezzo deve essere un numero' })
  price!: string;

  // Intero maggiore di zero, scritto come testo. Il legacy usava
  // isInt({ gt: 0 }), che non ha un decoratore equivalente in class-validator
  // senza convertire prima in number (e la conversione di "" darebbe 0, con
  // un messaggio sbagliato). L'espressione regolare ammette zeri iniziali e un
  // `+`, come isInt; lo stesso messaggio vale per ogni valore non valido, come
  // nel legacy.
  @IsNotEmpty({ message: 'Quantità del prodotto è richiesta' })
  @Matches(/^\+?0*[1-9]\d*$/, { message: 'Quantità deve essere maggiore di zero' })
  quantity!: string;
}
