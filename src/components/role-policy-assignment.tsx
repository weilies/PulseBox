"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { assignPolicyToRole, removePolicyFromRole } from "@/app/actions/roles";

interface Policy {
  id: string;
  name: string;
  isSystem: boolean;
}

interface RolePolicyAssignmentProps {
  roleId: string;
  allPolicies: Policy[];
  assignedPolicyIds: string[];
  isSystemRole: boolean;
}

export function RolePolicyAssignment({
  roleId,
  allPolicies,
  assignedPolicyIds,
  isSystemRole,
}: RolePolicyAssignmentProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");

  const assignedSet = new Set(assignedPolicyIds);
  const assignedPolicies = allPolicies.filter((p) => assignedSet.has(p.id));
  const unassignedPolicies = allPolicies.filter((p) => !assignedSet.has(p.id));

  async function handleAssign() {
    if (!selectedPolicy) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("role_id", roleId);
    fd.set("policy_id", selectedPolicy);
    const result = await assignPolicyToRole(fd);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Policy assigned");
    setSelectedPolicy("");
    router.refresh();
  }

  async function handleRemove(policyId: string) {
    setLoading(true);
    const fd = new FormData();
    fd.set("role_id", roleId);
    fd.set("policy_id", policyId);
    const result = await removePolicyFromRole(fd);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Policy removed");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Currently assigned */}
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {assignedPolicies.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No policies assigned.</p>
        ) : (
          assignedPolicies.map((p) => (
            <Badge
              key={p.id}
              variant="outline"
              className="border-blue-500/40 text-blue-600 flex items-center gap-1.5 pr-1"
            >
              {p.name}
              {!isSystemRole && (
                <button
                  onClick={() => handleRemove(p.id)}
                  disabled={loading}
                  className="hover:text-red-400 transition-colors ml-1"
                  title="Remove policy"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))
        )}
      </div>

      {/* Add policy */}
      {!isSystemRole && unassignedPolicies.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedPolicy} onValueChange={(v) => setSelectedPolicy(v ?? "")}>
            <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 flex-1">
              <SelectValue placeholder="Select a policy to add..." />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300 text-gray-900">
              {unassignedPolicies.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAssign}
            disabled={loading || !selectedPolicy}
            className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}

      {isSystemRole && (
        <p className="text-xs text-gray-500 italic">System role — policies cannot be changed.</p>
      )}
    </div>
  );
}
