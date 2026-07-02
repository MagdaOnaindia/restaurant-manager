import { Body, Controller, Get, HttpCode, Param, Post, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Response } from "express";
import {
  acceptInvitationNewUserSchema,
  acceptInvitationSchema,
  type AcceptInvitationInput,
  type AcceptInvitationNewUserInput,
} from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard, type RequestUser } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { OrgsService } from "./orgs.service";
import type { IssuedTokens } from "../auth/auth.service";

@Controller("invitations")
export class InvitationsController {
  private readonly isProd: boolean;

  constructor(
    private readonly orgs: OrgsService,
    config: ConfigService,
  ) {
    this.isProd = config.get("NODE_ENV") === "production";
  }

  private cookieBase(): CookieOptions {
    return { httpOnly: true, sameSite: "lax", secure: this.isProd, path: "/" };
  }

  @Get(":token")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async info(@Param("token") token: string) {
    return { invitation: await this.orgs.getInvitationPublicInfo(token) };
  }

  @Post("accept")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async accept(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationInput,
  ) {
    return this.orgs.acceptExisting(user.userId, user.email, body.token);
  }

  @Post("accept-new")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async acceptNew(
    @Body(new ZodValidationPipe(acceptInvitationNewUserSchema)) body: AcceptInvitationNewUserInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.orgs.acceptNewUser(body.token, body.name, body.password);
    this.setAuthCookies(res, tokens);
    return { user };
  }

  private setAuthCookies(res: Response, tokens: IssuedTokens) {
    res.cookie("access_token", tokens.accessToken, {
      ...this.cookieBase(),
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refresh_token", tokens.refreshToken, {
      ...this.cookieBase(),
      expires: tokens.refreshExpiresAt,
    });
  }
}
