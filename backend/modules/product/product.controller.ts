import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuthUserGuard } from '../auth/auth-user.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductPage, ProductService } from './product.service';
import { NewProductForm, NewProductFormData, NewProductFormPipe } from './upload/new-product-form';
import { ProductImageUploadInterceptor } from './upload/product-image-upload.interceptor';

/**
 * Rotte dei prodotti, sotto /products come in routes/productRoutes.ts.
 *
 * Il guard è sulla CLASSE, a differenza di UserController: qui tutte le rotte
 * richiedono un utente autenticato, e dichiararlo una volta sola evita che una
 * rotta aggiunta in futuro nasca pubblica per dimenticanza.
 *
 * ORDINE IN CUI NESTJS ESEGUE I PEZZI DI POST /products/new
 * guard (401 se non autenticato, prima che un solo byte venga salvato su disco)
 * → interceptor (riceve i file) → pipe (valida campi e immagine) → metodo.
 * È lo stesso ordine della catena legacy, con authUserMiddleware prima di
 * multer.
 */
@Controller('products')
@UseGuards(AuthUserGuard)
export class ProductController {
  constructor(private readonly products: ProductService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: ListProductsQueryDto): Promise<ProductPage> {
    return this.products.list(user, query);
  }

  @Post('new')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ProductImageUploadInterceptor)
  create(
    @CurrentUser() user: User,
    @NewProductFormData(NewProductFormPipe) form: NewProductForm
  ): Promise<Record<string, never>> {
    return this.products.create(user, form);
  }
}
