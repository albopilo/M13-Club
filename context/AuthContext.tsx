import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { Session, User } from "@supabase/supabase-js";

import { supabase, Member } from "@/lib/supabase";

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
   * been checked yet.
   */
  termsAccepted: boolean | null;

  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null }>;

  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;

  signOut: () => Promise<void>;

  refreshMember: () => Promise<void>;

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

const AuthContext = createContext<AuthContextType>({
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
   */
  const checkTermsAcceptance = async (
    userId: string
  ): Promise<{
    accepted: boolean;
    error: string | null;
  }> => {
    try {
      const accepted =
        await hasAcceptedCurrentTerms(userId);

      setTermsAccepted(accepted);

      return {
        accepted,
        error: null,
      };
    } catch (e) {
      console.error(
        "Terms acceptance check failed:",
        e
      );

      setTermsAccepted(null);

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
   * Public method for re-checking legal acceptance.
   *
   * This is useful immediately after the user accepts
   * the Terms & Conditions and Privacy Policy.
   */
  const refreshTermsAcceptance = async (): Promise<{
    accepted: boolean;
    error: string | null;
  }> => {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error(
        "Unable to retrieve current user:",
        error
      );

      setTermsAccepted(null);

      return {
        accepted: false,
        error: error.message,
      };
    }

    if (!currentUser) {
      setTermsAccepted(false);

      return {
        accepted: false,
        error: "Unable to retrieve account information.",
      };
    }

    return checkTermsAcceptance(
      currentUser.id
    );
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

      setMember(null);

      return null;
    }

    if (!data) {
      console.error(
        "No member record found"
      );

      setMember(null);

      return null;
    }

    console.log(
      "Member Loaded:",
      data
    );

    const memberRecord =
      data as Member;

    setMember(memberRecord);

    return memberRecord;
  };

  /**
   * Validate currently authenticated user.
   *
   * This is used after Google OAuth and can also be
   * used whenever we need to re-check account status.
   */
  const validateCurrentUser =
    async (): Promise<{
      error: string | null;
    }> => {
      const {
        data: {
          user: currentUser,
        },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        setSession(null);
        setUser(null);
        setMember(null);
        setTermsAccepted(false);

        return {
          error:
            "Unable to retrieve account information.",
        };
      }

      const memberRecord =
        await fetchMember(
          currentUser.id
        );

      const statusError =
        validateMemberStatus(
          memberRecord
        );

      if (statusError) {
        console.log(
          "Account validation failed:",
          statusError
        );

        await supabase.auth.signOut();

        setSession(null);
        setUser(null);
        setMember(null);
        setTermsAccepted(false);

        return {
          error: statusError,
        };
      }

      const {
        data: {
          session: currentSession,
        },
      } = await supabase.auth.getSession();

      setSession(currentSession);
      setUser(currentUser);
      setMember(memberRecord);

      const termsResult =
        await checkTermsAcceptance(
          currentUser.id
        );

      if (termsResult.error) {
        return {
          error:
            "Unable to verify legal acceptance.",
        };
      }

      return {
        error: null,
      };
    };

  /**
   * Initial authentication state.
   */
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setLoading(true);

        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        console.log(
          "Initial Session:",
          session
        );

        if (!mounted) {
          return;
        }

        if (!session?.user) {
          setSession(null);
          setUser(null);
          setMember(null);
          setTermsAccepted(false);

          return;
        }

        const memberRecord =
          await fetchMember(
            session.user.id
          );

        if (!mounted) {
          return;
        }

        const statusError =
          validateMemberStatus(
            memberRecord
          );

        if (statusError) {
          console.log(
            "Stored session rejected:",
            statusError
          );

          await supabase.auth.signOut();

          if (!mounted) {
            return;
          }

          setSession(null);
          setUser(null);
          setMember(null);
          setTermsAccepted(false);

          return;
        }

        if (!mounted) {
          return;
        }

        setSession(session);
        setUser(session.user);
        setMember(memberRecord);

        /**
         * Check legal acceptance separately
         * from authentication.
         */
        const termsResult =
          await checkTermsAcceptance(
            session.user.id
          );

        if (!mounted) {
          return;
        }

        if (termsResult.error) {
          console.error(
            "Initial terms acceptance check failed:",
            termsResult.error
          );

          /**
           * Keep the authenticated session.
           *
           * The UI can decide whether to retry the
           * legal check instead of incorrectly assuming
           * that the user accepted the documents.
           */
          setTermsAccepted(null);
        }
      } catch (e) {
        console.error(
          "Authentication initialization error:",
          e
        );

        if (mounted) {
          setSession(null);
          setUser(null);
          setMember(null);
          setTermsAccepted(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    /**
     * Listen for authentication events.
     */
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          session
        ) => {
          console.log(
            "AUTH EVENT:",
            _event
          );

          console.log(
            "AUTH SESSION:",
            session
          );

          if (!session?.user) {
            setSession(null);
            setUser(null);
            setMember(null);
            setTermsAccepted(false);
            setLoading(false);

            return;
          }

          /*
           * Important:
           *
           * Do NOT automatically trust the session.
           * Check the member status first.
           */
          const memberRecord =
            await fetchMember(
              session.user.id
            );

          const statusError =
            validateMemberStatus(
              memberRecord
            );

          if (statusError) {
            console.log(
              "Auth event rejected:",
              statusError
            );

            await supabase.auth.signOut();

            setSession(null);
            setUser(null);
            setMember(null);
            setTermsAccepted(false);
            setLoading(false);

            return;
          }

          setSession(session);
          setUser(session.user);
          setMember(memberRecord);

          /**
           * Authentication and legal acceptance
           * are intentionally separate.
           *
           * A valid authenticated user may still need
           * to accept the current legal version.
           */
          const termsResult =
            await checkTermsAcceptance(
              session.user.id
            );

          if (termsResult.error) {
            console.error(
              "Auth event terms check failed:",
              termsResult.error
            );

            setTermsAccepted(null);
          }

          setLoading(false);
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Registration.
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
            full_name: fullName,
          },
        },
      });

    if (error) {
      return {
        error: error.message,
      };
    }

    /**
     * Supabase may require email confirmation.
     *
     * If a session exists immediately, the user is
     * authenticated and can proceed to the legal
     * acceptance flow.
     *
     * If no session exists, the application should
     * wait for email confirmation before continuing.
     */
    if (data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);

      const memberRecord =
        await fetchMember(
          data.session.user.id
        );

      const statusError =
        validateMemberStatus(
          memberRecord
        );

      if (statusError) {
        await supabase.auth.signOut();

        setSession(null);
        setUser(null);
        setMember(null);
        setTermsAccepted(false);

        return {
          error: statusError,
        };
      }

      const termsResult =
        await checkTermsAcceptance(
          data.session.user.id
        );

      if (termsResult.error) {
        return {
          error:
            "Account created, but we could not verify the legal acceptance status.",
        };
      }
    }

    return {
      error: null,
    };
  };

  /**
   * Email/password login.
   */
  const signIn = async (
    email: string,
    password: string
  ) => {
    const {
      data,
      error,
    } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      return {
        error: error.message,
      };
    }

    const authenticatedUser =
      data.user;

    if (!authenticatedUser) {
      await supabase.auth.signOut();

      return {
        error:
          "Unable to retrieve account information.",
      };
    }

    /**
     * Immediately check member status.
     */
    const {
      data: memberData,
      error: memberError,
    } =
      await supabase
        .from("members")
        .select("*")
        .eq(
          "user_id",
          authenticatedUser.id
        )
        .maybeSingle();

    if (memberError) {
      console.error(
        "Member status check failed:",
        memberError
      );

      await supabase.auth.signOut();

      setSession(null);
      setUser(null);
      setMember(null);
      setTermsAccepted(false);

      return {
        error:
          "Unable to verify account status.",
      };
    }

    const memberRecord =
      memberData as Member | null;

    const statusError =
      validateMemberStatus(
        memberRecord
      );

    if (statusError) {
      await supabase.auth.signOut();

      setSession(null);
      setUser(null);
      setMember(null);
      setTermsAccepted(false);

      return {
        error: statusError,
      };
    }

    setSession(data.session);
    setUser(authenticatedUser);
    setMember(memberRecord);

    /**
     * Check the current legal versions.
     *
     * IMPORTANT:
     *
     * Not accepting the current terms is NOT
     * an authentication failure.
     *
     * The user remains authenticated and is sent
     * to the legal acceptance screen by the app
     * navigation layer.
     */
    const termsResult =
      await checkTermsAcceptance(
        authenticatedUser.id
      );

    if (termsResult.error) {
      return {
        error:
          "Unable to verify legal acceptance.",
      };
    }

    return {
      error: null,
    };
  };

  /**
   * Logout.
   */
  const signOut = async () => {
    await supabase.auth.signOut();

    setSession(null);
    setUser(null);
    setMember(null);
    setTermsAccepted(false);
  };

  /**
   * Refresh member.
   */
  const refreshMember = async () => {
    if (!user) {
      return;
    }

    const memberRecord =
      await fetchMember(
        user.id
      );

    const statusError =
      validateMemberStatus(
        memberRecord
      );

    if (statusError) {
      await supabase.auth.signOut();

      setSession(null);
      setUser(null);
      setMember(null);
      setTermsAccepted(false);

      return;
    }

    /**
     * Member is still valid.
     *
     * Also refresh legal acceptance because the
     * current legal version may have changed while
     * the user was logged in.
     */
    const termsResult =
      await checkTermsAcceptance(
        user.id
      );

    if (termsResult.error) {
      console.error(
        "Unable to refresh terms acceptance:",
        termsResult.error
      );
    }
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