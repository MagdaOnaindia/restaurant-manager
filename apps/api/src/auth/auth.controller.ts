import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
  type VerifyEmailInput,
} from "@rms/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService, type IssuedTokens } from "./auth.service";
import { JwtAuthGuard, type RequestUser } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";

const strictThrottle = { default: { limit: 10, ttl: 60_000 } };

@Controller("auth")
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.isProd = config.get("NODE_ENV") === "production";
  }

  private cookieBase(): CookieOptions {
    return { httpOnly: true, sameSite: "lax", secure: this.isProd, path: "/" };
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

  private clearAuthCookies(res: Response) {
    res.clearCookie("access_token", this.cookieBase());
    res.clearCookie("refresh_token", this.cookieBase());
  }

  @Post("register")
  @Throttle(strictThrottle)
  async register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Post("verify-email")
  @HttpCode(200)
  @Throttle(strictThrottle)
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput) {
    await this.auth.verifyEmail(body.token);
    return { ok: true };
  }

  @Post("resend-verification")
  @HttpCode(200)
  @Throttle(strictThrottle)
  async resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema)) body: ResendVerificationInput,
  ) {
    await this.auth.resendVerification(body.email);
    return { ok: true };
  }

  @Post("login")
  @HttpCode(200)
  @Throttle(strictThrottle)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(body);
    this.setAuthCookies(res, tokens);
    return { user };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies as Record<string, string>)["refresh_token"] ?? "";
    const { user, tokens } = await this.auth.refresh(refreshToken);
    this.setAuthCookies(res, tokens);
    return { user };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout((req.cookies as Record<string, string>)["refresh_token"]);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @Post("forgot-password")
  @HttpCode(200)
  @Throttle(strictThrottle)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput) {
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Post("reset-password")
  @HttpCode(200)
  @Throttle(strictThrottle)
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput) {
    await this.auth.resetPassword(body);
    return { ok: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    return { user: await this.auth.me(user.userId) };
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return { user: await this.auth.updateProfile(user.userId, body) };
  }

  @Post("change-password")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    await this.auth.changePassword(user.userId, body);
    return { ok: true };
  }
}
