import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { mkdirSync } from "fs";
import { randomBytes } from "crypto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgRoles, OrgRolesGuard } from "../orgs/org-roles.guard";

const UPLOAD_DIR = join(process.cwd(), "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

@Controller("restaurants/:restaurantId/uploads")
@UseGuards(JwtAuthGuard, OrgRolesGuard)
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post()
  @OrgRoles("MANAGER")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${Date.now()}-${randomBytes(6).toString("hex")}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException("Solo se admiten imágenes JPG, PNG, WebP o AVIF"), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@Param("restaurantId") _restaurantId: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("No se ha recibido ningún archivo");
    const base = this.config.get("API_PUBLIC_URL", "http://localhost:4000");
    return { url: `${base}/uploads/${file.filename}` };
  }
}
