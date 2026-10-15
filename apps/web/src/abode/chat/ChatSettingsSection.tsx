import { useRef, useState, type ReactNode } from "react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { SettingsRow, SettingsSection } from "../../components/settings/settingsLayout";
import {
  BOSS_BROWS,
  BOSS_EYES,
  BOSS_SCARVES,
  BOSS_SKINS,
  BOSS_TOPS,
  MAX_PHOTO_CHARS,
  type BossLook,
} from "./cast/bossConfig";
import { useCastStore } from "./cast/castStore";
import { BossAvatar, HelperAvatar } from "./cast/Characters";

const TOP_LABELS: Record<BossLook["top"], string> = {
  crown: "Crown",
  cap: "Cap",
  hair: "Spiky hair",
  beanie: "Beanie",
  none: "Nothing",
};
const BROW_LABELS: Record<BossLook["brows"], string> = { big: "Big", calm: "Calm", none: "None" };
const EYE_LABELS: Record<BossLook["eyes"], string> = {
  dots: "Dots",
  round: "Round glasses",
  shades: "Shades",
};

function Choices<T extends string>(props: {
  readonly label: string;
  readonly options: ReadonlyArray<T>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly render: (value: T) => ReactNode;
  readonly swatch?: boolean;
}) {
  return (
    <div role="group" aria-label={props.label} className="flex flex-wrap justify-end gap-1">
      {props.options.map((option) => (
        <Button
          key={option}
          size={props.swatch ? "icon-sm" : "compact"}
          variant="ghost"
          aria-pressed={option === props.value}
          data-pressed={option === props.value || undefined}
          onClick={() => props.onChange(option)}
        >
          {props.render(option)}
        </Button>
      ))}
    </div>
  );
}

function Swatch({ color, label }: { readonly color: string; readonly label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="size-4 rounded-full ring-1 ring-border"
      style={{ background: color }}
    />
  );
}

/** Shrinks an uploaded photo to a 128px square so it fits in local storage. */
async function photoDataUrl(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return url.length <= MAX_PHOTO_CHARS ? url : null;
}

/** Settings › General › abode chat: the switch, the Boss builder and the cast's names. */
export function ChatSettingsSection() {
  const cast = useCastStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const setLook = (look: Partial<BossLook>) => cast.update({ look });

  return (
    <SettingsSection id="abode-chat" title="abode chat">
      <SettingsRow
        title="abode chat"
        description="Cards for questions, warnings, tickets and wins, and the helpers beside each message. Off shows the classic chat."
        control={
          <Switch
            checked={cast.enabled}
            onCheckedChange={(checked) => cast.update({ enabled: Boolean(checked) })}
            aria-label="abode chat"
          />
        }
      />
      <SettingsRow
        title="You"
        description={
          photoError ?? "How you appear beside your messages. Build your Boss, or use a photo."
        }
        control={
          <div className="flex items-center gap-3">
            <BossAvatar
              look={cast.look}
              photo={cast.photo}
              name={cast.bossName}
              className="size-14 rounded-full object-cover"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const photo = await photoDataUrl(file).catch(() => null);
                setPhotoError(photo ? null : "That image couldn't be read. Try a JPG or PNG.");
                if (photo) cast.update({ photo });
              }}
            />
            {cast.photo ? (
              <Button size="compact" variant="ghost" onClick={() => cast.update({ photo: null })}>
                Use the drawing
              </Button>
            ) : (
              <Button size="compact" variant="ghost" onClick={() => fileRef.current?.click()}>
                Upload a photo…
              </Button>
            )}
          </div>
        }
      />
      {cast.photo ? null : (
        <>
          <SettingsRow
            title="Face"
            control={
              <Choices
                label="Face"
                swatch
                options={BOSS_SKINS}
                value={cast.look.skin}
                onChange={(skin) => setLook({ skin })}
                render={(color) => <Swatch color={color} label={`Face ${color}`} />}
              />
            }
          />
          <SettingsRow
            title="On top"
            control={
              <Choices
                label="On top"
                options={BOSS_TOPS}
                value={cast.look.top}
                onChange={(top) => setLook({ top })}
                render={(top) => TOP_LABELS[top]}
              />
            }
          />
          <SettingsRow
            title="Brows"
            control={
              <Choices
                label="Brows"
                options={BOSS_BROWS}
                value={cast.look.brows}
                onChange={(brows) => setLook({ brows })}
                render={(brows) => BROW_LABELS[brows]}
              />
            }
          />
          <SettingsRow
            title="Eyes"
            control={
              <Choices
                label="Eyes"
                options={BOSS_EYES}
                value={cast.look.eyes}
                onChange={(eyes) => setLook({ eyes })}
                render={(eyes) => EYE_LABELS[eyes]}
              />
            }
          />
          <SettingsRow
            title="Scarf"
            control={
              <Choices
                label="Scarf"
                swatch
                options={BOSS_SCARVES}
                value={cast.look.scarf}
                onChange={(scarf) => setLook({ scarf })}
                render={(color) => <Swatch color={color} label={`Scarf ${color}`} />}
              />
            }
          />
        </>
      )}
      <SettingsRow
        title="Names"
        description="What the helpers call you, and their own names."
        control={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Input
              aria-label="Your name"
              className="w-28"
              defaultValue={cast.bossName}
              onBlur={(event) => cast.update({ bossName: event.target.value })}
            />
            <span className="flex items-center gap-1">
              <HelperAvatar helper="sunny" name="Claude's helper" className="size-6" />
              <Input
                aria-label="Claude's helper"
                className="w-24"
                defaultValue={cast.claudeName}
                onBlur={(event) => cast.update({ claudeName: event.target.value })}
              />
            </span>
            <span className="flex items-center gap-1">
              <HelperAvatar helper="pip" name="Codex's helper" className="size-6" />
              <Input
                aria-label="Codex's helper"
                className="w-24"
                defaultValue={cast.codexName}
                onBlur={(event) => cast.update({ codexName: event.target.value })}
              />
            </span>
          </div>
        }
      />
    </SettingsSection>
  );
}
