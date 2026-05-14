import { ExecutionContext, createParamDecorator } from "@nestjs/common";

export interface AuthenticatedUser {
  id: string;
  email: string;
  perfis: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
