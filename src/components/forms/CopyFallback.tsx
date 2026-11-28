/** Shown when the browser would not copy: the text itself, selected on focus. */
export function CopyFallback({ text }: { text: string }) {
  return (
    <label className="field copy-fallback">
      <span>Your browser didn’t allow copying. Select this text and copy it yourself.</span>
      <textarea
        readOnly
        rows={5}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        spellCheck={false}
      />
    </label>
  );
}
