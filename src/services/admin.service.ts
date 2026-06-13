import { assertCan } from './access-control';
import type {
  IUserRepository,
  IStudentRepository,
  ILeaderRepository,
  IConnectionRepository,
  IServiceSessionRepository,
  IServiceAttendanceRepository,
  ILifegroupRepository,
  ILifegroupWeekRepository,
  ILifegroupAttendanceRepository,
  IImportRepository,
  ISnapshotRepository,
  IAuditRepository,
} from '../repositories/interfaces/entity-repositories';
import type { Actor } from '../core/entities/user';
import type { AdminAuditEntry } from '../core/entities/settings';
import { generateId } from '../utils/id';

export interface AdminAuditRow {
  id: string;
  action: string;
  performedBy: string;
  performedAt: string;
  detail: string;
}

export interface AdminService {
  reset(actor: Actor): Promise<void>;
  saveDefaults(actor: Actor): Promise<void>;
  newYear(actor: Actor): Promise<void>;
  getAuditLog(actor: Actor, limit?: number): Promise<AdminAuditRow[]>;
}

async function writeAudit(
  repo: IAuditRepository,
  actor: Actor,
  action: AdminAuditEntry['action'],
  detail: string,
): Promise<void> {
  await repo.save({
    id: generateId(),
    action,
    performedBy: actor.displayName,
    performedAt: new Date().toISOString(),
    detail,
  });
}

export function makeAdminService(
  users: IUserRepository,
  students: IStudentRepository,
  leaders: ILeaderRepository,
  connections: IConnectionRepository,
  serviceSessions: IServiceSessionRepository,
  serviceAttendance: IServiceAttendanceRepository,
  lifegroups: ILifegroupRepository,
  lifegroupWeeks: ILifegroupWeekRepository,
  lifegroupAttendance: ILifegroupAttendanceRepository,
  imports: IImportRepository,
  snapshots: ISnapshotRepository,
  audit: IAuditRepository,
): AdminService {
  // Wipe all attendance/connection data in FK-safe order (children before
  // parents). Each call is a single bulk DELETE, so this stays well within the
  // serverless function budget regardless of dataset size. Optionally also
  // clears leaders (full reset) vs. retaining them (new-year rollover).
  async function wipeData(opts: { includeLeaders: boolean }): Promise<void> {
    await connections.deleteAll();
    await serviceAttendance.deleteAll();
    await lifegroupAttendance.deleteAll();
    await serviceSessions.deleteAll();
    await lifegroupWeeks.deleteAll();
    await lifegroups.deleteAll();
    await imports.deleteAll();
    await students.deleteAll();
    if (opts.includeLeaders) await leaders.deleteAll();
  }

  return {
    async reset(actor) {
      assertCan(actor, 'admin:manage');
      await wipeData({ includeLeaders: true });
      await writeAudit(audit, actor, 'reset', 'Full data reset — students, leaders, connections, services and lifegroup data cleared');
    },

    async saveDefaults(actor) {
      assertCan(actor, 'admin:manage');
      const allUsers = await users.findAll();
      const allLeaders = await leaders.findAll();
      const now = new Date().toISOString();
      await snapshots.save({
        id: generateId(),
        snapshot: {
          users: allUsers.map(({ passwordHash: _pw, ...u }) => u),
          leaders: allLeaders,
        },
        createdAt: now,
      });
      await writeAudit(audit, actor, 'save-defaults', `Saved ${allUsers.length} accounts and ${allLeaders.length} leaders as defaults`);
    },

    async newYear(actor) {
      assertCan(actor, 'admin:manage');
      // Fresh start for a new year: remove students, connections, service and
      // lifegroup data. Leaders and accounts are retained (use Save Defaults
      // first if you want to snapshot them).
      await wipeData({ includeLeaders: false });
      await writeAudit(audit, actor, 'new-year', 'New year started — students, connections, services and lifegroup data cleared; leaders and accounts retained');
    },

    async getAuditLog(actor, limit = 20) {
      assertCan(actor, 'admin:manage');
      return audit.findRecent(limit);
    },
  };
}
