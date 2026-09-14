import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AuthUserGuard } from '../auth/auth-user.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LoginDto } from '../auth/dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UpdatedUserProfile,
  UserProfile,
  UserProfileService,
} from './user-profile.service';
import { UserAuthService } from './user-auth.service';

/**
 * Risposta di cambio password e logout: `data: {}`, come nei controller
 * legacy (docs/API.md). Il tipo "oggetto senza proprietà" rende esplicito che
 * è una scelta di contratto, non un oggetto dimenticato vuoto.
 */
type EmptyData = Record<string, never>;

/**
 * Rotte degli utenti interni/admin, sotto /admin/user come in
 * routes/adminRoutes.ts + routes/userRoutes.ts.
 *
 * Quattro rotte su sei richiedono @UseGuards(AuthUserGuard). Il guard è
 * dichiarato metodo per metodo, non sulla classe, perché registrazione e
 * login devono restare pubbliche: così chi legge un metodo vede subito se è
 * protetto, senza cercare eccezioni altrove.
 *
 * Rispetto a profileUserController sparisce il controllo
 * `if (!user) return res.error(401, 'Utente non trovato')`, ripetuto quattro
 * volte: se la rotta è protetta dal guard l'utente c'è per costruzione, e se
 * mancasse lo segnalerebbe @CurrentUser().
 */
@Controller('admin/user')
export class UserController {
  constructor(
    private readonly userAuth: UserAuthService,
    private readonly userProfile: UserProfileService
  ) {}

  // @HttpCode(200) su tutte le POST: senza, NestJS risponderebbe 201 invece
  // del 200 delle rotte legacy (trappola documentata in F1).
  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(@Body() body: RegisterUserDto): Promise<string> {
    return this.userAuth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto): Promise<string> {
    return this.userAuth.login(body.email, body.password);
  }

  @Get()
  @UseGuards(AuthUserGuard)
  profile(@CurrentUser() user: User): UserProfile {
    return this.userProfile.getProfile(user);
  }

  @Patch()
  @UseGuards(AuthUserGuard)
  updateProfile(
    @CurrentUser() user: User,
    @Body() body: UpdateProfileDto
  ): Promise<UpdatedUserProfile> {
    return this.userProfile.updateProfile(user.id, body);
  }

  @Patch('password')
  @UseGuards(AuthUserGuard)
  @ResponseMessage('Password aggiornata con successo')
  async changePassword(
    @CurrentUser() user: User,
    @Body() body: ChangePasswordDto
  ): Promise<EmptyData> {
    await this.userAuth.changePassword(user, body.oldPassword, body.newPassword);

    return {};
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthUserGuard)
  @ResponseMessage('Logout effettuato con successo')
  async logout(@CurrentUser() user: User): Promise<EmptyData> {
    await this.userAuth.logout(user.id);

    return {};
  }
}
