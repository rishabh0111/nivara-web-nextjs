import { Compose, type Composed } from "@/ui/compose";

/**
 * A box a Visitor writes into.
 *
 * The shared control, wearing this Surface's clothes. What it brings is the
 * *sequence* — guard an empty submit, hold the button while the write is out,
 * throw the text away only if it landed, say what happened either way — and
 * that sequence is where the mistakes are, which is why the Widget uses it
 * rather than owning a fourth copy. What it cannot bring is its styling: the
 * Next application's stylesheet lives in that application's document and a
 * shadow root cannot see it, so every class is named again here in the sheet
 * that ships inside the bundle.
 */
export function WidgetCompose({
  label,
  action,
  acting,
  announcement,
  onSubmit,
}: {
  label: string;
  action: string;
  acting: string;
  announcement: string;
  onSubmit: (said: string) => Promise<Composed>;
}) {
  return (
    <Compose
      label={label}
      action={action}
      acting={acting}
      announcement={announcement}
      classes={{
        form: "nvw-compose",
        // Visible to a screen reader and not to the eye. A chat box that
        // announced "Message" above itself would be a form again, and a box
        // with no name at all is one a screen reader reads as "edit, blank".
        label: "nvw-only-spoken",
        box: "nvw-box",
        problem: "nvw-problem",
        outcome: "nvw-outcome",
        action: "nvw-send",
      }}
      onSubmit={onSubmit}
    />
  );
}
