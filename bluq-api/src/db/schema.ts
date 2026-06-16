import { pgTable, uuid, text, timestamp, unique, index, foreignKey, check, jsonb, date, integer, numeric, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const orgs = pgTable("orgs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	logoUrl: text("logo_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	phone: text(),
	name: text().notNull(),
	avatarUrl: text("avatar_url"),
	emailVerified: boolean("email_verified").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_key").on(table.email),
	unique("users_phone_key").on(table.phone),
]);

// Permissions shape stored in the JSONB column:
// { overview: "none"|"view"|"edit", schedule: "...", reports: "...",
//   documents: "...", siteUpdates: "...", team: "...", settings: "..." }
export const workspaceRoles = pgTable("workspace_roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	description: text(),
	permissions: jsonb().notNull().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_wr_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "workspace_roles_workspace_id_fkey",
	}).onDelete("cascade"),
	unique("workspace_roles_workspace_id_name_key").on(table.workspaceId, table.name),
]);

export const workspaceMembers = pgTable("workspace_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: text().notNull(),
	status: text().default('pending').notNull(),
	invitedAt: timestamp("invited_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }),
	pinnedProjectIds: jsonb("pinned_project_ids").default([]).notNull(),
}, (table) => [
	index("idx_wm_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_wm_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "workspace_members_user_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "workspace_members_workspace_id_fkey"
	}).onDelete("cascade"),
	unique("workspace_members_workspace_id_user_id_key").on(table.workspaceId, table.userId),
	check("workspace_members_status_check", sql`status = ANY (ARRAY['pending'::text, 'active'::text, 'deactivated'::text])`),
]);

export const whatsappUpdates = pgTable("whatsapp_updates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id"),
	senderPhone: text("sender_phone").notNull(),
	senderName: text("sender_name"),
	senderUserId: uuid("sender_user_id"),
	rawMessage: text("raw_message").notNull(),
	parsedJson: jsonb("parsed_json"),
	matchedTaskId: uuid("matched_task_id"),
	status: text().default('received').notNull(),
	receivedAt: timestamp("received_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_wa_project").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_wa_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_wa_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.matchedTaskId],
		foreignColumns: [tasks.id],
		name: "whatsapp_updates_matched_task_id_fkey"
	}),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "whatsapp_updates_project_id_fkey"
	}),
	foreignKey({
		columns: [table.senderUserId],
		foreignColumns: [users.id],
		name: "whatsapp_updates_sender_user_id_fkey"
	}),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "whatsapp_updates_workspace_id_fkey"
	}).onDelete("cascade"),
	check("whatsapp_updates_status_check", sql`status = ANY (ARRAY['received'::text, 'processing'::text, 'parsed'::text, 'failed'::text])`),
]);

export const auditEvents = pgTable("audit_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id"),
	eventType: text("event_type").notNull(),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id"),
	actorId: uuid("actor_id"),
	actorType: text("actor_type").default('user').notNull(),
	payload: jsonb(),
	aiAnalysis: text("ai_analysis"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_audit_created").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_audit_project").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_audit_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_audit_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.actorId],
		foreignColumns: [users.id],
		name: "audit_events_actor_id_fkey"
	}),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "audit_events_project_id_fkey"
	}),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "audit_events_workspace_id_fkey"
	}).onDelete("cascade"),
	check("audit_events_actor_type_check", sql`actor_type = ANY (ARRAY['user'::text, 'ai'::text, 'system'::text, 'whatsapp'::text])`),
]);

export const dprs = pgTable("dprs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	taskId: uuid("task_id"),
	reportedBy: uuid("reported_by"),
	reportDate: date("report_date").default(sql`CURRENT_DATE`).notNull(),
	labourCount: integer("labour_count"),
	workDone: text("work_done"),
	percentComplete: numeric("percent_complete", { precision: 5, scale: 2 }),
	remarks: text(),
	delayReason: text("delay_reason"),
	delayDays: integer("delay_days"),
	locationLat: numeric("location_lat", { precision: 10, scale: 7 }),
	locationLng: numeric("location_lng", { precision: 10, scale: 7 }),
	source: text().default('whatsapp').notNull(),
	whatsappUpdateId: uuid("whatsapp_update_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_dprs_date").using("btree", table.projectId.asc().nullsLast().op("date_ops"), table.reportDate.asc().nullsLast().op("uuid_ops")),
	index("idx_dprs_project").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_dprs_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "dprs_project_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.reportedBy],
		foreignColumns: [users.id],
		name: "dprs_reported_by_fkey"
	}),
	foreignKey({
		columns: [table.taskId],
		foreignColumns: [tasks.id],
		name: "dprs_task_id_fkey"
	}),
	foreignKey({
		columns: [table.whatsappUpdateId],
		foreignColumns: [whatsappUpdates.id],
		name: "dprs_whatsapp_update_id_fkey"
	}),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "dprs_workspace_id_fkey"
	}).onDelete("cascade"),
	check("dprs_source_check", sql`source = ANY (ARRAY['whatsapp'::text, 'web'::text])`),
]);

