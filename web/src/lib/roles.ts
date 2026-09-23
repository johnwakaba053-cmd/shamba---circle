// Shared farmer-facing labels for public.user_roles.role -- the same three
// values get_public_profile()/search_public_profiles() already return
// (farmer/buyer/seller). Kept in one place so the owner's own profile
// header and the public profile page never drift apart on wording.
export const ROLE_LABELS: Record<string, string> = {
  farmer: "Farmer",
  buyer: "Buyer",
  seller: "Seller",
};
