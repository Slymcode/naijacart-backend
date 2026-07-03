import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { UploadsService } from "./uploads.service";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";

@Controller("uploads")
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post("/seller-asset")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), "public", "uploads", "sellers");
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.test(ext)) cb(null, true);
        else cb(new BadRequestException("Invalid file type"), false);
      },
    }),
  )
  async uploadSellerAsset(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException("File upload failed");
    const rel = join("public", "uploads", "sellers", file.filename);
    return { success: true, data: { url: this.uploadsService.fileUrl(rel) } };
  }

  @Post("/product-image")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), "public", "uploads", "products");
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.test(ext)) cb(null, true);
        else cb(new BadRequestException("Invalid file type"), false);
      },
    }),
  )
  async uploadProductImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException("File upload failed");
    const rel = join("public", "uploads", "products", file.filename);
    return { success: true, data: { url: this.uploadsService.fileUrl(rel) } };
  }
}
