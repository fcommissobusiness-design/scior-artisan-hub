import { createFileRoute } from "@tanstack/react-router";
import { TeamManagement } from "@/components/TeamManagement";

export const Route = createFileRoute("/admin/collaboratori")({
  component: () => <TeamManagement />,
});
