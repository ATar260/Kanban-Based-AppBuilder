export const isAuthConfigured = () => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  }
  return !!(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.NEXTAUTH_SECRET
  );
};
