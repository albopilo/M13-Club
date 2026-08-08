import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { Session, User } from "@supabase/supabase-js";
import { supabase, Member } from "@/lib/supabase";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  member: Member | null;
  loading: boolean;

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

  validateCurrentUser: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  member: null,
  loading: true,

  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  refreshMember: async () => {},
  validateCurrentUser: async () => ({ error: null }),
});

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Validate member status
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
   * Fetch member record
   */
  const fetchMember = async (
    userId: string
  ): Promise<Member | null> => {
    console.log("Fetching member:", userId);

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Member Fetch Error:", error);
      setMember(null);
      return null;
    }

    if (!data) {
      console.error("No member record found");
      setMember(null);
      return null;
    }

    console.log("Member Loaded:", data);

    const memberRecord = data as Member;

    setMember(memberRecord);

    return memberRecord;
  };

  /**
   * Validate currently authenticated user.
   *
   * This is used after Google OAuth and can also be
   * used whenever we need to re-check account status.
   */
  const validateCurrentUser = async (): Promise<{
    error: string | null;
  }> => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      setMember(null);

      return {
        error: "Unable to retrieve account information.",
      };
    }

    const memberRecord = await fetchMember(currentUser.id);

    const statusError =
      validateMemberStatus(memberRecord);

    if (statusError) {
      console.log(
        "Account validation failed:",
        statusError
      );

      await supabase.auth.signOut();

      setSession(null);
      setUser(null);
      setMember(null);

      return {
        error: statusError,
      };
    }

    setUser(currentUser);
    setMember(memberRecord);

    return {
      error: null,
    };
  };

  /**
   * Initial authentication state
   */
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log("Initial Session:", session);

        if (!mounted) return;

        if (!session?.user) {
          setSession(null);
          setUser(null);
          setMember(null);
          return;
        }

        const memberRecord = await fetchMember(
          session.user.id
        );

        const statusError =
          validateMemberStatus(memberRecord);

        if (statusError) {
          console.log(
            "Stored session rejected:",
            statusError
          );

          await supabase.auth.signOut();

          if (!mounted) return;

          setSession(null);
          setUser(null);
          setMember(null);

          return;
        }

        if (!mounted) return;

        setSession(session);
        setUser(session.user);
        setMember(memberRecord);

      } catch (e) {
        console.error(
          "Authentication initialization error:",
          e
        );

        if (mounted) {
          setSession(null);
          setUser(null);
          setMember(null);
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
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("AUTH EVENT:", _event);
        console.log("AUTH SESSION:", session);

        if (!session?.user) {
          setSession(null);
          setUser(null);
          setMember(null);
          setLoading(false);
          return;
        }

        /*
         * Important:
         * Do NOT automatically trust the session.
         * Check the member status first.
         */
        const memberRecord = await fetchMember(
          session.user.id
        );

        const statusError =
          validateMemberStatus(memberRecord);

        if (statusError) {
          console.log(
            "Auth event rejected:",
            statusError
          );

          await supabase.auth.signOut();

          setSession(null);
          setUser(null);
          setMember(null);
          setLoading(false);

          return;
        }

        setSession(session);
        setUser(session.user);
        setMember(memberRecord);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Registration
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    const { error } =
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

    return {
      error: null,
    };
  };

  /**
   * Email/password login
   */
  const signIn = async (
    email: string,
    password: string
  ) => {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      return {
        error: error.message,
      };
    }

    const authenticatedUser = data.user;

    if (!authenticatedUser) {
      await supabase.auth.signOut();

      return {
        error: "Unable to retrieve account information.",
      };
    }

    /**
     * Immediately check member status.
     */
    const { data: memberData, error: memberError } =
      await supabase
        .from("members")
        .select("*")
        .eq("user_id", authenticatedUser.id)
        .maybeSingle();

    if (memberError) {
      console.error(
        "Member status check failed:",
        memberError
      );

      await supabase.auth.signOut();

      return {
        error: "Unable to verify account status.",
      };
    }

    const memberRecord =
      memberData as Member | null;

    const statusError =
      validateMemberStatus(memberRecord);

    if (statusError) {
      await supabase.auth.signOut();

      return {
        error: statusError,
      };
    }

    setSession(data.session);
    setUser(authenticatedUser);
    setMember(memberRecord);

    return {
      error: null,
    };
  };

  /**
   * Logout
   */
  const signOut = async () => {
    await supabase.auth.signOut();

    setSession(null);
    setUser(null);
    setMember(null);
  };

  /**
   * Refresh member
   */
  const refreshMember = async () => {
    if (!user) return;

    const memberRecord =
      await fetchMember(user.id);

    const statusError =
      validateMemberStatus(memberRecord);

    if (statusError) {
      await supabase.auth.signOut();

      setSession(null);
      setUser(null);
      setMember(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        member,
        loading,
        signUp,
        signIn,
        signOut,
        refreshMember,
        validateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}