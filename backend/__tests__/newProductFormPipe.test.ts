// NewProductFormPipe e groupImageErrors in isolamento. Il validatore delle
// immagini è finto: qui interessa come la pipe UNISCE gli errori dei campi e
// quelli dell'immagine in un'unica risposta. Eredita i casi di
// validationHandlerMiddleware.test.ts, rimosso in F4.
import { BadRequestException } from '@nestjs/common';
import { CreateProductDto } from '../modules/product/dto/create-product.dto';
import {
  groupImageErrors,
  NewProductFormPipe,
} from '../modules/product/upload/new-product-form';
import type {
  ImageError,
  ProductImageValidator,
} from '../modules/product/upload/product-image.validator';
import type { UploadedImage } from '../modules/product/upload/uploaded-files';

describe('NewProductFormPipe', () => {
  const image = { originalname: 'ok.png' } as UploadedImage;

  const validFields = {
    name: 'Prodotto',
    description: 'Descrizione',
    price: '9.99',
    quantity: '5',
  };

  function pipeWithImageErrors(errors: ImageError[]): NewProductFormPipe {
    const validator = { validate: jest.fn().mockResolvedValue(errors) };

    return new NewProductFormPipe(validator as unknown as ProductImageValidator);
  }

  // L'array che il client vedrà nel campo `error`.
  async function clientErrorsOf(promise: Promise<unknown>): Promise<unknown> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);

      return ((error as BadRequestException).getResponse() as { message: unknown }).message;
    }

    throw new Error('Attesa una BadRequestException');
  }

  // Caso base: tutto valido, il controller riceve i campi come istanza del
  // DTO e l'unica immagine.
  it('restituisce campi validati e immagine', async () => {
    const form = await pipeWithImageErrors([]).transform({ fields: validFields, images: [image] });

    expect(form.fields).toBeInstanceOf(CreateProductDto);

    expect(form.image).toBe(image);
  });

  // I campi non dichiarati nel DTO vengono scartati, come per le altre rotte.
  it('scarta i campi non previsti', async () => {
    const form = await pipeWithImageErrors([]).transform({
      fields: { ...validFields, createdBy: 999 },
      images: [image],
    });

    expect(form.fields).not.toHaveProperty('createdBy');
  });

  // Il motivo per cui la pipe esiste: errori dei campi ed errori
  // dell'immagine arrivano INSIEME, prima i campi e poi l'immagine, come nel
  // legacy.
  it('unisce errori dei campi ed errori dell\'immagine in un\'unica risposta', async () => {
    const pipe = pipeWithImageErrors([
      { filename: '_generale_', message: "L'immagine del prodotto è richiesta" },
    ]);

    const errors = await clientErrorsOf(
      pipe.transform({ fields: { ...validFields, price: 'gratis', quantity: '0' }, images: [] })
    );

    expect(errors).toEqual([
      { id: 'price', message: 'Prezzo deve essere un numero' },
      { id: 'quantity', message: 'Quantità deve essere maggiore di zero' },
      { id: 'image', message: [{ filename: '_generale_', message: "L'immagine del prodotto è richiesta" }] },
    ]);
  });

  // Senza nessun campo, ogni campo segnala di essere richiesto: la priorità
  // di "è richiesto" vale anche qui.
  it('segnala come richiesti tutti i campi mancanti', async () => {
    const errors = await clientErrorsOf(pipeWithImageErrors([]).transform({ fields: {}, images: [image] }));

    expect(errors).toEqual([
      { id: 'name', message: 'Nome del prodotto è richiesto' },
      { id: 'description', message: 'Descrizione del prodotto è richiesta' },
      { id: 'price', message: 'Prezzo del prodotto è richiesto' },
      { id: 'quantity', message: 'Quantità del prodotto è richiesta' },
    ]);
  });
});

describe('groupImageErrors', () => {
  // Nessun errore sulle immagini: nessun elemento `image` nella risposta.
  it('non produce nulla se non ci sono errori', () => {
    expect(groupImageErrors([])).toEqual([]);
  });

  // Un solo messaggio per file, il primo: come il legacy
  // validationHandlerMiddleware.
  it('raggruppa sotto `image` tenendo il primo messaggio di ogni file', () => {
    expect(
      groupImageErrors([
        { filename: 'a.png', message: 'primo' },
        { filename: 'a.png', message: 'secondo' },
        { filename: 'b.png', message: 'terzo' },
      ])
    ).toEqual([
      {
        id: 'image',
        message: [
          { filename: 'a.png', message: 'primo' },
          { filename: 'b.png', message: 'terzo' },
        ],
      },
    ]);
  });
});
