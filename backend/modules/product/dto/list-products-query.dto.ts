// Import esplicito di reflect-metadata, per lo stesso motivo spiegato in
// config/env.validation.ts: @Type di class-transformer usa Reflect.getMetadata,
// e senza questa riga il DTO funzionerebbe solo se qualcun altro (NestJS) ha
// già caricato il polyfill. Lo ha mostrato productService.test.ts, che carica
// questo file da solo.
import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Massimo di prodotti per pagina: un client non può chiedere la tabella intera. */
export const MAX_PAGE_SIZE = 100;

/**
 * Parametri di paginazione di GET /products: `?page=2&limit=20`.
 *
 * PERCHÉ LA PAGINAZIONE (dal percorso PostgreSQL, CHECKPOINT.md)
 * Con i dati di sviluppo (5.000 prodotti) GET /products restituiva tutte le
 * righe a ogni richiesta: 1,2 MB di JSON. L'analisi aveva mostrato che il
 * problema non era una query lenta ma la quantità di dati: quando si chiedono
 * tutte le righe, nessun indice può aiutare.
 *
 * Tutto ciò che arriva dalla query string è testo: @Type(() => Number) lo
 * converte prima della validazione. Un valore non numerico diventa NaN e non
 * supera @IsInt. I valori iniziali delle proprietà sono i default usati
 * quando il parametro manca.
 */
export class ListProductsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve essere un numero intero' })
  @Min(1, { message: 'page deve essere almeno 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve essere un numero intero' })
  @Min(1, { message: 'limit deve essere almeno 1' })
  @Max(MAX_PAGE_SIZE, { message: `limit non può superare ${MAX_PAGE_SIZE}` })
  limit: number = 20;
}
