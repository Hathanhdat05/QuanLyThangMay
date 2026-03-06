import { createContext, useEffect, useState } from 'react';
import { api, apiConfigured } from '../lib/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await api.get('/auth/me');
      if (error) {
        setProfile(null);
        return;
      }
      setProfile(data);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    if (!apiConfigured) {
      setLoading(false);
      return;
    }

    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    api
      .get('/auth/me')
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          api.setToken(null);
          setUser(null);
          setProfile(null);
        } else {
          setUser(data);
          setProfile(data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await api.post('/auth/login', { email, password });
    if (error) return { data: null, error };
    if (data?.token) {
      api.setToken(data.token);
      setUser(data.user);
      setProfile(data.user);
    }
    return { data, error: null };
  };

  const signOut = () => {
    api.setToken(null);
    setUser(null);
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signOut, isAdmin, fetchProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
