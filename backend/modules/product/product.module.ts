import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductImageValidator } from './upload/product-image.validator';

/**
 * Dominio Product. Migrato a NestJS in F4, sostituisce routes/productRoutes.ts,
 * controllers/product/productController.ts e la catena di middleware di
 * upload e validazione delle immagini.
 *
 * Importa AuthModule per AuthUserGuard. ProductImageValidator è un provider
 * perché lo richiede NewProductFormPipe, che NestJS costruisce nel contesto di
 * questo modulo.
 */
@Module({
  imports: [AuthModule],
  controllers: [ProductController],
  providers: [ProductService, ProductImageValidator],
})
export class ProductModule {}
