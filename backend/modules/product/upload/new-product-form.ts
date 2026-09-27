import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import {
  FieldValidationError,
  toFieldErrors,
} from '../../../common/validation/validation-exception.factory';
import { CreateProductDto } from '../dto/create-product.dto';
import { ImageError, ProductImageValidator } from './product-image.validator';
import { PRODUCT_IMAGE_FIELD, withProductForm } from './product-image-upload.interceptor';
import type { UploadedImage } from './uploaded-files';

/** Ciò che arriva dalla richiesta, prima della validazione. */
export interface RawNewProductForm {
  fields: Record<string, unknown>;
  images: UploadedImage[];
}

/** Ciò che il controller riceve, dopo la validazione: tutto garantito. */
export interface NewProductForm {
  fields: CreateProductDto;
  image: UploadedImage;
}

/** Errori delle immagini raggruppati per file, come nel legacy. */
interface ImageFieldErrors {
  id: typeof PRODUCT_IMAGE_FIELD;
  message: Array<{ filename: string; message: string }>;
}

/**
 * Raccoglie in un solo parametro i campi del form e i file ricevuti:
 *
 *   create(@NewProductFormData(NewProductFormPipe) form: NewProductForm)
 *
 * PERCHÉ NON @Body() + @UploadedFiles() SEPARATI
 * Con due parametri distinti, la validazione del body (ValidationPipe globale)
 * lancerebbe la sua eccezione prima che le immagini vengano controllate: il
 * client riceverebbe prima gli errori dei campi e, dopo averli corretti, in una
 * seconda richiesta quelli dell'immagine. Il legacy li restituiva INSIEME, e la
 * decisione D2 conserva quella forma. Serve quindi un unico punto che veda
 * entrambi: questo parametro e la sua pipe.
 *
 * La ValidationPipe globale non tocca questo parametro: salta i decoratori
 * personalizzati, a meno di configurarla diversamente.
 */
export const NewProductFormData = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RawNewProductForm => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Lo ha messo ProductImageUploadInterceptor, che gira prima. Se manca è un
    // errore di programmazione (decoratore usato senza quell'interceptor), e il
    // valore vuoto fa rispondere "immagine richiesta" invece di esplodere.
    return withProductForm(request).productForm ?? { fields: {}, images: [] };
  }
);

/**
 * Valida insieme campi e immagini di un nuovo prodotto, e produce un'unica
 * risposta d'errore nella forma del progetto: prima i campi, poi l'immagine,
 * come nel legacy.
 *
 * PER CHI VIENE DA PHP
 * Una pipe è una trasformazione applicata a un parametro prima che arrivi al
 * controller: riceve il valore grezzo e restituisce quello validato, oppure
 * lancia. Il ruolo è quello di un ArgumentValueResolver di Symfony che valida
 * l'oggetto prima di passarlo all'azione.
 *
 * Passata come CLASSE al decoratore, e non come istanza: così è NestJS a
 * costruirla, e può iniettarle ProductImageValidator.
 */
@Injectable()
export class NewProductFormPipe implements PipeTransform<RawNewProductForm, Promise<NewProductForm>> {
  constructor(private readonly imageValidator: ProductImageValidator) {}

  async transform(raw: RawNewProductForm): Promise<NewProductForm> {
    const fields = plainToInstance(CreateProductDto, raw.fields);

    const [fieldErrors, imageErrors] = await Promise.all([
      // whitelist: i campi non dichiarati nel DTO vengono scartati, come fa la
      // ValidationPipe globale per le altre rotte.
      validate(fields, { whitelist: true }),
      this.imageValidator.validate(raw.images),
    ]);

    if (fieldErrors.length > 0 || imageErrors.length > 0) {
      // I file temporanei li cancella ProductImageUploadInterceptor quando vede
      // passare questa eccezione: la pipe resta una pura validazione.
      throw new BadRequestException([
        ...toFieldErrors(fieldErrors),
        ...groupImageErrors(imageErrors),
      ]);
    }

    return { fields, image: raw.images[0] };
  }
}

/**
 * Raggruppa gli errori delle immagini sotto un unico elemento `image`, con al
 * più un messaggio per file: la stessa forma prodotta dal legacy
 * validationHandlerMiddleware, che il client usa per mostrare l'errore accanto
 * al file giusto.
 */
export function groupImageErrors(errors: ImageError[]): Array<FieldValidationError | ImageFieldErrors> {
  if (errors.length === 0) {
    return [];
  }

  const firstErrorPerFile = new Map<string, string>();

  for (const { filename, message } of errors) {
    if (!firstErrorPerFile.has(filename)) {
      firstErrorPerFile.set(filename, message);
    }
  }

  return [
    {
      id: PRODUCT_IMAGE_FIELD,
      message: Array.from(firstErrorPerFile, ([filename, message]) => ({ filename, message })),
    },
  ];
}
