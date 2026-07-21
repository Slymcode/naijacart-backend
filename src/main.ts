import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import * as express from "express";
import { join } from "path";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("SellRush");

  // Enable CORS for local development and configured frontends
  const allowedOrigins = [
    "http://10.123.31.116:5173",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("SellRush API")
    .setDescription("E-commerce platform with affiliate marketing system")
    .setVersion("1.0.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "access-token",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  const port = process.env.PORT || 3000;

  // Serve uploaded public assets in dev
  app.use("/public", express.static(join(process.cwd(), "public")));
  await app.listen(port);
  logger.log(`SellRush API running on http://localhost:${port}`);
  logger.log(`API Documentation: http://localhost:${port}/api-docs`);
}

bootstrap();
