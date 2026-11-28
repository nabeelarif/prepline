/** Why a plan was refused, one problem to a line. */
export function ErrorList({ errors }: { errors: string[] }) {
  return (
    <ul className="error-list">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
