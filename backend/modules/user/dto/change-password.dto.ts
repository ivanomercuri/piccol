import { IsNotEmpty, IsString } from 'class-validator';

/** Body di PATCH /admin/user/password. Stessi messaggi della validazione legacy. */
export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Vecchia password è richiesta' })
  @IsString({ message: 'Vecchia password deve essere un testo' })
  oldPassword!: string;

  @IsNotEmpty({ message: 'Nuova password è richiesta' })
  @IsString({ message: 'Nuova password deve essere un testo' })
  newPassword!: string;
}
