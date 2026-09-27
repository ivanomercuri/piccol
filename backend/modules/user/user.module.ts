import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserController } from './user.controller';
import { UserAuthService } from './user-auth.service';
import { UserProfileService } from './user-profile.service';

/**
 * Dominio User: utenti interni/admin. Migrato a NestJS in F3, sostituisce
 * routes/adminRoutes.ts, routes/userRoutes.ts e i due controller di
 * controllers/user/.
 *
 * Importa AuthModule per CredentialsService e per la strategia "jwt-user"
 * usata da AuthUserGuard.
 */
@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserAuthService, UserProfileService],
})
export class UserModule {}
