import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const Roles = (...roles: Array<string | string[]>) => {
  const normalizedRoles =
    roles.length === 1 && Array.isArray(roles[0])
      ? roles[0]
      : (roles as string[]);
  return SetMetadata("roles", normalizedRoles);
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      "roles",
      context.getHandler(),
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles?.includes(user.role)) {
      throw new ForbiddenException("Access denied");
    }

    return true;
  }
}
