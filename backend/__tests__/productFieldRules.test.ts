// Regole di prezzo e quantità di un nuovo prodotto (fase F6), in isolamento.
// I casi principali sono verificati anche end-to-end in productRoutes.test.ts;
// qui ci sono i casi limite, che non vale la pena coprire con una richiesta
// HTTP ciascuno.
import {
  MAX_QUANTITY,
  priceProblem,
  quantityProblem,
  toQuantity,
} from '../modules/product/dto/product-field-rules';

describe('priceProblem', () => {
  // Prezzi validi: interi, uno o due decimali, zero (ammesso di proposito),
  // zeri iniziali, e il massimo esatto di DECIMAL(10,2).
  it.each(['9.99', '10', '0', '0.00', '9.9', '007.50', '99999999.99'])(
    'accetta %s',
    (price) => {
      expect(priceProblem(price)).toBeUndefined();
    }
  );

  // Tutto ciò che non è un numero decimale scritto per esteso. "1e5" e ".5"
  // erano accettati da @IsNumberString; la virgola è l'errore più probabile di
  // un utente italiano, e va rifiutata invece che interpretata.
  it.each(['gratis', '1e5', '.5', '9,99', ' 9.99', '+3', ''])('rifiuta %j come non numerico', (price) => {
    expect(priceProblem(price)).toBe('Prezzo deve essere un numero');
  });

  // Un campo multipart inviato due volte arriva come array: non deve
  // produrre un'eccezione, ma lo stesso messaggio di un valore non numerico.
  it('rifiuta un valore che non è una stringa', () => {
    expect(priceProblem(['9.99', '10'])).toBe('Prezzo deve essere un numero');

    expect(priceProblem(undefined)).toBe('Prezzo deve essere un numero');
  });

  // L'ordine dei controlli decide il messaggio: un prezzo negativo con tre
  // decimali è prima di tutto negativo.
  it('segnala il segno prima dei decimali', () => {
    expect(priceProblem('-1.234')).toBe('Prezzo non può essere negativo');
  });

  // Il caso che PostgreSQL arrotondava in silenzio.
  it('rifiuta più di due decimali', () => {
    expect(priceProblem('12.345')).toBe('Prezzo può avere al massimo 2 decimali');

    expect(priceProblem('12.340')).toBe('Prezzo può avere al massimo 2 decimali');
  });

  // Il primo valore oltre DECIMAL(10,2): 9 cifre intere. Gli zeri iniziali non
  // contano, altrimenti "000000001" sarebbe rifiutato come troppo grande.
  it('rifiuta più di 8 cifre intere, senza contare gli zeri iniziali', () => {
    expect(priceProblem('100000000')).toBe('Prezzo non può superare 99999999.99');

    expect(priceProblem('000000001.50')).toBeUndefined();
  });
});

describe('quantityProblem', () => {
  // Interi positivi, con "+" e zeri iniziali tollerati come prima di F6, fino
  // al massimo di un integer di PostgreSQL compreso.
  it.each(['1', '5', '+3', '007', String(MAX_QUANTITY)])('accetta %s', (quantity) => {
    expect(quantityProblem(quantity)).toBeUndefined();
  });

  it.each(['0', '-1', '1.5', 'tante', '', '1e3'])('rifiuta %j', (quantity) => {
    expect(quantityProblem(quantity)).toBe('Quantità deve essere maggiore di zero');
  });

  // Oltre il massimo: il primo valore fuori range, e una stringa lunghissima,
  // che non deve mai essere convertita in un number approssimato.
  it('rifiuta i valori oltre il massimo di un integer', () => {
    const tooLarge = `Quantità non può superare ${MAX_QUANTITY}`;

    expect(quantityProblem(String(MAX_QUANTITY + 1))).toBe(tooLarge);

    expect(quantityProblem('9'.repeat(30))).toBe(tooLarge);
  });

  it('rifiuta un valore che non è una stringa', () => {
    expect(quantityProblem(5)).toBe('Quantità deve essere maggiore di zero');
  });
});

describe('toQuantity', () => {
  // Dopo la validazione la conversione è esatta, anche con "+" e zeri iniziali.
  it('converte la quantità validata in numero', () => {
    expect(toQuantity('+007')).toBe(7);

    expect(toQuantity(String(MAX_QUANTITY))).toBe(MAX_QUANTITY);
  });
});
