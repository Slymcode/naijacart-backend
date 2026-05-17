import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SubscribersService {
  constructor(private prisma: PrismaService) {}

  async createSubscriber(email: string) {
    const existing = await this.prisma.subscriber.findUnique({
      where: { email },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.subscriber.create({
      data: { email },
    });
  }

  async getSubscribers(skip = 0, take = 20) {
    const [data, total] = await Promise.all([
      this.prisma.subscriber.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.subscriber.count(),
    ]);

    return { data, total };
  }

  async removeSubscriber(id: string) {
    return this.prisma.subscriber.delete({
      where: { id },
    });
  }
}
