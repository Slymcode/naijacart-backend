import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ProductsModule } from "./modules/products/products.module";
import { CartModule } from "./modules/cart/cart.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { AffiliateModule } from "./modules/affiliate/affiliate.module";
import { PaymentModule } from "./modules/payment/payment.module";
import { AdminModule } from "./modules/admin/admin.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { SubscribersModule } from "./modules/subscribers/subscribers.module";
import { SellersModule } from "./modules/sellers/sellers.module";
import { UploadsModule } from "./modules/uploads/uploads.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    PrismaModule, //
    AuthModule,
    UsersModule,
    ProductsModule,
    SellersModule,
    UploadsModule,
    CartModule,
    OrdersModule,
    AffiliateModule,
    PaymentModule,
    AdminModule,
    ReviewsModule,
    SubscribersModule,
  ],
})
export class AppModule {}
