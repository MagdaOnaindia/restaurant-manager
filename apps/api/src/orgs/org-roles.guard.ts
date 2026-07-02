import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { roleAtLeast, type OrgRole } from "@rms/shared";
import type { Membership } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/jwt-auth.guard";

export const ORG_ROLE_KEY = "org_role_required";

/** Rol mínimo necesario en la organización para acceder al endpoint. */
export const OrgRoles = (role: OrgRole) => SetMetadata(ORG_ROLE_KEY, role);

export interface OrgScopedRequest extends Request {
  user: RequestUser;
  membership: Membership;
}

/**
 * Comprueba que el usuario autenticado pertenece a la organización del recurso
 * (por :orgId o resolviendo :restaurantId) con el rol mínimo del decorador @OrgRoles.
 * Debe usarse detrás de JwtAuthGuard.
 */
@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<OrgRole>(ORG_ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? "STAFF";

    const request = context.switchToHttp().getRequest<OrgScopedRequest>();
    const params = request.params as Record<string, string>;

    let orgId = params["orgId"];
    if (!orgId && params["restaurantId"]) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: params["restaurantId"] },
        select: { organizationId: true },
      });
      if (!restaurant) throw new NotFoundException("Restaurante no encontrado");
      orgId = restaurant.organizationId;
    }
    if (!orgId) throw new ForbiddenException("Recurso sin organización");

    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: request.user.userId, organizationId: orgId } },
    });
    if (!membership) throw new ForbiddenException("No perteneces a esta organización");
    if (!roleAtLeast(membership.role, required)) {
      throw new ForbiddenException("No tienes permisos suficientes para esta acción");
    }

    request.membership = membership;
    return true;
  }
}
