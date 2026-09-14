import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerAuthService } from './customer-auth.service';

/**
 * Dominio Customer: clienti dello storefront. Primo dominio migrato a NestJS
 * (fase F2), sostituisce routes/customerRoutes.ts e
 * controllers/customer/authCustomerController.ts.
 *
 * Non importa PrismaModule: è @Global() e registrato in AppModule, quindi
 * PrismaClient è iniettabile ovunque.
 */
@Module({
  controllers: [CustomerController],
  providers: [CustomerAuthService],
})
export class CustomerModule {}
