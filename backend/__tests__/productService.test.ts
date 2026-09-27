// ProductService.list in isolamento: visibilità per livello e paginazione.
// Eredita i casi di productController.test.ts, rimosso in F4.
import type { PrismaClient, User } from '@prisma/client';
import { ListProductsQueryDto } from '../modules/product/dto/list-products-query.dto';
import { ProductService } from '../modules/product/product.service';

describe('ProductService.list', () => {
  const fakePrisma = { product: { findMany: jest.fn(), count: jest.fn() } };

  const service = new ProductService(fakePrisma as unknown as PrismaClient);

  function query(page: number, limit: number): ListProductsQueryDto {
    return Object.assign(new ListProductsQueryDto(), { page, limit });
  }

  const admin = { id: 7, level: 'admin' } as User;

  const superadmin = { id: 1, level: 'superadmin' } as User;

  beforeEach(() => {
    jest.clearAllMocks();

    fakePrisma.product.findMany.mockResolvedValue([]);

    fakePrisma.product.count.mockResolvedValue(0);
  });

  // Regola di autorizzazione: un superadmin vede tutto, senza filtri.
  it('per un superadmin non filtra i prodotti', async () => {
    await service.list(superadmin, query(1, 20));

    expect(fakePrisma.product.findMany.mock.calls[0][0].where).toEqual({});

    expect(fakePrisma.product.count).toHaveBeenCalledWith({ where: {} });
  });

  // Un admin vede solo i propri: il filtro deve valere sia per la pagina sia
  // per il totale, altrimenti total rivelerebbe quanti prodotti hanno gli altri.
  it('per un admin filtra sui propri prodotti, sia la pagina sia il totale', async () => {
    await service.list(admin, query(1, 20));

    expect(fakePrisma.product.findMany.mock.calls[0][0].where).toEqual({ createdBy: 7 });

    expect(fakePrisma.product.count).toHaveBeenCalledWith({ where: { createdBy: 7 } });
  });

  // Traduzione di pagina e dimensione in skip/take, e ordinamento stabile: a
  // parità di data decide l'id, altrimenti righe create nello stesso istante
  // potrebbero comparire in due pagine o in nessuna.
  it('traduce la pagina in skip e take, con un ordinamento stabile', async () => {
    await service.list(admin, query(3, 10));

    expect(fakePrisma.product.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        skip: 20,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    );
  });

  // Metadati della pagina: il numero di pagine arrotonda per eccesso.
  it('restituisce gli elementi con i metadati della pagina', async () => {
    const items = [{ id: 1 }, { id: 2 }];

    fakePrisma.product.findMany.mockResolvedValue(items);

    fakePrisma.product.count.mockResolvedValue(21);

    await expect(service.list(admin, query(2, 10))).resolves.toEqual({
      items,
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
  });
});