export const dprPhotos = pgTable("dpr_photos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	dprId: uuid("dpr_id"),
	fileUrl: text("file_url").notNull(),
	fileName: text("file_name"),
	geoLat: numeric("geo_lat", { precision: 10, scale: 7 }),
	geoLng: numeric("geo_lng", { precision: 10, scale: 7 }),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_photos_dpr").using("btree", table.dprId.asc().nullsLast().op("uuid_ops")),
	index("idx_photos_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.dprId],
		foreignColumns: [dprs.id],
		name: "dpr_photos_dpr_id_fkey"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "dpr_photos_project_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "dpr_photos_workspace_id_fkey"
	}).onDelete("cascade"),
]);

export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectName: text("project_name").notNull(),
	projectCode: text("project_code"),
	clientName: text("client_name"),
	address: text(),
	category: text(),
	stage: text(),
	startDate: date("start_date"),
	endDate: date("end_date"),
	status: text().default('active').notNull(),
	settingsJson: jsonb("settings_json").default({}),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_projects_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.createdBy],
		foreignColumns: [users.id],
		name: "projects_created_by_fkey"
	}),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "projects_workspace_id_fkey"
	}).onDelete("cascade"),
	check("projects_status_check", sql`status = ANY (ARRAY['active'::text, 'on_hold'::text, 'completed'::text, 'archived'::text])`),
]);

export const shareTokens = pgTable("share_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	token: text().default(sql`encode(gen_random_bytes(32), 'hex')`).notNull(),
	createdBy: uuid("created_by"),
	permissions: text().default('read').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_share_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("idx_share_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.createdBy],
		foreignColumns: [users.id],
		name: "share_tokens_created_by_fkey"
	}),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "share_tokens_project_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "share_tokens_workspace_id_fkey"
	}).onDelete("cascade"),
	unique("share_tokens_token_key").on(table.token),
	check("share_tokens_permissions_check", sql`permissions = 'read'::text`),
]);

export const projectMembers = pgTable("project_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: text().notNull(),
	access: text().default('viewer').notNull(),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_pm_project").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_pm_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_pm_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "project_members_project_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "project_members_user_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "project_members_workspace_id_fkey"
	}).onDelete("cascade"),
	unique("project_members_project_id_user_id_key").on(table.projectId, table.userId),
	check("project_members_access_check", sql`access = ANY (ARRAY['editor'::text, 'viewer'::text, 'no_access'::text])`),
]);

export const tasks = pgTable("tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	title: text().notNull(),
	description: text(),
	assignedTo: uuid("assigned_to"),
	status: text().default('not_started').notNull(),
	priority: text().default('medium'),
	startDate: date("start_date"),
	endDate: date("end_date"),
	actualStart: date("actual_start"),
	actualEnd: date("actual_end"),
	durationDays: integer("duration_days"),
	percentComplete: numeric("percent_complete", { precision: 5, scale: 2 }).default('0'),
	contractor: text(),
	area: text(),
	phase: text(),
	isMilestone: boolean("is_milestone").default(false),
	parentTaskId: uuid("parent_task_id"),
	scheduleVersionId: uuid("schedule_version_id"),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_tasks_assigned").using("btree", table.assignedTo.asc().nullsLast().op("uuid_ops")),
	index("idx_tasks_project").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_tasks_status").using("btree", table.projectId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_tasks_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.assignedTo],
		foreignColumns: [users.id],
		name: "tasks_assigned_to_fkey"
	}),
	foreignKey({
		columns: [table.parentTaskId],
		foreignColumns: [table.id],
		name: "tasks_parent_task_id_fkey"
	}),
	foreignKey({
		columns: [table.scheduleVersionId],
		foreignColumns: [scheduleVersions.id],
		name: "tasks_schedule_version_id_fkey"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "tasks_project_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "tasks_workspace_id_fkey"
	}).onDelete("cascade"),
	check("tasks_priority_check", sql`priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])`),
	check("tasks_status_check", sql`status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'running_late'::text, 'delayed'::text])`),
]);

