import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import winstonLogger from './config/logger';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { WinstonLoggerService } from './common/logger/winston-logger.service';

/**
 * Modulo radice dell'applicazione NestJS.
 *
 * Nella fase F1 non contiene ancora nessun modulo di dominio: le rotte sono
 * tutte servite dai router Express legacy, montati dentro l'app da
 * app.setup.ts. Qui vive solo l'infrastruttura trasversale, che dalla fase
 * F2 servirà ai moduli Customer, User e Product.
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
      // import (i moduli legacy leggono process.env nel momento stesso in
      // cui vengono importati, quindi il caricamento non può aspettare la
      // costruzione di questo modulo). ConfigModule qui VALIDA soltanto.
      // Nei container le variabili arrivano comunque da env_file.
      ignoreEnvFile: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
  ],
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
  ],
})
export class AppModule {}
