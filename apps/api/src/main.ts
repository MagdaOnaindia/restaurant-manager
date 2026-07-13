import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  // rawBody: required to verify Stripe webhook signatures
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.use(cookieParser());
  // Dish photos uploaded in development (S3-compatible in production)
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  app.enableCors({
    origin: [process.env.WEB_URL ?? "http://localhost:3000", process.env.PAY_URL ?? "http://localhost:3001"],
    credentials: true,
  });
  // Input validation uses shared Zod schemas (packages/shared) via per-endpoint
  // pipes, not class-validator.
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`API escuchando en http://localhost:${port}`);
}

void bootstrap();

