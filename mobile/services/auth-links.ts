export type AuthLinkInput = {
  code?: string;
  flow?: string;
  error?: string;
};

export type AuthLinkKind = "confirmation" | "recovery";

export type AuthLinkResult =
  | {
      status: "link-error";
      kind: AuthLinkKind;
      reason: "missing" | "invalid";
    }
  | { status: "profile-error"; kind: AuthLinkKind }
  | { status: "suspended"; kind: AuthLinkKind }
  | {
      status: "ready";
      kind: AuthLinkKind;
      destination: "/update-password" | "/admin/places" | "/home";
    };

type AuthLinkDependencies = {
  exchange(code: string): Promise<string>;
  readProfile(id: string): Promise<{
    role: "member" | "admin";
    status: "active" | "suspended";
  }>;
  signOut(): Promise<void>;
};

export function authLinkKind(flow?: string): AuthLinkKind {
  return flow === "recovery" ? "recovery" : "confirmation";
}

export function createAuthLinkHandler(deps: AuthLinkDependencies) {
  const exchanges = new Map<string, Promise<string>>();
  const resolutions = new Map<string, Promise<AuthLinkResult>>();

  async function resolve(
    code: string,
    kind: AuthLinkKind,
  ): Promise<AuthLinkResult> {
    let userId: string;
    try {
      let exchange = exchanges.get(code);
      if (!exchange) {
        exchange = Promise.resolve().then(() => deps.exchange(code));
        exchanges.set(code, exchange);
      }
      userId = await exchange;
    } catch {
      return { status: "link-error", kind, reason: "invalid" };
    }

    let profile: Awaited<ReturnType<AuthLinkDependencies["readProfile"]>>;
    try {
      profile = await deps.readProfile(userId);
    } catch {
      return { status: "profile-error", kind };
    }

    if (profile.status !== "active") {
      try {
        await deps.signOut();
      } catch {
        // A sign-out failure does not change the account's suspended status.
      }
      return { status: "suspended", kind };
    }

    return {
      status: "ready",
      kind,
      destination:
        kind === "recovery"
          ? "/update-password"
          : profile.role === "admin"
            ? "/admin/places"
            : "/home",
    };
  }

  return async function handleAuthLink(
    input: AuthLinkInput,
  ): Promise<AuthLinkResult> {
    const kind = authLinkKind(input.flow);
    if (input.error) return { status: "link-error", kind, reason: "invalid" };
    if (!input.code) return { status: "link-error", kind, reason: "missing" };

    const key = JSON.stringify([kind, input.code]);
    let resolution = resolutions.get(key);
    if (!resolution) {
      resolution = resolve(input.code, kind);
      resolutions.set(key, resolution);
    }

    const result = await resolution;
    if (result.status === "profile-error" && resolutions.get(key) === resolution) {
      // A retry loads the profile again while retaining the completed exchange.
      resolutions.delete(key);
    }
    return result;
  };
}
