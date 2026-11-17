import { UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { paths } from '../../routes';
import { useStore } from '../../state/store';
import { DangerAction } from './DangerAction';

/** Permanently deletes the account and everything in it. Lives in Account settings → Privacy. */
export function DeleteAccount() {
  const navigate = useNavigate();
  // On success the user is signed out; leave the signed-in address like an explicit sign-out.
  const run = async () => {
    const out = await useStore.getState().deleteAccount();
    if (!out.ok) return out.error || 'Nothing was deleted. Check your connection and try again.';
    navigate(paths.home, { replace: true });
    return null;
  };

  return (
    <DangerAction
      icon={<UserX size={22} />}
      label="Delete Account"
      description="Permanently delete your account and everything saved in it."
      confirmTitle="Delete your account?"
      confirmBody={
        <p>
          This permanently deletes your account, all your plans, resources and progress, and stops
          sharing any plans you shared. You will be signed out.
        </p>
      }
      errorTitle="We couldn't delete your account."
      run={run}
    />
  );
}
