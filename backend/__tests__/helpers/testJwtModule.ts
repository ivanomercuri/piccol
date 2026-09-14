import type { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleOptions } from '../../modules/auth/auth.module';

/** Segreto usato solo nei test unitari: mai quello reale di .env. */
export const TEST_JWT_SECRET = 'segreto-usato-solo-nei-test-unitari';

/**
 * JwtModule per i test unitari dei service che firmano token.
 *
 * Costruisce le opzioni con `jwtModuleOptions`, la STESSA funzione usata da
 * AuthModule in produzione: algoritmo e forma della scadenza restano quelli
 * veri, e cambia solo da dove arrivano segreto e durata.
 *
 * PERCHÉ UN FINTO ConfigService E NON UNO VERO
 * Un ConfigService reale darebbe la precedenza a process.env, che nel
 * container dei test contiene il JWT_SECRET vero: il segreto di test verrebbe
 * ignorato in silenzio, e i test dipenderebbero dal contenuto di .env. Qui
 * basta l'unico metodo che jwtModuleOptions usa.
 */
export function testJwtModule() {
  const values: Record<string, string> = {
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_EXPIRES_IN: '1h',
  };

  const config = {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;

  return JwtModule.register(jwtModuleOptions(config));
}