export const taskDependencies = pgTable("task_dependencies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	predecessorId: uuid("predecessor_id").notNull(),
	successorId: uuid("successor_id").notNull(),
	dependencyType: text("dependency_type").default('FS').notNull(),
	lagDays: integer("lag_days").default(0),
}, (table) => [
	index("idx_deps_predecessor").using("btree", table.predecessorId.asc().nullsLast().op("uuid_ops")),
	index("idx_deps_successor").using("btree", table.successorId.asc().nullsLast().op("uuid_ops")),
	index("idx_deps_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.predecessorId],
		foreignColumns: [tasks.id],
		name: "task_dependencies_predecessor_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.successorId],
		foreignColumns: [tasks.id],
		name: "task_dependencies_successor_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "task_dependencies_workspace_id_fkey"
	}).onDelete("cascade"),
	unique("task_dependencies_predecessor_id_successor_id_key").on(table.predecessorId, table.successorId),
	check("task_dependencies_dependency_type_check", sql`dependency_type = ANY (ARRAY['FS'::text, 'FF'::text, 'SS'::text, 'SF'::text])`),
]);

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	uploadedBy: uuid("uploaded_by"),
	folder: text().notNull(),
	fileName: text("file_name").notNull(),
	fileUrl: text("file_url").notNull(),
	fileType: text("file_type"),
	fileSize: integer("file_size"),
	version: integer().default(1),
	description: text(),
	approvalStatus: text("approval_status").default("pending").notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_docs_folder").using("btree", table.projectId.asc().nullsLast().op("text_ops"), table.folder.asc().nullsLast().op("uuid_ops")),
	index("idx_docs_project").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_docs_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "documents_project_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.uploadedBy],
		foreignColumns: [users.id],
		name: "documents_uploaded_by_fkey"
	}),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "documents_workspace_id_fkey"
	}).onDelete("cascade"),
]);

export const scheduleVersions = pgTable("schedule_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	versionNumber: integer("version_number").notNull(),
	scheduleJson: jsonb("schedule_json").notNull(),
	aiReasoning: text("ai_reasoning"),
	aiRisks: jsonb("ai_risks"),
	isBaseline: boolean("is_baseline").default(false),
	isLocked: boolean("is_locked").default(false),
	generatedBy: text("generated_by").default('ai').notNull(),
	uploadedBy: text("uploaded_by"),
	sourceFileName: text("source_file_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_sv_project").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_sv_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "schedule_versions_project_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "schedule_versions_workspace_id_fkey"
	}).onDelete("cascade"),
	unique("schedule_versions_project_id_version_number_key").on(table.projectId, table.versionNumber),
	check("schedule_versions_generated_by_check", sql`generated_by = ANY (ARRAY['ai'::text, 'manual'::text, 'import'::text])`),
]);

export const reports = pgTable("reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	type: text().notNull(),
	reportDate: date("report_date").notNull(),
	aiSummary: text("ai_summary"),
	aiRecommendations: text("ai_recommendations"),
	metricsJson: jsonb("metrics_json"),
	pdfUrl: text("pdf_url"),
	emailedTo: text("emailed_to").array(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_reports_project").using("btree", table.projectId.asc().nullsLast().op("date_ops"), table.reportDate.asc().nullsLast().op("date_ops")),
	index("idx_reports_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.projectId],
		foreignColumns: [projects.id],
		name: "reports_project_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "reports_workspace_id_fkey"
	}).onDelete("cascade"),
	check("reports_type_check", sql`type = ANY (ARRAY['daily'::text, 'weekly'::text])`),
]);

export const session = pgTable("session", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("session_token_key").on(table.token),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "session_user_id_fkey",
	}).onDelete("cascade"),
]);

export const account = pgTable("account", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "account_user_id_fkey",
	}).onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const gapCheckFeedback = pgTable("gap_check_feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	scheduleVersionId: uuid("schedule_version_id").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	projectId: uuid("project_id").notNull(),
	taskName: text("task_name").notNull(),
	phase: text().notNull(),
	reason: text(),
	action: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_gcf_schedule_version").using("btree", table.scheduleVersionId.asc().nullsLast().op("uuid_ops")),
	index("idx_gcf_workspace").using("btree", table.workspaceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.scheduleVersionId],
		foreignColumns: [scheduleVersions.id],
		name: "gap_check_feedback_schedule_version_id_fkey",
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.workspaceId],
		foreignColumns: [orgs.id],
		name: "gap_check_feedback_workspace_id_fkey",
	}).onDelete("cascade"),
	check("gap_check_feedback_action_check", sql`action = ANY (ARRAY['accepted'::text, 'dismissed'::text])`),
]);

export const demoRequests = pgTable("demo_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text(),
	email: text().notNull(),
	phone: text(),
	companyName: text("company_name").notNull(),
	companySize: text("company_size"),
	role: text(),
	message: text(),
	source: text().default("website"),
	status: text().default("pending").notNull(),
	emailSent: boolean("email_sent").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, () => [
	check("demo_requests_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);