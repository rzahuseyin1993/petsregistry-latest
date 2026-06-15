/** Highest membership tier — users on this plan cannot upgrade further. */
export const TOP_MEMBERSHIP_PLAN_TYPE = "partner";

const PLAN_TIER_RANK: Record<string, number> = {
  guardian: 1,
  partner: 2,
};

export function getMembershipTierRank(planType: string | null | undefined): number {
  if (!planType) return 0;
  return PLAN_TIER_RANK[planType.toLowerCase()] ?? 0;
}

/** Show upgrade CTA only when user has a membership below the top tier. */
export function canUpgradeMembership(activePlanTypes: string[]): boolean {
  if (activePlanTypes.length === 0) return false;
  const maxTier = Math.max(...activePlanTypes.map(getMembershipTierRank));
  return maxTier > 0 && maxTier < getMembershipTierRank(TOP_MEMBERSHIP_PLAN_TYPE);
}

export function pickPrimaryMembershipPlanType(activePlanTypes: string[]): string | null {
  if (activePlanTypes.length === 0) return null;
  return activePlanTypes.reduce((best, current) =>
    getMembershipTierRank(current) > getMembershipTierRank(best) ? current : best,
  );
}
