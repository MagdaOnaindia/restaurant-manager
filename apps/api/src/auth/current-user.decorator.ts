import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "./jwt-auth.guard";

/** Inyecta el usuario autenticado (lo deja JwtAuthGuard en la request). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
  return request.user;
});
