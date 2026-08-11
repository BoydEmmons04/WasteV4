// Single fixed admin account, identified by email. Keep this in sync with
// the isAdmin() check in firestore.rules - rules can't import from here, so
// the string has to be duplicated in both places.
export const ADMIN_LOGIN_EMAIL = 'admin@cfawaste.internal';

// Reserved store code that triggers the admin login prompt instead of a
// normal store-code lookup. Never assignable as a real store's code (see
// RegisterPage and AdminScreen's reset-code validation).
export const RESERVED_ADMIN_CODE = '00000';

// While viewing a store "as" it from the admin panel, every Firestore call
// in lib/firestore.ts should target that store's uid instead of the
// signed-in admin's own uid. A plain module-level value (mirroring how
// firebase's own `auth.currentUser` is already read ambiently throughout
// the app) keeps every existing data-layer call site working unchanged.
let impersonatedUid: string | null = null;

export function setImpersonatedUid(uid: string | null) {
  impersonatedUid = uid;
}

export function getImpersonatedUid(): string | null {
  return impersonatedUid;
}
