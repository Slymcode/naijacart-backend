import { Injectable } from "@nestjs/common";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

@Injectable()
export class UploadsService {
  private basePath = join(process.cwd(), "public", "uploads");

  ensurePath(subpath: string) {
    const dir = join(this.basePath, subpath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  fileUrl(relativePath: string) {
    // For dev serve via static middleware from /public
    return `${process.env.APP_BASE_URL || "http://localhost:3000"}/${relativePath.replace(/\\\\/g, "/")}`;
  }
}
