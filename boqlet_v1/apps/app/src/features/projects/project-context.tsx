"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Schemas } from "@ifc-boq/api";
import { useProject } from "@/api/hooks/projects";
import { can } from "@/lib/permissions";

export type ProjectPermission =
  | "view"
  | "edit"
  | "archive"
  | "manageMembers"
  | "editModels"
  | "editBoqs"
  | "answerQuestions"
  | "editLines"
  | "editPresets"
  | "saveVersion"
  | "approve"
  | "confirm"
  | "reopen"
  | "share"
  | "revokeShares"
  | "seeAudit";

export interface ProjectScope {
  project: Schemas["Project"];
  can: (permission: ProjectPermission) => boolean;
}

const ProjectContext = createContext<ProjectScope | null>(null);

/** Loads the project once for every page under it; 404 goes to the error boundary (not found). */
export function ProjectProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const project = useProject(projectId);
  if (!project.data) return <div className="min-h-40" aria-busy="true" />;
  const scope: ProjectScope = { project: project.data, can: (p) => can(project.data.permissions, p) };
  return <ProjectContext.Provider value={scope}>{children}</ProjectContext.Provider>;
}

export function useProjectScope(): ProjectScope {
  const scope = useContext(ProjectContext);
  if (!scope) throw new Error("useProjectScope outside a project route");
  return scope;
}
