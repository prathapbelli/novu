import { IOrganizationEntity } from '@novu/shared';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useMemo } from 'react';
import { get, post } from '../../api/api.client';
import { QueryKeys } from '../query-keys';
import { withJwtValidation } from './api-interceptor';
import { AuthContextProvider } from './auth.resource';
import { ClerkLoaded } from './clerk-loaded';
import {
  OrganizationList,
  OrganizationProfile,
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  UserProfile,
} from './components';
import { getJwtToken, isJwtValid, setJwtToken } from './jwt-manager';
import { OrganizationContextProvider, useOrganization } from './organization.resource';
import { OrganizationSwitcher } from './organization-switcher';
import { Show } from './show';
import { useAuth } from './use-auth';
import { UserContextProvider, useUser } from './user.resource';
import { UserButton } from './user-button';

export {
  AuthContextProvider,
  ClerkLoaded,
  OrganizationContextProvider,
  OrganizationList,
  OrganizationProfile,
  OrganizationSwitcher,
  RedirectToSignIn,
  Show,
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  UserButton,
  UserProfile,
};

export { useAuth, useOrganization, useUser };

type SwitchTarget = string | null | { id?: string; _id?: string };

type SelfHostedMembership = {
  id: string;
  organization: {
    id: string;
    _id: string;
    name: string;
    imageUrl: string;
    publicMetadata: Record<string, unknown>;
  };
};

function resolveOrgId(target: SwitchTarget): string | null {
  if (!target) return null;
  if (typeof target === 'string') return target;
  return target.id ?? target._id ?? null;
}

async function switchActiveOrganization(orgId: string): Promise<void> {
  const response = await post<{ data: string }>(`/auth/organizations/${orgId}/switch`, { body: {} });
  if (!response?.data || typeof response.data !== 'string') {
    throw new Error('Organization switch did not return a token');
  }
  setJwtToken(response.data);
}

async function createOrganizationRequest({ name }: { name: string }): Promise<IOrganizationEntity> {
  const response = await post<{ data: IOrganizationEntity }>('/organizations', { body: { name } });
  return response.data;
}

const fetchOrganizations = withJwtValidation(async () => {
  const response = await get<{ data: IOrganizationEntity[] }>('/organizations');
  return response.data ?? [];
});

function toMembership(org: IOrganizationEntity): SelfHostedMembership {
  return {
    id: org._id,
    organization: {
      id: org._id,
      _id: org._id,
      name: org.name,
      imageUrl: '',
      publicMetadata: {},
    },
  };
}

export const useClerk = () => {
  const { isLoaded } = useAuth();

  const setActive = useCallback(async ({ organization }: { organization: SwitchTarget }) => {
    const orgId = resolveOrgId(organization);
    // Self-hosted JWT always carries an active org, so clearing (null) is a safe no-op.
    if (!orgId) return;

    await switchActiveOrganization(orgId);
    window.location.reload();
  }, []);

  return { loaded: isLoaded, setActive };
};

export const useOrganizationList = (_options?: { userMemberships?: unknown }) => {
  const hasToken = isJwtValid(getJwtToken());
  const clerk = useClerk();

  const {
    data: organizations,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [QueryKeys.organizationsList],
    queryFn: fetchOrganizations,
    enabled: hasToken,
  });

  const organizationList = useMemo(() => organizations ?? [], [organizations]);
  const memberships = useMemo(() => organizationList.map(toMembership), [organizationList]);

  const userMemberships = useMemo(
    () => ({
      data: memberships,
      isFetching,
      hasNextPage: false,
      fetchNext: () => undefined,
      revalidate: async () => {
        await refetch();
      },
    }),
    [memberships, isFetching, refetch]
  );

  const createOrganization = useCallback(async ({ name }: { name: string }) => {
    const newOrg = await createOrganizationRequest({ name });
    return { id: newOrg._id, _id: newOrg._id, name: newOrg.name };
  }, []);

  return {
    isLoaded: hasToken ? !isLoading : true,
    organizationList,
    userMemberships,
    setActive: clerk.setActive,
    createOrganization,
  };
};

export const ClerkContext = React.createContext({});

export type ProtectProps = {
  children: React.ReactNode;
  [key: string]: any;
};

export const Protect = ({ children, ...rest }: ProtectProps) => {
  return children;
};

export function ClerkProvider({ children }: any) {
  const value = {};

  return (
    <ClerkContext.Provider value={value}>
      <UserContextProvider>
        <AuthContextProvider>
          <OrganizationContextProvider>{children}</OrganizationContextProvider>
        </AuthContextProvider>
      </UserContextProvider>
    </ClerkContext.Provider>
  );
}

(window as any).Clerk = {
  loggedIn: isJwtValid(getJwtToken()),
  session: {
    getToken: () => getJwtToken(),
  },
};

export type DecodedJwt = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId: string;
  environmentId: string | null;
  roles: string[];
  iat: number;
  exp: number;
  iss: string;
};
