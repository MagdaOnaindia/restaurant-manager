import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  createOrganizationSchema,
  createRestaurantSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type CreateRestaurantInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard, type RequestUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { OrgRoles, OrgRolesGuard } from "./org-roles.guard";
import { OrgsService } from "./orgs.service";
import { RestaurantsService } from "./restaurants.service";

@Controller("orgs")
@UseGuards(JwtAuthGuard)
export class OrgsController {
  constructor(
    private readonly orgs: OrgsService,
    private readonly restaurants: RestaurantsService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationInput,
  ) {
    return { organization: await this.orgs.create(user.userId, body.name) };
  }

  @Get()
  async listMine(@CurrentUser() user: RequestUser) {
    return { organizations: await this.orgs.listMine(user.userId) };
  }

  @Patch(":orgId")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("ADMIN")
  async rename(
    @Param("orgId") orgId: string,
    @Body(new ZodValidationPipe(updateOrganizationSchema)) body: CreateOrganizationInput,
  ) {
    return this.orgs.rename(orgId, body.name);
  }

  @Delete(":orgId")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("OWNER")
  async remove(@Param("orgId") orgId: string) {
    return this.orgs.remove(orgId);
  }

  // ── Members ──────────────────────────────────────────────────────

  @Get(":orgId/members")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("STAFF")
  async listMembers(@Param("orgId") orgId: string) {
    return { members: await this.orgs.listMembers(orgId) };
  }

  @Patch(":orgId/members/:membershipId")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("ADMIN")
  async updateMemberRole(
    @Param("orgId") orgId: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) body: UpdateMemberRoleInput,
  ) {
    return this.orgs.updateMemberRole(orgId, membershipId, body.role, user.userId);
  }

  @Delete(":orgId/members/:membershipId")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("ADMIN")
  async removeMember(@Param("orgId") orgId: string, @Param("membershipId") membershipId: string) {
    return this.orgs.removeMember(orgId, membershipId);
  }

  // ── Invitations (managed from the organization) ─────────────────

  @Post(":orgId/invitations")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("ADMIN")
  async invite(
    @Param("orgId") orgId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
  ) {
    const members = await this.orgs.listMembers(orgId);
    const inviter = members.find((m) => m.userId === user.userId);
    return this.orgs.invite(orgId, inviter?.name ?? "Un compañero", body);
  }

  @Get(":orgId/invitations")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("ADMIN")
  async listInvitations(@Param("orgId") orgId: string) {
    return { invitations: await this.orgs.listInvitations(orgId) };
  }

  @Delete(":orgId/invitations/:invitationId")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("ADMIN")
  async revokeInvitation(
    @Param("orgId") orgId: string,
    @Param("invitationId") invitationId: string,
  ) {
    return this.orgs.revokeInvitation(orgId, invitationId);
  }

  // ── The organization's restaurants ───────────────────────────────

  @Post(":orgId/restaurants")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("ADMIN")
  async createRestaurant(
    @Param("orgId") orgId: string,
    @Body(new ZodValidationPipe(createRestaurantSchema)) body: CreateRestaurantInput,
  ) {
    return { restaurant: await this.restaurants.create(orgId, body) };
  }

  @Get(":orgId/restaurants")
  @UseGuards(OrgRolesGuard)
  @OrgRoles("STAFF")
  async listRestaurants(@Param("orgId") orgId: string) {
    return { restaurants: await this.restaurants.list(orgId) };
  }
}
