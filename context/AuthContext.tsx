import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

import {
  Session,
  User,
  AuthChangeEvent,
} from "@supabase/supabase-js";

import {
  supabase,
  Member,
} from "@/lib/supabase";

import {
  hasAcceptedCurrentTerms,
} from "@/lib/terms";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  member: Member | null;
  loading: boolean;

  /**
   * Whether the authenticated user has accepted
   * the currently active Terms & Conditions and
   * Privacy Policy versions.
   *
   * null means the acceptance status has not
   * been successfully checked yet.
   */
  termsAccepted: boolean | null;

  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{
    error: string | null;
  }>;

  signIn: (
    email: string,
    password: string
  ) => Promise<{
    error: string | null;
  }>;

  signOut: () => Promise<void>;

  refreshMember: () => Promise<void>;

  /**
   * Explicitly validates the currently authenticated
   * Supabase user, member record, member status,
   * and current legal acceptance.
   */
  validateCurrentUser: () => Promise<{
    error: string | null;
  }>;

  /**
   * Re-check the current Terms & Conditions /
   * Privacy Policy acceptance status.
   */
  refreshTermsAcceptance: () => Promise<{
    accepted: boolean;
    error: string | null;
  }>;
}

const AuthContext =
  createContext<AuthContextType>({
    session: null,
    user: null,
    member: null,
    loading: true,
    termsAccepted: null,

    signUp: async () => ({
      error: null,
    }),

    signIn: async () => ({
      error: null,
    }),

    signOut: async () => {},

    refreshMember: async () => {},

    validateCurrentUser: async () => ({
      error: null,
    }),

    refreshTermsAcceptance: async () => ({
      accepted: false,
      error: null,
    }),
  });

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [user, setUser] =
    useState<User | null>(null);

  const [member, setMember] =
    useState<Member | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [termsAccepted, setTermsAccepted] =
    useState<boolean | null>(null);

  /**
   * Prevent stale asynchronous authentication
   * operations from overwriting newer state.
   */
  const syncRequestRef =
    useRef(0);

  /**
   * Prevent state updates after the provider
   * has been unmounted.
   */
  const mountedRef =
    useRef(true);

  /**
   * Validate member status.
   */
  const validateMemberStatus = (
    memberData: Member | null
  ): string | null => {
    if (!memberData) {
      return "Member account not found.";
    }

    if (memberData.status === "banned") {
      return "Your account has been banned.";
    }

    if (memberData.status === "suspended") {
      return "Your account has been suspended.";
    }

    if (memberData.status !== "active") {
      return "Your account is not active.";
    }

    return null;
  };

  /**
   * Check whether the current user has accepted
   * the currently active legal document versions.
   *
   * IMPORTANT:
   *
   * This continues to use the existing
   * hasAcceptedCurrentTerms() implementation.
   *
   * We are NOT changing legal_consents,
   * RLS, or the existing terms helper here.
   */
  const checkTermsAcceptance = async (
    userId: string
  ): Promise<{
    accepted: boolean;
    error: string | null;
  }> => {
    try {
      console.log(
        "========== TERMS CHECK =========="
      );

      console.log(
        "Terms user ID:",
        userId
      );

      const accepted =
        await hasAcceptedCurrentTerms(
          userId
        );

      console.log(
        "Terms accepted result:",
        accepted
      );

      console.log(
        "================================"
      );

      if (mountedRef.current) {
        setTermsAccepted(
          accepted
        );
      }

      return {
        accepted,
        error: null,
      };
    } catch (e) {
      console.error(
        "Terms acceptance check failed:",
        e
      );

      if (mountedRef.current) {
        /**
         * IMPORTANT:
         *
         * A failed query is NOT the same thing
         * as "not accepted".
         *
         * Therefore use null, not false.
         */
        setTermsAccepted(null);
      }

      return {
        accepted: false,
        error:
          e instanceof Error
            ? e.message
            : "Unable to verify Terms & Conditions acceptance.",
      };
    }
  };

  /**
   * Fetch member record.
   */
  const fetchMember = async (
    userId: string
  ): Promise<Member | null> => {
    console.log(
      "Fetching member:",
      userId
    );

    const {
      data,
      error,
    } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "Member Fetch Error:",
        error
      );

      if (mountedRef.current) {
        setMember(null);
      }

      return null;
    }

    if (!data) {
      console.error(
        "No member record found"
      );

      if (mountedRef.current) {
        setMember(null);
      }

      return null;
    }

    console.log(
      "Member Loaded:",
      data
    );

    const memberRecord =
      data as Member;

    if (mountedRef.current) {
      setMember(
        memberRecord
      );
    }

    return memberRecord;
  };

  /**
   * Synchronize all authenticated application state.
   *
   * This function performs Supabase queries OUTSIDE
   * the onAuthStateChange callback.
   *
   * That is intentional.
   */
  const synchronizeAuthenticatedState =
    async (
      currentSession: Session | null
    ): Promise<{
      error: string | null;
    }> => {
      const requestId =
        ++syncRequestRef.current;

      /**
       * No authenticated session.
       */
      if (
        !currentSession ||
        !currentSession.user
      ) {
        if (
          mountedRef.current &&
          requestId ===
            syncRequestRef.current
        ) {
          setSession(null);
          setUser(null);
          setMember(null);
          setTermsAccepted(false);
          setLoading(false);
        }

        return {
          error: null,
        };
      }

      const currentUser =
        currentSession.user;

      /**
       * Make the authenticated state visible immediately.
       *
       * The member and legal checks happen below.
       */
      if (
        mountedRef.current &&
        requestId ===
          syncRequestRef.current
      ) {
        setSession(
          currentSession
        );

        setUser(
          currentUser
        );

        /**
         * We don't yet know the legal state.
         */
        setTermsAccepted(null);
      }

      /**
       * Fetch M13 member.
       */
      const memberRecord =
        await fetchMember(
          currentUser.id
        );

      /**
       * Ignore stale result.
       */
      if (
        !mountedRef.current ||
        requestId !==
          syncRequestRef.current
      ) {
        return {
          error: null,
        };
      }

      /**
       * Validate member.
       */
      const statusError =
        validateMemberStatus(
          memberRecord
        );

      if (statusError) {
        console.log(
          "Account validation failed:",
          statusError
        );

        /**
         * The session exists in Supabase,
         * but the M13 member account is not valid.
         *
         * Sign out to prevent access.
         */
        await supabase.auth.signOut();

        if (
          mountedRef.current &&
          requestId ===
            syncRequestRef.current
        ) {
          setSession(null);
          setUser(null);
          setMember(null);
          setTermsAccepted(false);
          setLoading(false);
        }

        return {
          error: statusError,
        };
      }

      /**
       * Store valid member.
       */
      setMember(
        memberRecord
      );

      /**
       * Check current Terms/Privacy acceptance.
       */
      const termsResult =
        await checkTermsAcceptance(
          currentUser.id
        );

      /**
       * Ignore stale result.
       */
      if (
        !mountedRef.current ||
        requestId !==
          syncRequestRef.current
      ) {
        return {
          error: null,
        };
      }

      /**
       * A legal-query failure is an error,
       * but it is NOT an authentication failure.
       */
      if (termsResult.error) {
        console.error(
          "Legal acceptance verification failed:",
          termsResult.error
        );

        setTermsAccepted(null);
      }

      setLoading(false);

      return {
        error:
          termsResult.error
            ? "Unable to verify legal acceptance."
            : null,
      };
    };

  /**
   * Public method for re-checking legal acceptance.
   */
  const refreshTermsAcceptance =
    async (): Promise<{
      accepted: boolean;
      error: string | null;
    }> => {
      const {
        data: {
          user: currentUser,
        },
        error,
      } =
        await supabase.auth.getUser();

      if (error) {
        console.error(
          "Unable to retrieve current user:",
          error
        );

        if (
          mountedRef.current
        ) {
          setTermsAccepted(null);
        }

        return {
          accepted: false,
          error: error.message,
        };
      }

      if (!currentUser) {
        if (
          mountedRef.current
        ) {
          setTermsAccepted(
            false
          );
        }

        return {
          accepted: false,
          error:
            "Unable to retrieve account information.",
        };
      }

      return checkTermsAcceptance(
        currentUser.id
      );
    };

  /**
   * Explicitly validate the current authenticated user.
   *
   * Used after native Google OAuth establishes a session.
   */
  const validateCurrentUser =
    async (): Promise<{
      error: string | null;
    }> => {
      const {
        data: {
          session:
            currentSession,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "Unable to retrieve current session:",
          sessionError
        );

        return {
          error:
            sessionError.message,
        };
      }

      if (
        !currentSession?.user
      ) {
        if (
          mountedRef.current
        ) {
          setSession(null);
          setUser(null);
          setMember(null);
          setTermsAccepted(false);
        }

        return {
          error:
            "Unable to retrieve account information.",
        };
      }

      return synchronizeAuthenticatedState(
        currentSession
      );
    };

  /**
   * Initial authentication state and
   * authentication event listener.
   *
   * IMPORTANT:
   *
   * The auth callback itself stays synchronous.
   *
   * We do NOT perform Supabase database/auth
   * queries directly inside onAuthStateChange.
   */
  useEffect(() => {
    mountedRef.current = true;

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          event: AuthChangeEvent,
          currentSession
        ) => {
          console.log(
            "AUTH EVENT:",
            event
          );

          console.log(
            "AUTH SESSION:",
            currentSession
          );

          /**
           * Signed out is handled immediately.
           */
          if (
            event ===
            "SIGNED_OUT"
          ) {
            ++syncRequestRef.current;

            if (
              mountedRef.current
            ) {
              setSession(null);
              setUser(null);
              setMember(null);
              setTermsAccepted(false);
              setLoading(false);
            }

            return;
          }

          /**
           * Update session/user immediately.
           *
           * Do NOT perform Supabase queries here.
           */
          if (
            mountedRef.current
          ) {
            setSession(
              currentSession
            );

            setUser(
              currentSession?.user ??
                null
            );

            /**
             * While the authenticated state is being
             * synchronized, legal status is unknown.
             */
            if (
              currentSession?.user
            ) {
              setTermsAccepted(
                null
              );
            } else {
              setTermsAccepted(
                false
              );
            }

            setLoading(true);
          }

          /**
           * Run the async synchronization AFTER the
           * auth callback has returned.
           *
           * setTimeout is intentional.
           *
           * Supabase currently warns that async Supabase
           * calls directly inside onAuthStateChange can
           * deadlock the client.
           */
          setTimeout(() => {
            void synchronizeAuthenticatedState(
              currentSession
            );
          }, 0);
        }
      );

    /**
     * Cleanup.
     */
    return () => {
      mountedRef.current = false;

      ++syncRequestRef.current;

      subscription.unsubscribe();
    };
  }, []);

  /**
   * Registration.
   *
   * Legal acceptance is NOT recorded here.
   *
   * The authenticated legal flow handles that.
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    const {
      data,
      error,
    } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name:
              fullName,
          },
        },
      });

    if (error) {
      return {
        error:
          error.message,
      };
    }

    /**
     * If Supabase immediately gives us a session,
     * synchronize the authenticated application state.
     *
     * If email confirmation is required and no session
     * is returned, we leave the user unauthenticated.
     */
    if (
      data.session?.user
    ) {
      await synchronizeAuthenticatedState(
        data.session
      );
    }

    return {
      error: null,
    };
  };

  /**
   * Email/password login.
   *
   * Authentication itself is handled by Supabase.
   *
   * Member/legal synchronization is handled by the
   * AuthContext auth-state listener.
   */
  const signIn = async (
    email: string,
    password: string
  ) => {
    const {
      error,
    } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      return {
        error:
          error.message,
      };
    }

    return {
      error: null,
    };
  };

  /**
   * Logout.
   */
  const signOut =
    async (): Promise<void> => {
      ++syncRequestRef.current;

      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "Sign out error:",
          error
        );
      }

      if (
        mountedRef.current
      ) {
        setSession(null);
        setUser(null);
        setMember(null);
        setTermsAccepted(false);
        setLoading(false);
      }
    };

  /**
   * Refresh member information.
   */
  const refreshMember =
    async (): Promise<void> => {
      if (!user) {
        return;
      }

      const memberRecord =
        await fetchMember(
          user.id
        );

      if (!mountedRef.current) {
        return;
      }

      const statusError =
        validateMemberStatus(
          memberRecord
        );

      if (statusError) {
        console.error(
          "Member refresh validation failed:",
          statusError
        );

        await signOut();

        return;
      }

      setMember(
        memberRecord
      );

      /**
       * Also refresh legal acceptance because
       * the active legal version could change.
       */
      await checkTermsAcceptance(
        user.id
      );
    };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        member,
        loading,
        termsAccepted,
        signUp,
        signIn,
        signOut,
        refreshMember,
        validateCurrentUser,
        refreshTermsAcceptance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(
    AuthContext
  );
}