import { Controller, Get } from '@nestjs/common';

/**
 * Health-check su GET /, usato anche dall'healthcheck del servizio backend
 * in docker-compose.yml.
 *
 * Nella versione legacy stava in routes/customerRoutes.ts solo perché quel
 * router era montato alla radice: non ha nulla a che vedere con i clienti.
 * Migrando il dominio Customer diventa un controller a sé, dichiarato
 * direttamente in AppModule, come il controller di root nello scheletro
 * standard di un progetto NestJS.
 */
@Controller()
export class HealthController {
  @Get()
  check(): string {
    return '𝕴𝖙 𝖂𝖔𝖗𝖐𝖘!';
  }
}
