import type { HttpRequest } from '../http/types';
import type { AdminService } from '../../services/admin.service';
import { UnauthorizedError } from '../../core/errors/app-error';

export function makeAdminController(deps: { admin: AdminService }) {
  return {
    async reset(req: HttpRequest) {
      if (!req.ctx) throw new UnauthorizedError();
      await deps.admin.reset(req.ctx);
      return { ok: true };
    },

    async saveDefaults(req: HttpRequest) {
      if (!req.ctx) throw new UnauthorizedError();
      await deps.admin.saveDefaults(req.ctx);
      return { ok: true };
    },

    async clearServiceGroupData(req: HttpRequest) {
      if (!req.ctx) throw new UnauthorizedError();
      await deps.admin.clearServiceGroupData(req.ctx);
      return { ok: true };
    },

    async auditLog(req: HttpRequest) {
      if (!req.ctx) throw new UnauthorizedError();
      const limit = req.query['limit'] ? parseInt(req.query['limit']!, 10) : 20;
      return deps.admin.getAuditLog(req.ctx, limit);
    },
  };
}
