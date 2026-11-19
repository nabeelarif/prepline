import { Link } from 'react-router-dom';
import type { PlanOrigin } from '../../domain/share';
import { paths } from '../../routes';

/** "Forked from <original>", a link while the original is still shared. */
export function ForkedFrom({ source }: { source: PlanOrigin }) {
  return (
    <>
      Forked from{' '}
      {source.available && source.slug ? (
        <Link to={paths.shared(source.slug)}>{source.name}</Link>
      ) : (
        source.name
      )}
    </>
  );
}
