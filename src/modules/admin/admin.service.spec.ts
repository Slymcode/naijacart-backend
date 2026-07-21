import { AdminService } from "./admin.service";

describe("AdminService", () => {
  let service: AdminService;
  const mockPrisma: any = {
    adminSetting: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new AdminService(mockPrisma as any);
    jest.clearAllMocks();
  });

  it("creates a platform balance setting when none exists", async () => {
    mockPrisma.adminSetting.findUnique.mockResolvedValue(null);
    mockPrisma.adminSetting.create.mockResolvedValue({
      id: "setting-1",
      key: "platform_account_balance",
      value: "0",
    });

    const result = await service.getPlatformAccount();

    expect(mockPrisma.adminSetting.findUnique).toHaveBeenCalledWith({
      where: { key: "platform_account_balance" },
    });
    expect(mockPrisma.adminSetting.create).toHaveBeenCalledWith({
      data: {
        key: "platform_account_balance",
        value: "0",
      },
    });
    expect(result).toEqual({ id: "setting-1", balance: 0 });
  });
});
