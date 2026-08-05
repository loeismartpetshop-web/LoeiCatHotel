let liffInitialization: Promise<typeof import("@line/liff").default> | null = null;

async function getLiff() {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  if (!liffId) return null;

  if (!liffInitialization) {
    liffInitialization = import("@line/liff").then(async ({ default: liff }) => {
      await liff.init({ liffId });
      return liff;
    });
  }

  return liffInitialization;
}

export async function getLineIdToken(): Promise<string | null> {
  const liff = await getLiff();
  if (!liff || !liff.isLoggedIn()) return null;
  return liff.getIDToken();
}
