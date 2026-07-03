import { SellersService } from './sellers.service';
import { BadRequestException } from '@nestjs/common';

describe('SellersService', () => {
  let service: SellersService;
  const mockPrisma: any = {
    seller: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    product: {
      count: jest.fn().mockResolvedValue(0),
    },
    orderItem: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { price: 0 }, _count: { id: 0 } }),
    },
    payoutRequest: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new SellersService(mockPrisma as any);
    jest.clearAllMocks();
  });

  it('should throw if handle already exists', async () => {
    mockPrisma.seller.findUnique.mockResolvedValue({ id: 's1', handle: 'taken' });
    await expect(service.createSeller('u1', { businessName: 'B', handle: 'taken' } as any)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.seller.findUnique).toHaveBeenCalledWith({ where: { handle: 'taken' } });
  });

  it('should create a seller when handle is unique', async () => {
    mockPrisma.seller.findUnique.mockResolvedValue(null);
    mockPrisma.seller.create.mockResolvedValue({ id: 's2', handle: 'new', businessName: 'New' });
    const res = await service.createSeller('u2', { businessName: 'New', handle: 'new' } as any);
    expect(res).toEqual({ id: 's2', handle: 'new', businessName: 'New' });
    expect(mockPrisma.seller.create).toHaveBeenCalled();
  });

  it('should create a payout request for the seller', async () => {
    mockPrisma.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
    mockPrisma.payoutRequest.create.mockResolvedValue({ id: 'payout-1', amount: 200, status: 'PENDING', sellerId: 'seller-1' });

    const result = await service.createPayoutRequestForSeller('user-1', { amount: 200, note: 'First payout' });

    expect(result).toEqual({ id: 'payout-1', amount: 200, status: 'PENDING', sellerId: 'seller-1' });
    expect(mockPrisma.payoutRequest.create).toHaveBeenCalledWith({
      data: {
        sellerId: 'seller-1',
        amount: 200,
        note: 'First payout',
        status: 'PENDING',
      },
    });
  });

  it('should throw when requesting payout for a nonexistent seller', async () => {
    mockPrisma.seller.findUnique.mockResolvedValue(null);

    await expect(
      service.createPayoutRequestForSeller('user-1', { amount: 100 } as any),
    ).rejects.toThrow('Seller not found');
  });

  it('should list admin payout requests', async () => {
    mockPrisma.payoutRequest.findMany.mockResolvedValue([{ id: 'payout-1', seller: { id: 'seller-1', businessName: 'Test' } }]);
    mockPrisma.payoutRequest.count.mockResolvedValue(1);

    const result = await service.adminListPayouts({ page: 0, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockPrisma.payoutRequest.findMany).toHaveBeenCalled();
  });

  it('should update payout status and processedBy', async () => {
    mockPrisma.payoutRequest.update.mockResolvedValue({ id: 'payout-1', status: 'APPROVED', processedBy: 'admin-1' });

    const result = await service.adminUpdatePayoutStatus('payout-1', 'APPROVED', 'admin-1');

    expect(result).toEqual({ id: 'payout-1', status: 'APPROVED', processedBy: 'admin-1' });
    expect(mockPrisma.payoutRequest.update).toHaveBeenCalledWith({
      where: { id: 'payout-1' },
      data: { status: 'APPROVED', processedBy: 'admin-1' },
    });
  });
});
