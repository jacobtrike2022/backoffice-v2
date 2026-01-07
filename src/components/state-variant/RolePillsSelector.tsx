// ============================================================================
// ROLE PILLS SELECTOR
// ============================================================================
// Displays organization roles as pill-tags for user selection
// - Preselected top matches have orange gradient fill
// - Deselected pills have transparent bg with orange border + text
// ============================================================================

import React from 'react';
import { Users, Check } from 'lucide-react';
import type { LearnerRole, OrgRoleMatch, ScopeContract } from '../../lib/crud/trackRelationships';

interface RolePillsSelectorProps {
  roles: OrgRoleMatch[];
  selectedRoles: LearnerRole[];
  onToggle: (role: LearnerRole) => void;
  scopeContract?: ScopeContract;
}

const roleLabels: Record<LearnerRole, string> = {
  frontline_store_associate: 'Frontline Store Associate',
  manager_supervisor: 'Manager/Supervisor',
  delivery_driver: 'Delivery Driver',
  owner_executive: 'Owner/Executive',
  back_office_admin: 'Back Office Admin',
  other: 'Other',
};

export function RolePillsSelector({
  roles,
  selectedRoles,
  onToggle,
  scopeContract,
}: RolePillsSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Who is this content for?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select the roles that should see this state-specific variant.
            We've pre-selected the most relevant roles based on the content.
          </p>
        </div>
      </div>

      {/* Role pills */}
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => {
          const isSelected = selectedRoles.includes(role.roleName as LearnerRole);

          return (
            <button
              key={role.roleId}
              onClick={() => onToggle(role.roleName as LearnerRole)}
              className={`
                relative group flex items-center gap-2 px-4 py-2 rounded-full border-2
                font-medium text-sm transition-all duration-200
                ${isSelected
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-transparent border-orange-500 text-orange-500 hover:bg-orange-500/10'}
              `}
            >
              {isSelected && (
                <Check className="w-4 h-4" />
              )}
              <span>{role.roleName}</span>
              {role.score >= 0.8 && (
                <span className={`
                  text-xs px-1.5 py-0.5 rounded-full
                  ${isSelected ? 'bg-white/20' : 'bg-orange-500/10'}
                `}>
                  Top match
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Show why these roles were matched */}
      {roles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Why these roles?</p>
          <div className="grid gap-2">
            {roles.filter(r => selectedRoles.includes(r.roleName as LearnerRole)).slice(0, 3).map((role) => (
              <div
                key={role.roleId}
                className="text-sm p-3 rounded-lg bg-muted/50 border border-border"
              >
                <span className="font-medium">{role.roleName}</span>
                <span className="mx-2 text-muted-foreground">—</span>
                <span className="text-muted-foreground">{role.why}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructional goal from scope contract */}
      {scopeContract?.instructionalGoal && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm font-medium text-primary mb-1">Learning Goal</p>
          <p className="text-sm text-muted-foreground">{scopeContract.instructionalGoal}</p>
        </div>
      )}

      {/* Domain anchors */}
      {scopeContract?.domainAnchors && scopeContract.domainAnchors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Key topics covered</p>
          <div className="flex flex-wrap gap-1.5">
            {scopeContract.domainAnchors.map((anchor, index) => (
              <span
                key={index}
                className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
              >
                {anchor}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RolePillsSelector;
