import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { CredentialsService } from './credentials.service';

/**
 * Configura la firma dei JWT a partire dalla configurazione validata.
 *
 * Sostituisce services/tokenService.ts come punto unico della policy dei
 * token: segreto, algoritmo e scadenza vengono impostati qui una volta, e
 * JwtService li applica a ogni firma. La differenza è QUANDO si leggono:
 * tokenService leggeva process.env al primo import del modulo, qui arrivano
 * da ConfigService, già validati da config/env.validation.ts.
 *
 * Esportata per poter essere riusata nei test con la stessa forma.
 */
export function jwtModuleOptions(config: ConfigService): JwtModuleOptions {
  return {
    secret: config.getOrThrow<string>('JWT_SECRET'),
    signOptions: {
      algorithm: 'HS256',
      // Cast: la libreria `ms`, usata da jsonwebtoken per interpretare
      // "1h"/"7d", tipizza expiresIn con un tipo stringa ristretto
      // (StringValue). Il valore arriva da .env, quindi per TypeScript è una
      // stringa generica; il formato lo verifica `ms` a runtime, come prima.
      expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as NonNullable<
        JwtModuleOptions['signOptions']
      >['expiresIn'],
    },
  };
}

/**
 * Autenticazione condivisa dalle identità User e Customer.
 *
 * Esporta CredentialsService, usato dai service di registrazione e login di
 * entrambe, e ri-esporta JwtModule: AuthUserGuard chiede JwtService nel
 * costruttore, e un guard viene istanziato nel modulo del controller che lo usa
 * (UserModule, ProductModule), non qui. Senza quell'export l'app non partirebbe
 * con "Nest can't resolve dependencies of the AuthUserGuard".
 *
 * Fino a F6 questo modulo registrava anche PassportModule e la strategia
 * passport-jwt. Dalla fase F7 il guard è scritto a mano (vedi
 * auth-user.guard.ts) e passport non è più una dipendenza del progetto.
 */
@Module({
  imports: [
    // registerAsync e non register: le opzioni dipendono da ConfigService,
    // che esiste solo quando il container è in costruzione.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: jwtModuleOptions,
    }),
  ],
  providers: [CredentialsService],
  exports: [CredentialsService, JwtModule],
})
export class AuthModule {}
