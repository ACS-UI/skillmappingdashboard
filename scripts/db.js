export async function getUser() {
  const user = await window.adobeIMS.getProfile();
  return {
    email: user?.email ?? "",
    ldap: "robinvarshn" ?? "",
    name: user?.displayName ?? "",
  }
}
