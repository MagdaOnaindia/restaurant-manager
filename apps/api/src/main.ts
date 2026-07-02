import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());
  // Fotos de platos subidas en desarrollo (S3-compatible en producción)
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  app.enableCors({
    origin: [process.env.WEB_URL ?? "http://localhost:3000", process.env.PAY_URL ?? "http://localhost:3001"],
    credentials: true,
  });
  // La validación de entrada se hace con esquemas Zod compartidos (packages/shared)
  // mediante pipes por endpoint, no con class-validator.
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`API escuchando en http://localhost:${port}`);
}

void bootstrap();

