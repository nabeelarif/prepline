import { MAX_TAG_LENGTH, MAX_TAGS, type SharingValue, type Visibility } from '../../domain/share';
import { useStore } from '../../state/store';
import { RadioChoice } from './RadioChoice';

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Only you can see this plan.' },
  {
    value: 'unlisted',
    label: 'Anyone with the link',
    hint: 'Not listed anywhere. People who have the link can view it, without an account.',
  },
  {
    value: 'public',
    label: 'Public in Explore',
    hint: 'Anyone can find it in Explore and open it. It is listed once it has a resource.',
  },
];

/** Who can open a plan, plus the tags that go with sharing it. The author is the account's name. */
export function SharingFields({
  value,
  onChange,
}: {
  value: SharingValue;
  onChange: (next: SharingValue) => void;
}) {
  const authorName = useStore((s) => s.sharing.displayName);
  return (
    <>
      <fieldset className="field">
        <legend>Who can open this plan</legend>
        {OPTIONS.map((o) => (
          <RadioChoice
            key={o.value}
            name="visibility"
            label={o.label}
            hint={o.hint}
            checked={value.visibility === o.value}
            onChange={() => onChange({ ...value, visibility: o.value })}
          />
        ))}
      </fieldset>
      {value.visibility === 'public' && authorName && (
        <p className="share-note">
          Shown as the author: <strong>{authorName}</strong>. You can change your name in Account
          settings.
        </p>
      )}
      <label className="field">
        <span>
          Tags <small>(optional, up to {MAX_TAGS}, separated by commas)</small>
        </span>
        <input
          id="shTags"
          type="text"
          value={value.tags}
          maxLength={MAX_TAGS * (MAX_TAG_LENGTH + 2)}
          placeholder="swift, interview"
          onChange={(e) => onChange({ ...value, tags: e.target.value })}
        />
        {value.visibility === 'private' && (
          <small>Tags help people find a plan, so they are saved once you share it.</small>
        )}
      </label>
      <p className="share-note">
        <strong>Shared:</strong> the title, description, phases and resources with their notes and
        links. Changes you make to the plan show up for viewers.
        <br />
        <strong>Never shared:</strong> your progress, start date, deadline or daily hours.
      </p>
    </>
  );
}
