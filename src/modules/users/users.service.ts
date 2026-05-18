import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  UpdateUserProfileDto,
  AddAddressDto,
  UpdateAddressDto,
} from "./dto/user.dto";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        customer: true,
        affiliate: true,
      },
    });
  }

  async updateUserProfile(userId: string, data: UpdateUserProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
    });
  }

  async getUserAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async addAddress(userId: string, addressData: AddAddressDto) {
    if (addressData.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        street: addressData.street,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
        zipCode: addressData.zipCode,
        isDefault: addressData.isDefault || false,
        userId,
      },
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    addressData: UpdateAddressDto,
  ) {
    const existing = await this.prisma.address.findUnique({
      where: { id: addressId },
      select: { userId: true },
    });

    if (!existing) {
      throw new NotFoundException("Address not found.");
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to update this address.",
      );
    }

    if (addressData.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: {
        street: addressData.street,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
        zipCode: addressData.zipCode,
        isDefault: addressData.isDefault,
      },
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const existing = await this.prisma.address.findUnique({
      where: { id: addressId },
      select: { userId: true },
    });

    if (!existing) {
      throw new NotFoundException("Address not found.");
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to delete this address.",
      );
    }

    return this.prisma.address.delete({
      where: { id: addressId },
    });
  }
}
