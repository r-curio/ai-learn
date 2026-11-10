import { Pencil } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../components/button.tsx";
import { Input } from "../components/form/input.tsx";

const EMPTY_TITLE = "A chat needs a title.";
const TITLE_TYPE = "text-[14px] leading-[18px] font-medium";

function TitleButton({ title, onClick }: { title: string; onClick: () => void }) {
	return (
		<Button
			variant="ghost"
			className={`-ml-2.5 h-8 min-w-0 shrink justify-start gap-2 px-2.5 ${TITLE_TYPE}`}
			onClick={onClick}
		>
			<span className="truncate">{title}</span>
			<span className="sr-only">, rename</span>
			<Pencil
				aria-hidden
				className="size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/button:opacity-100 group-focus-visible/button:opacity-100"
				strokeWidth={1.5}
			/>
		</Button>
	);
}

/** Enter saves and Escape cancels. Leaving it saves too, and an empty one puts the old title back. */
function TitleField({
	initial,
	error,
	saving,
	onEdit,
	onSave,
	onCancel,
}: {
	initial: string;
	error?: string;
	saving: boolean;
	onEdit: () => void;
	onSave: (typed: string) => void;
	onCancel: () => void;
}) {
	const [draft, setDraft] = useState(initial);
	const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape") onCancel();
		if (event.key === "Enter") onSave(draft);
	};
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2.5">
			<Input
				autoFocus
				aria-label="Chat title"
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? "chat-title-error" : undefined}
				className={`-ml-2.5 h-8 max-w-[420px] aria-invalid:border-destructive ${TITLE_TYPE}`}
				maxLength={200}
				value={draft}
				disabled={saving}
				onChange={(event) => {
					setDraft(event.target.value);
					onEdit();
				}}
				onFocus={(event) => event.currentTarget.select()}
				onKeyDown={keyDown}
				onBlur={() => (draft.trim() ? onSave(draft) : onCancel())}
			/>
			{error && (
				<p
					id="chat-title-error"
					role="alert"
					className="min-w-0 truncate text-[13px] leading-[18px] text-destructive"
				>
					{error}
				</p>
			)}
		</div>
	);
}

/** The chat's title in the top bar. Clicking it renames the chat, unless `onRename` is missing. */
export function ChatTitle({
	title,
	onRename,
}: {
	title: string;
	onRename?: (title: string) => Promise<void>;
}) {
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState<string>();
	const [saving, setSaving] = useState(false);
	// Enter and the blur that follows can both ask to save, so only the first one counts.
	const busy = useRef(false);

	const close = () => {
		setEditing(false);
		setError(undefined);
	};

	async function save(typed: string) {
		if (!onRename || busy.current) return;
		if (!typed.trim()) return setError(EMPTY_TITLE);
		if (typed.trim() === title) return close();
		busy.current = true;
		setSaving(true);
		try {
			await onRename(typed);
			close();
		} catch (cause) {
			setError((cause as Error).message);
		} finally {
			busy.current = false;
			setSaving(false);
		}
	}

	if (!editing || !onRename)
		return (
			<h1 className="flex min-w-0">
				{onRename ? (
					<TitleButton title={title} onClick={() => setEditing(true)} />
				) : (
					<span className={`block truncate ${TITLE_TYPE}`}>{title}</span>
				)}
			</h1>
		);
	return (
		<TitleField
			initial={title}
			error={error}
			saving={saving}
			onEdit={() => setError(undefined)}
			onSave={(typed) => void save(typed)}
			onCancel={close}
		/>
	);
}
