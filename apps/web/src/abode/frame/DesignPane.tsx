import { useState } from "react";

import { useFrameStore } from "./frameStore";
import { ageLabel } from "./milestonesModel";
import { pickPrompt, type DesignCard, type DesignGroup } from "./designModel";

const NO_PICKS: ReadonlyArray<string> = [];

/**
 * The Design tab (A-059): every design link and file in the current thread, grouped under the
 * message that asked for it. Ticking cards and "Send picks" only fills the composer.
 */
export function DesignPane(props: {
  readonly threadKey: string | null;
  readonly groups: ReadonlyArray<DesignGroup>;
  readonly nowMs: number;
  /** Resolves false when nothing could open. */
  readonly onPreview: (card: DesignCard) => Promise<boolean>;
  /** Fills the composer without sending; absent when there is nowhere to type. */
  readonly onSendPicks: ((text: string) => void) | undefined;
}) {
  const { threadKey, groups, nowMs, onPreview, onSendPicks } = props;
  const picked = useFrameStore((state) =>
    threadKey === null ? NO_PICKS : (state.designPicks[threadKey] ?? NO_PICKS),
  );
  const [failed, setFailed] = useState<ReadonlyArray<string>>([]);
  const preview = (card: DesignCard) =>
    onPreview(card).then((opened) =>
      setFailed((now) =>
        opened
          ? now.filter((key) => key !== card.key)
          : [...now.filter((key) => key !== card.key), card.key],
      ),
    );
  if (groups.length === 0) {
    return (
      <div data-abode-ds="">
        <div data-abode-ds-empty="" data-testid="design-empty">
          <p>No designs in this thread yet.</p>
          <small>Ask for a design and its links and files show up here.</small>
        </div>
      </div>
    );
  }
  const cards = groups.flatMap((group) => group.cards);
  const picks = cards.filter((card) => picked.includes(card.key));
  return (
    <div data-abode-ds="" data-testid="design">
      {picks.length === 0 ? null : (
        <div data-abode-ds-bar="" data-testid="design-picks">
          <span>{picks.length} picked</span>
          <button
            type="button"
            disabled={onSendPicks === undefined}
            onClick={() => {
              onSendPicks?.(pickPrompt(picks));
              if (threadKey !== null) useFrameStore.getState().clearDesignPicks(threadKey);
            }}
          >
            Send picks
          </button>
        </div>
      )}
      {groups.map((group) => (
        <section key={group.key} data-abode-ds-group="">
          <h3>
            <span>{group.asked.length > 60 ? `${group.asked.slice(0, 60)}…` : group.asked}</span>
            {group.at === null ? null : <small>asked {ageLabel(group.at, nowMs)}</small>}
          </h3>
          <ul>
            {group.cards.map((card) => (
              <li key={card.key} data-abode-ds-card="" data-testid="design-card">
                <div data-abode-ds-tile="" aria-hidden>
                  {card.host}
                </div>
                <div data-abode-ds-body="">
                  <span data-abode-ds-meta="">
                    <span data-abode-ds-chip="" data-source={card.source}>
                      {card.source}
                    </span>
                    {card.device === null ? null : <span>{card.device}</span>}
                  </span>
                  <b>{card.title}</b>
                  {card.path === null ? null : <code data-abode-ds-path="">{card.path}</code>}
                  {failed.includes(card.key) ? (
                    <small data-abode-ds-note="" role="status">
                      Open in the desktop app to preview
                    </small>
                  ) : null}
                  <span data-abode-ds-actions="">
                    <label>
                      <input
                        type="checkbox"
                        checked={picked.includes(card.key)}
                        disabled={threadKey === null}
                        onChange={() =>
                          threadKey !== null &&
                          useFrameStore.getState().toggleDesignPick(threadKey, card.key)
                        }
                      />
                      Pick
                    </label>
                    <button type="button" onClick={() => void preview(card)}>
                      Preview
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
