/** One option of a radio group: a label, and an optional line of explanation under it. */
export function RadioChoice({
  name,
  label,
  hint,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="choice">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>
        {hint ? (
          <>
            <strong>{label}</strong>
            <small>{hint}</small>
          </>
        ) : (
          label
        )}
      </span>
    </label>
  );
}
