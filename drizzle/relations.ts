import { relations } from "drizzle-orm/relations";
import { users, workspaceMembers, orgs, tasks, whatsappUpdates, projects, auditEvents, dprs, dprPhotos, shareTokens, projectMembers, taskDependencies, documents, scheduleVersions, reports } from "./schema";

export const workspaceMembersRelations = relations(workspaceMembers, ({one}) => ({
	user: one(users, {
		fields: [workspaceMembers.userId],
		references: [users.id]
	}),
	org: one(orgs, {
		fields: [workspaceMembers.workspaceId],
		references: [orgs.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	workspaceMembers: many(workspaceMembers),
	whatsappUpdates: many(whatsappUpdates),
	auditEvents: many(auditEvents),
	dprs: many(dprs),
	projects: many(projects),
	shareTokens: many(shareTokens),
	projectMembers: many(projectMembers),
	tasks: many(tasks),
	documents: many(documents),
}));

export const orgsRelations = relations(orgs, ({many}) => ({
	workspaceMembers: many(workspaceMembers),
	whatsappUpdates: many(whatsappUpdates),
	auditEvents: many(auditEvents),
	dprs: many(dprs),
	dprPhotos: many(dprPhotos),
	projects: many(projects),
	shareTokens: many(shareTokens),
	projectMembers: many(projectMembers),
	tasks: many(tasks),
	taskDependencies: many(taskDependencies),
	documents: many(documents),
	scheduleVersions: many(scheduleVersions),
	reports: many(reports),
}));

export const whatsappUpdatesRelations = relations(whatsappUpdates, ({one, many}) => ({
	task: one(tasks, {
		fields: [whatsappUpdates.matchedTaskId],
		references: [tasks.id]
	}),
	project: one(projects, {
		fields: [whatsappUpdates.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [whatsappUpdates.senderUserId],
		references: [users.id]
	}),
	org: one(orgs, {
		fields: [whatsappUpdates.workspaceId],
		references: [orgs.id]
	}),
	dprs: many(dprs),
}));

export const tasksRelations = relations(tasks, ({one, many}) => ({
	whatsappUpdates: many(whatsappUpdates),
	dprs: many(dprs),
	user: one(users, {
		fields: [tasks.assignedTo],
		references: [users.id]
	}),
	task: one(tasks, {
		fields: [tasks.parentTaskId],
		references: [tasks.id],
		relationName: "tasks_parentTaskId_tasks_id"
	}),
	tasks: many(tasks, {
		relationName: "tasks_parentTaskId_tasks_id"
	}),
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.id]
	}),
	org: one(orgs, {
		fields: [tasks.workspaceId],
		references: [orgs.id]
	}),
	taskDependencies_predecessorId: many(taskDependencies, {
		relationName: "taskDependencies_predecessorId_tasks_id"
	}),
	taskDependencies_successorId: many(taskDependencies, {
		relationName: "taskDependencies_successorId_tasks_id"
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	whatsappUpdates: many(whatsappUpdates),
	auditEvents: many(auditEvents),
	dprs: many(dprs),
	dprPhotos: many(dprPhotos),
	user: one(users, {
		fields: [projects.createdBy],
		references: [users.id]
	}),
	org: one(orgs, {
		fields: [projects.workspaceId],
		references: [orgs.id]
	}),
	shareTokens: many(shareTokens),
	projectMembers: many(projectMembers),
	tasks: many(tasks),
	documents: many(documents),
	scheduleVersions: many(scheduleVersions),
	reports: many(reports),
}));

export const auditEventsRelations = relations(auditEvents, ({one}) => ({
	user: one(users, {
		fields: [auditEvents.actorId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [auditEvents.projectId],
		references: [projects.id]
	}),
	org: one(orgs, {
		fields: [auditEvents.workspaceId],
		references: [orgs.id]
	}),
}));

export const dprsRelations = relations(dprs, ({one, many}) => ({
	project: one(projects, {
		fields: [dprs.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [dprs.reportedBy],
		references: [users.id]
	}),
	task: one(tasks, {
		fields: [dprs.taskId],
		references: [tasks.id]
	}),
	whatsappUpdate: one(whatsappUpdates, {
		fields: [dprs.whatsappUpdateId],
		references: [whatsappUpdates.id]
	}),
	org: one(orgs, {
		fields: [dprs.workspaceId],
		references: [orgs.id]
	}),
	dprPhotos: many(dprPhotos),
}));

export const dprPhotosRelations = relations(dprPhotos, ({one}) => ({
	dpr: one(dprs, {
		fields: [dprPhotos.dprId],
		references: [dprs.id]
	}),
	project: one(projects, {
		fields: [dprPhotos.projectId],
		references: [projects.id]
	}),
	org: one(orgs, {
		fields: [dprPhotos.workspaceId],
		references: [orgs.id]
	}),
}));

export const shareTokensRelations = relations(shareTokens, ({one}) => ({
	user: one(users, {
		fields: [shareTokens.createdBy],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [shareTokens.projectId],
		references: [projects.id]
	}),
	org: one(orgs, {
		fields: [shareTokens.workspaceId],
		references: [orgs.id]
	}),
}));

export const projectMembersRelations = relations(projectMembers, ({one}) => ({
	project: one(projects, {
		fields: [projectMembers.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [projectMembers.userId],
		references: [users.id]
	}),
	org: one(orgs, {
		fields: [projectMembers.workspaceId],
		references: [orgs.id]
	}),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({one}) => ({
	task_predecessorId: one(tasks, {
		fields: [taskDependencies.predecessorId],
		references: [tasks.id],
		relationName: "taskDependencies_predecessorId_tasks_id"
	}),
	task_successorId: one(tasks, {
		fields: [taskDependencies.successorId],
		references: [tasks.id],
		relationName: "taskDependencies_successorId_tasks_id"
	}),
	org: one(orgs, {
		fields: [taskDependencies.workspaceId],
		references: [orgs.id]
	}),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	project: one(projects, {
		fields: [documents.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [documents.uploadedBy],
		references: [users.id]
	}),
	org: one(orgs, {
		fields: [documents.workspaceId],
		references: [orgs.id]
	}),
}));

export const scheduleVersionsRelations = relations(scheduleVersions, ({one}) => ({
	project: one(projects, {
		fields: [scheduleVersions.projectId],
		references: [projects.id]
	}),
	org: one(orgs, {
		fields: [scheduleVersions.workspaceId],
		references: [orgs.id]
	}),
}));

export const reportsRelations = relations(reports, ({one}) => ({
	project: one(projects, {
		fields: [reports.projectId],
		references: [projects.id]
	}),
	org: one(orgs, {
		fields: [reports.workspaceId],
		references: [orgs.id]
	}),
}));