import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';

/**
 * Rotte pubbliche dei clienti dello storefront, montate alla radice (`/`)
 * come lo erano in routes/customerRoutes.ts.
 *
 * Il controller non contiene logica, né try/catch, né chiamate a
 * res.success/res.error:
 * - la validazione del body avviene PRIMA, nella ValidationPipe globale,
 *   grazie al tipo del parametro decorato con @Body();
 * - il valore restituito viene avvolto nel formato del progetto da
 *   ResponseEnvelopeInterceptor;
 * - le eccezioni del service arrivano ad AllExceptionsFilter.
 * Un controller legacy faceva queste tre cose a mano in ogni metodo.
 */
@Controller()
export class CustomerController {
  constructor(private readonly customerAuth: CustomerAuthService) {}

  /**
   * @HttpCode(200): senza, NestJS risponderebbe 201 a una POST, mentre la
   * rotta legacy rispondeva 200 — il contratto cambierebbe in silenzio. È la
   * trappola documentata in F1 e fissata in __tests__/customerRoutes.test.ts.
   */
  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(@Body() body: RegisterCustomerDto): Promise<string> {
    return this.customerAuth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginCustomerDto): Promise<string> {
    return this.customerAuth.login(body.email, body.password);
  }
}
