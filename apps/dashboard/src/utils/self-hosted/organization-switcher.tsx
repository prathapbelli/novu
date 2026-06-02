import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { RiAddCircleLine, RiArrowDownSLine, RiArrowRightSLine, RiLoader4Line } from 'react-icons/ri';
import { Avatar, AvatarFallback } from '@/components/primitives/avatar';
import { Button } from '@/components/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/primitives/dropdown-menu';
import { Input } from '@/components/primitives/input';
import { showErrorToast } from '@/components/primitives/sonner-helpers';
import { cn } from '@/utils/ui';
import { useClerk, useOrganization, useOrganizationList } from './index';

type Membership = {
  id: string;
  organization: {
    id: string;
    _id: string;
    name: string;
    imageUrl: string;
    publicMetadata: Record<string, unknown>;
  };
};

function getOrganizationInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function OrganizationAvatar({ name, showShimmer = false }: { name: string; showShimmer?: boolean }) {
  return (
    <span className={cn('relative size-6 rounded-full', showShimmer && 'overflow-hidden')}>
      <Avatar className="size-6 rounded-full">
        <AvatarFallback className="bg-primary-base text-static-white text-xs">
          {getOrganizationInitials(name || '?')}
        </AvatarFallback>
      </Avatar>
      {showShimmer && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-[shimmer_0.8s_ease-in-out]" />
      )}
    </span>
  );
}

function MembershipRow({
  membership,
  onSelect,
  isSwitching,
  switchingToId,
}: {
  membership: Membership;
  onSelect: (id: string) => void;
  isSwitching: boolean;
  switchingToId: string | null;
}) {
  const isCurrentlySwitching = switchingToId === membership.organization.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
    >
      <DropdownMenuItem
        className="group flex h-9 cursor-pointer items-center justify-start gap-2 rounded-sm border-0 px-2 text-sm focus:bg-accent"
        onClick={() => onSelect(membership.organization.id)}
        disabled={isSwitching}
      >
        <OrganizationAvatar name={membership.organization.name} />
        <span className="min-w-0 flex-1 truncate text-left text-foreground-950">{membership.organization.name}</span>
        {isCurrentlySwitching ? (
          <RiLoader4Line className="size-4 shrink-0 animate-spin text-foreground-600" />
        ) : (
          <RiArrowRightSLine className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </DropdownMenuItem>
    </motion.div>
  );
}

function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createOrganization } = useOrganizationList();
  const { setActive } = useClerk();
  const nameId = useId();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const newOrg = await createOrganization({ name: trimmed });
      // setActive triggers a full reload, so we don't need to clean up state here.
      await setActive({ organization: newOrg.id });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create organization.';
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Give your new organization a name. You can change it later in settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={nameId} className="mb-1.5 block text-xs font-medium text-foreground-700">
              Organization name
            </label>
            <Input
              id={nameId}
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="My Organization"
              required
              autoFocus
              disabled={isSubmitting}
              className="h-10"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              mode="ghost"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" mode="gradient" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating…' : 'Create organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrganizationSwitcherComponent() {
  const { organization: currentOrganization, isLoaded: isOrgLoaded } = useOrganization() as {
    organization: { name: string; _id: string } | undefined;
    isLoaded: boolean;
  };
  const { userMemberships, isLoaded: isListLoaded } = useOrganizationList();
  const { setActive } = useClerk();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingToId, setSwitchingToId] = useState<string | null>(null);

  const memberships = (userMemberships?.data ?? []) as Membership[];
  const otherMemberships = useMemo(
    () => memberships.filter((m) => m.organization.id !== currentOrganization?._id),
    [memberships, currentOrganization?._id]
  );

  // Refresh the list when the dropdown opens so newly-created orgs from other tabs show up.
  const revalidate = userMemberships?.revalidate;
  useEffect(() => {
    if (isOpen && revalidate) {
      void revalidate();
    }
  }, [isOpen, revalidate]);

  // Zero-orgs edge: auto-open the create dialog once the list confirms it's empty.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (isListLoaded && memberships.length === 0 && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setIsCreateOpen(true);
    }
  }, [isListLoaded, memberships.length]);

  const handleSwitch = useCallback(
    async (orgId: string) => {
      if (!orgId || orgId === currentOrganization?._id || isSwitching) return;

      setIsSwitching(true);
      setSwitchingToId(orgId);
      try {
        await setActive({ organization: orgId });
        // setActive reloads on success; state below is for failure paths only.
        setIsOpen(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
        showErrorToast(`Unable to switch organizations. ${message}`, 'Organization Switch Failed');
      } finally {
        setIsSwitching(false);
        setSwitchingToId(null);
      }
    },
    [currentOrganization?._id, isSwitching, setActive]
  );

  if (!isOrgLoaded) {
    return (
      <div className="flex w-full items-center gap-2 px-1.5 py-1.5">
        <div className="size-6 animate-pulse rounded-full bg-neutral-alpha-100" />
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-alpha-100" />
      </div>
    );
  }

  if (!currentOrganization) {
    // No active org but the auth provider is loaded — fall back to a create entry-point so the
    // user is never stranded with a non-functional shell.
    return (
      <>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm text-foreground-600 hover:bg-background"
        >
          <RiAddCircleLine className="size-4" />
          <span>Create organization</span>
        </button>
        <CreateOrganizationDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'group relative flex w-full items-center justify-start gap-2 rounded-lg px-1.5 py-1.5 transition-all duration-300',
              'hover:bg-background hover:shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-background focus-visible:shadow-sm'
            )}
          >
            <OrganizationAvatar name={currentOrganization.name} showShimmer />
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground-950">
              {currentOrganization.name}
            </span>
            <RiArrowDownSLine className="ml-auto size-4 shrink-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-64 p-0" align="start">
          <div
            className="max-h-[200px] overflow-y-auto"
            role="group"
            aria-label="List of all organization memberships"
          >
            {!isListLoaded ? (
              <div className="flex items-center justify-center py-2">
                <RiLoader4Line className="size-4 animate-spin text-foreground-600" />
              </div>
            ) : otherMemberships.length === 0 ? (
              <p className="px-3 py-2 text-xs text-foreground-500">No other organizations</p>
            ) : (
              <AnimatePresence mode="popLayout">
                {otherMemberships.map((membership) => (
                  <MembershipRow
                    key={membership.id}
                    membership={membership}
                    onSelect={handleSwitch}
                    isSwitching={isSwitching}
                    switchingToId={switchingToId}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          <DropdownMenuItem
            className="flex h-9 cursor-pointer items-center gap-2 rounded-none border-t border-stroke-100 px-2 text-sm focus:bg-accent hover:bg-accent"
            onSelect={(event) => {
              event.preventDefault();
              setIsOpen(false);
              setIsCreateOpen(true);
            }}
          >
            <RiAddCircleLine className="size-4 text-text-sub" />
            <span className="text-text-sub">Create organization</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}

export { OrganizationSwitcherComponent as OrganizationDropdown, OrganizationSwitcherComponent as OrganizationSwitcher };
