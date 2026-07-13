import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "./jwt-auth.guard";

/** Injects the authenticated user (placed on the request by JwtAuthGuard). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
  return request.user;
});
