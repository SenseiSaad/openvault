"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, GitBranch, Plus } from "lucide-react";
import { platformApi, type PlatformCourse, type CourseVersion } from "@/features/platform/api";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, useListParams } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/utils";

/**
 * Catalog management: courses, draft versions and the publishing workflow.
 * INTEGRATION-UNVERIFIED (IB-5): course/version endpoints must be verified.
 * The publishing workflow deliberately requires confirmation and shows the
 * draft → published transition via StatusBadge.
 */
export default function PlatformCatalogPage() {
  const listParams = useListParams();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<PlatformCourse | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [publishTarget, setPublishTarget] = useState<CourseVersion | null>(null);

  const courses = useQuery({
    queryKey: ["platform", "courses", listParams],
    queryFn: () => platformApi.courses({ ...listParams })
  });

  const versions = useQuery({
    queryKey: ["platform", "courses", selectedCourse?.uuid, "versions"],
    queryFn: () => platformApi.versions(selectedCourse!.uuid),
    enabled: Boolean(selectedCourse)
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform", "courses"] });
  };

  const createVersion = useMutation({
    mutationFn: () => platformApi.createVersion(selectedCourse!.uuid, { version_label: versionLabel }),
    onSuccess: async () => {
      toast.success("Draft version created.");
      setCreateOpen(false);
      setVersionLabel("");
      invalidate();
      await queryClient.invalidateQueries({ queryKey: ["platform", "courses", selectedCourse?.uuid, "versions"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The version could not be created.")
  });

  const publish = useMutation({
    mutationFn: (versionUuid: string) => platformApi.publishVersion(versionUuid),
    onSuccess: async () => {
      toast.success("Version published. It is now live for new enrollments.");
      setPublishTarget(null);
      invalidate();
      await queryClient.invalidateQueries({ queryKey: ["platform", "courses", selectedCourse?.uuid, "versions"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The version could not be published.")
  });

  return (
    <div>
      <PageHeader
        title="Courses & versions"
        description="Manage courses, draft new versions and control the publishing workflow."
      />

      <DataTable<PlatformCourse>
        data={courses.data}
        isLoading={courses.isPending}
        error={courses.error instanceof Error ? courses.error : null}
        caption="Course catalog"
        rowKey={(course) => course.uuid}
        emptyTitle="No courses yet"
        emptyDescription="Courses and their versions appear here once the catalog endpoints are connected (IB-5)."
        searchable
        searchPlaceholder="Search courses"
        onRowClick={(course) => setSelectedCourse(course)}
        columns={[
          { id: "title", header: "Course", render: (course) => <span className="font-medium">{course.title}</span> },
          { id: "status", header: "Status", render: (course) => <StatusBadge status={course.status} /> },
          { id: "version", header: "Current version", render: (course) => course.current_version ?? "—" },
          { id: "updated", header: "Updated", render: (course) => formatDate(course.updated_at) }
        ]}
      />

      {selectedCourse && (
        <section aria-labelledby="versions-heading" className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="versions-heading" className="flex items-center gap-2 text-lg font-semibold">
              <GitBranch aria-hidden="true" className="h-5 w-5 text-primary" />
              Versions — {selectedCourse.title}
            </h2>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" className="h-4 w-4" /> New draft version
            </Button>
          </div>

          {versions.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : versions.isError ? (
            <EmptyState title="Versions unavailable" description="Version history could not be loaded for this course." />
          ) : (versions.data?.items ?? []).length === 0 ? (
            <EmptyState icon={BookOpen} title="No versions yet" description="Create the first draft version to start authoring." />
          ) : (
            <div className="rounded-lg border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">Course versions for {selectedCourse.title}</caption>
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5">Version</th>
                    <th scope="col" className="px-4 py-2.5">Status</th>
                    <th scope="col" className="px-4 py-2.5">Created</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(versions.data?.items ?? []).map((version) => (
                    <tr key={version.uuid} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{version.version_label}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={version.status} />
                      </td>
                      <td className="px-4 py-3">{formatDate(version.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {version.status !== "published" && (
                          <Button size="sm" variant="outline" onClick={() => setPublishTarget(version)}>
                            Publish
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create draft version</DialogTitle>
            <DialogDescription>Version labels usually follow the course code convention, e.g. “2024.1”.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="version-label">Version label</Label>
            <Input id="version-label" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!versionLabel.trim() || createVersion.isPending} onClick={() => createVersion.mutate()}>
              {createVersion.isPending ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(publishTarget)}
        onOpenChange={(open) => !open && setPublishTarget(null)}
        title={`Publish version ${publishTarget?.version_label ?? ""}?`}
        description="Publishing makes this version the live version for new enrollments across all agencies. This cannot be undone from the interface."
        confirmLabel="Publish version"
        loading={publish.isPending}
        onConfirm={() => publishTarget && publish.mutateAsync(publishTarget.uuid)}
      />
    </div>
  );
}
