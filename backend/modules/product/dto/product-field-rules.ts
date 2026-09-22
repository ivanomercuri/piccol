import { ValidateBy, ValidationOptions } from 'class-validator';

/**
 * Regole di prezzo e quantità di un nuovo prodotto (fase F6).
 *
 * PERCHÉ SERVONO REGOLE PROPRIE
 * Fino a F5 il prezzo era controllato solo con @IsNumberString, che accetta
 * "-5", "12.345" e "123456789.00", e la quantità solo come intero positivo
 * scritto a testo. Il resto lo decideva PostgreSQL, male:
 * - `DECIMAL(10,2)` ARROTONDA in silenzio: "12.345" diventava 12.35 senza che
 *   nessuno se ne accorgesse;
 * - un prezzo da 10^8 in su, o una quantità oltre il massimo di un `integer`,
 *   facevano fallire l'INSERT: un 500 per un input del client.
 * Le regole qui sotto rifiutano tutti questi casi con un 400 e un messaggio
 * italiano per campo, prima che la richiesta arrivi al database. Il prezzo zero
 * è ammesso di proposito (scelta dell'utente: omaggi, campioni).
 *
 * UN SOLO VINCOLO PER CAMPO, CHE SCEGLIE IL MESSAGGIO
 * Con un decoratore per ogni regola (@IsNumberString, @Min, @Max, ...), un
 * valore che ne viola più d'uno riceverebbe il messaggio del vincolo che
 * class-validator elenca per primo, cioè quello applicato per primo: dipende
 * dall'ordine delle righe nel DTO (trappola documentata in F2). Qui ogni campo
 * ha una sola funzione che esamina il valore e restituisce IL problema, nel
 * suo ordine logico: prima "non è un numero", poi il segno, poi i decimali,
 * poi il massimo.
 *
 * NIENTE NUMERI IN VIRGOLA MOBILE
 * Il prezzo si esamina come TESTO: in virgola mobile 0.1 + 0.2 fa
 * 0.30000000000000004, e contare i decimali di un number è inaffidabile.
 * Resta una stringa fino a Prisma, che la converte direttamente in Decimal.
 */

/** Massimo rappresentabile da DECIMAL(10,2): 8 cifre intere e 2 decimali. */
export const MAX_PRICE = '99999999.99';

/** Massimo di un `integer` di PostgreSQL (4 byte con segno). */
export const MAX_QUANTITY = 2_147_483_647;

const MAX_PRICE_INTEGER_DIGITS = 8;
const MAX_PRICE_DECIMALS = 2;

// Un numero decimale scritto per esteso: segno meno opzionale, cifre, e
// opzionalmente un punto seguito da cifre. Niente notazione esponenziale
// ("1e5"), niente virgola, niente spazi. I gruppi catturano le parti che
// servono ai controlli successivi.
const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

// Un intero positivo scritto per esteso, con "+" e zeri iniziali tollerati
// come faceva la regola precedente. Il gruppo cattura le cifre significative.
const POSITIVE_INTEGER_PATTERN = /^\+?0*([1-9]\d*)$/;

/**
 * Il problema del prezzo indicato, o undefined se il prezzo è valido.
 *
 * `value` è `unknown` perché in un form multipart un campo inviato due volte
 * arriva come array: non si può dare per scontato che sia una stringa.
 */
export function priceProblem(value: unknown): string | undefined {
  const match = typeof value === 'string' ? DECIMAL_PATTERN.exec(value) : null;

  if (!match) {
    return 'Prezzo deve essere un numero';
  }

  const [, sign, integerDigits, decimalDigits = ''] = match;

  if (sign === '-') {
    return 'Prezzo non può essere negativo';
  }

  if (decimalDigits.length > MAX_PRICE_DECIMALS) {
    return `Prezzo può avere al massimo ${MAX_PRICE_DECIMALS} decimali`;
  }

  // Gli zeri iniziali non contano: "00012" ha due cifre intere.
  if (integerDigits.replace(/^0+(?=\d)/, '').length > MAX_PRICE_INTEGER_DIGITS) {
    return `Prezzo non può superare ${MAX_PRICE}`;
  }

  return undefined;
}

/** Il problema della quantità indicata, o undefined se è valida. */
export function quantityProblem(value: unknown): string | undefined {
  const match = typeof value === 'string' ? POSITIVE_INTEGER_PATTERN.exec(value) : null;

  if (!match) {
    return 'Quantità deve essere maggiore di zero';
  }

  // Il confronto con Number è esatto solo sotto 2^53: il controllo sulla
  // lunghezza viene prima, così una stringa di 30 cifre non viene mai
  // convertita in un number approssimato.
  const digits = match[1];

  if (digits.length > String(MAX_QUANTITY).length || Number(digits) > MAX_QUANTITY) {
    return `Quantità non può superare ${MAX_QUANTITY}`;
  }

  return undefined;
}

/**
 * La quantità già validata, come number per Prisma. Da chiamare solo dopo
 * quantityProblem: per costruzione il valore è un intero entro MAX_QUANTITY,
 * quindi la conversione è esatta.
 */
export function toQuantity(value: string): number {
  return Number(value);
}

/**
 * Decoratore di class-validator costruito su priceProblem. `ValidateBy` è il
 * modo previsto dalla libreria per definire un vincolo senza una classe
 * dedicata: `validate` dice se il valore passa, `defaultMessage` rilegge il
 * valore e restituisce il messaggio del problema trovato.
 *
 * Per chi viene da PHP: è l'equivalente di un Constraint di Symfony con il suo
 * ConstraintValidator, scritti come due funzioni invece che due classi.
 */
export function IsProductPrice(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isProductPrice',
      validator: {
        validate: (value: unknown) => priceProblem(value) === undefined,
        defaultMessage: (args) => priceProblem(args?.value) ?? '',
      },
    },
    validationOptions
  );
}

/** Decoratore di class-validator costruito su quantityProblem. */
export function IsProductQuantity(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isProductQuantity',
      validator: {
        validate: (value: unknown) => quantityProblem(value) === undefined,
        defaultMessage: (args) => quantityProblem(args?.value) ?? '',
      },
    },
    validationOptions
  );
}
