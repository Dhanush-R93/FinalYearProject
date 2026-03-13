import { useState } from "react";

export function useUserRole() {
  // user_roles table not implemented yet — default to non-admin
  return { isAdmin: false, isLoading: false };
}
