import type { ReactNode } from "react";
import { ProjectHeader } from "@/features/projects/project-header";
import { ProjectProvider } from "@/features/projects/project-context";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ org: string; projectId: string }> }) {
  const { org, projectId } = await params;
  return (
    <ProjectProvider projectId={projectId}>
      <div className="flex flex-col gap-6">
        <ProjectHeader org={org} />
        {children}
      </div>
    </ProjectProvider>
  );
}
