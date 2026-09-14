import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import winstonLogger from './config/logger';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { WinstonLoggerService } from './common/logger/winston-logger.service';
import { groupValidationErrors } from './common/validation/validation-exception.factory';
import { HealthController } from './health.controller';
import { CustomerModule } from './modules/customer/customer.module';
import { UserModule } from './modules/user/user.module';
import { ProductModule } from './modules/product/product.module';

/**
 * Modulo radice dell'applicazione NestJS.
 *
 * Contiene l'infrastruttura trasversale e i tre domini dell'applicazione:
 * Customer con l'health-check, User, Product. Dalla fase F5 della migrazione
 * a NestJS tutte le rotte passano da qui: app.setup.ts monta soltanto i
 * middleware Express che devono precedere le rotte (CORS e parser JSON).
 *
 * PER CHI VIENE DA SYMFONY
 * Un @Module è l'equivalente di un bundle con la sua configurazione dei
 * servizi: `imports` sono gli altri moduli di cui usa i servizi esportati,
 * `providers` sono i servizi che registra nel container.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      // Disponibile in ogni modulo senza doverlo importare ovunque.
      isGlobal: true,
      // Il file .env lo carica già main.ts con dotenv, prima di qualunque
      // import (prisma/client.ts compone la stringa di connessione nel
      // momento stesso in cui viene importato, quindi il caricamento non può
      // aspettare la costruzione di questo modulo). ConfigModule qui VALIDA
      // soltanto.
      // Nei container le variabili arrivano comunque da env_file.
      ignoreEnvFile: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    CustomerModule,
    UserModule,
    ProductModule,
  ],
  controllers: [HealthController],
  providers: [
    // Factory invece di una classe iniettabile: l'adapter riceve l'istanza
    // Winston dal costruttore (vedi winston-logger.service.ts), e questo è
    // l'unico punto del grafo in cui la si collega.
    {
      provide: WinstonLoggerService,
      useFactory: () => new WinstonLoggerService(winstonLogger),
    },
    // APP_FILTER e APP_INTERCEPTOR sono token speciali di NestJS che
    // registrano filter e interceptor come GLOBALI pur dichiarandoli come
    // provider di un modulo. Rispetto a useGlobalFilters() in main.ts hanno
    // due vantaggi concreti: valgono automaticamente anche nei test (che
    // partono da questo stesso modulo, non da main.ts), e possono ricevere
    // dipendenze iniettate — il filter riceve il logger.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    // Valida il body di ogni controller NestJS contro il DTO dichiarato nel
    // parametro @Body(). Registrata qui e non in main.ts per lo stesso motivo
    // di filter e interceptor: vale anche nei test.
    // - whitelist: scarta i campi non dichiarati nel DTO, così un client non
    //   può far arrivare al codice campi come `id` o `current_token`;
    // - transform: il controller riceve un'istanza della classe DTO, non il
    //   JSON grezzo;
    // - exceptionFactory: produce la forma d'errore raggruppata per campo del
    //   progetto invece di quella di default di NestJS (decisione D2).
    //
    // `useValue` e non `useClass`: la pipe va configurata con delle opzioni,
    // e non ha dipendenze da farsi iniettare.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: groupValidationErrors,
      }),
    },
  ],
})
export class AppModule {}
