import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { paths } from '../../routes';
import { useStore } from '../../state/store';
import { DangerAction } from './DangerAction';

/** Deletes all plans and progress but keeps the account. Lives in Account settings → Privacy. */
export function DeleteAllData() {
  const navigate = useNavigate();
  // On success the store closes the modal and the empty onboarding screen shows.
  const run = async () => {
    if (!(await useStore.getState().deleteAllData())) {
      return 'Nothing was deleted. The server did not confirm the change, so your data is unchanged. Check your connection and try again.';
    }
    navigate(paths.dashboard);
    return null;
  };

  return (
    <DangerAction
      icon={<Trash2 size={22} />}
      label="Delete All Data"
      description="Permanently delete your preparation data saved in your account."
      confirmTitle="Delete all Road to Goals data?"
      confirmBody={
        <p>
          This will permanently delete all plans, phases, resources, and preparation progress saved
          in your account.
        </p>
      }
      errorTitle="We couldn't delete your data."
      run={run}
    />
  );
}
