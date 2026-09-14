import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CredentialsService } from './credentials.service';
import { JwtUserStrategy } from './jwt-user.strategy';

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
 * Esporta CredentialsService (usato dai service di registrazione e login di
 * entrambe) e rende disponibile la strategia "jwt-user", che AuthUserGuard
 * richiama per nome. La strategia deve comparire fra i provider anche se
 * nessuno la inietta: è la sua costruzione a registrarla in passport.
 */
@Module({
  imports: [
    // register({}) e non l'import nudo di PassportModule: vedi il commento
    // sugli export qui sotto. Nessuna `defaultStrategy` di proposito: con due
    // identità, un AuthGuard() senza nome di strategia deve fallire in modo
    // evidente invece di ricadere in silenzio sulla strategia degli User.
    PassportModule.register({}),
    // registerAsync e non register: le opzioni dipendono da ConfigService,
    // che esiste solo quando il container è in costruzione.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: jwtModuleOptions,
    }),
  ],
  providers: [CredentialsService, JwtUserStrategy],
  // PassportModule è ri-esportato perché AuthUserGuard, ereditando da
  // AuthGuard di @nestjs/passport, chiede nel costruttore AuthModuleOptions.
  // Un guard viene istanziato nel modulo del controller che lo usa
  // (UserModule, e in F4 ProductModule), non qui: quei moduli devono vedere
  // la dipendenza, altrimenti l'app non parte ("Nest can't resolve
  // dependencies of the AuthUserGuard").
  //
  // Due dettagli verificati nel sorgente installato, che rendono necessario
  // tutto questo:
  // - PassportModule importato senza register() non fornisce NESSUN
  //   provider: AuthModuleOptions esiste solo con register/registerAsync;
  // - in AuthGuard la dipendenza è marcata @Optional, ma l'injector di
  //   NestJS 12 legge quel flag con Reflect.getOwnMetadata, cioè solo sulla
  //   classe stessa. Una sottoclasse come AuthUserGuard eredita il TIPO del
  //   parametro ma non il fatto che sia opzionale.
  exports: [CredentialsService, PassportModule],
})
export class AuthModule {}
