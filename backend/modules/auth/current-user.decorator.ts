import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuthenticatedRequest } from './authenticated-request';

/**
 * Inietta nel parametro di un controller l'utente autenticato da
 * AuthUserGuard:
 *
 *   @Get()
 *   @UseGuards(AuthUserGuard)
 *   profile(@CurrentUser() user: User) { ... }
 *
 * Sostituisce la lettura di `req.user` nei controller legacy, che il tipo
 * dichiarava come `User | undefined` e che andava quindi controllata a mano
 * (i quattro `if (!user) return res.error(401, ...)` di
 * profileUserController) o forzata con `req.user!` (productController).
 *
 * UNA PRECISAZIONE SUI TIPI, per non attribuire al decoratore più di quanto
 * fa. TypeScript non verifica che ciò che il decoratore restituisce
 * corrisponda al tipo scritto accanto al parametro: `user: User` è una
 * dichiarazione del controller. A renderla vera è il controllo qui sotto, a
 * runtime. Il guadagno rispetto a `req.user!` è che l'assenza dell'utente non
 * passa più in silenzio: diventa un errore esplicito.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Accade solo per un errore di programmazione: il decoratore usato su una
    // rotta senza @UseGuards(AuthUserGuard). Un Error generico, non una
    // HttpException: arriva al filter come 500, cioè come un bug da
    // correggere, invece di un 401 che farebbe credere a un problema del
    // client. È verificato in __tests__/appInfrastructure.test.ts.
    if (!request.user) {
      throw new Error(
        '@CurrentUser() usato su una rotta non protetta da AuthUserGuard'
      );
    }

    // Nessun cast: AuthenticatedRequest dichiara `user` come il tipo User di
    // Prisma (authenticated-request.ts).
    return request.user;
  }
);
