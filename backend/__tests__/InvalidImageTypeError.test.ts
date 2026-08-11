// Classe di errore custom in classes/InvalidImageTypeError.ts: attualmente
// non è lanciata da nessuna parte del codice reale (validateProductImageMiddleware
// accoda oggetti semplici su req.validationErrors invece di lanciarla), ma è
// comunque esportata come utility riusabile. Test minimo ma a costo
// praticamente nullo, per fissarne il comportamento se/quando verrà usata.
import InvalidImageTypeError from '../classes/InvalidImageTypeError';

describe('InvalidImageTypeError', () => {
  it('should be an instance of Error with the expected default message and name', () => {
    const err = new InvalidImageTypeError();

    expect(err).toBeInstanceOf(Error);

    expect(err.name).toBe('InvalidImageTypeError');

    expect(err.message).toBe('Solo file JPG o PNG sono ammessi');

    expect(err.field).toBe('image');
  });

  it('should accept a custom message while keeping name and field fixed', () => {
    const err = new InvalidImageTypeError('Messaggio personalizzato');

    expect(err.message).toBe('Messaggio personalizzato');

    expect(err.name).toBe('InvalidImageTypeError');

    expect(err.field).toBe('image');
  });
});