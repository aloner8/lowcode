'use client';

import React, { createContext, useContext } from 'react';
import type { UserProfile } from '@/types';

const StudioUserContext = createContext<UserProfile | null>(null);

export const StudioUserProvider: React.FC<{ user: UserProfile; children: React.ReactNode }> = ({ user, children }) => (
  <StudioUserContext.Provider value={user}>{children}</StudioUserContext.Provider>
);

export const useStudioUser = () => useContext(StudioUserContext);

