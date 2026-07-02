import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
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

