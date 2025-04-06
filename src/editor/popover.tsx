import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { setIcon, Notice } from "obsidian";
import { cn } from "@/lib/utils";

interface CommentPopoverProps {
	initialComment?: string;
	initialColor?: string;
	colorOptions: string[];
	className: string;
	highlightText: string;
	onSave: ({ comment, remove }: { comment?: string; remove?: boolean }) => void;
	addNewFileFn: () => void;
	popoverRef: { hidePopover: () => void };
}

const Popover = ({
	initialComment = "",
	initialColor = "",
	colorOptions,
	onSave,
	className,
	highlightText,
	addNewFileFn,
	popoverRef,
}: CommentPopoverProps) => {
	const [comment, setComment] = useState(initialComment);
	const [showCommentForm, setShowCommentForm] = useState(comment !== "");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const copyButtonRef = useRef<HTMLButtonElement>(null);
	const commentButtonRef = useRef<HTMLButtonElement>(null);
	const newFileButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (closeButtonRef.current) setIcon(closeButtonRef.current, "x");
	}, [showCommentForm]);

	useEffect(() => {
		if (closeButtonRef.current) setIcon(closeButtonRef.current, "x");
		if (copyButtonRef.current) setIcon(copyButtonRef.current, "clipboard");
		if (newFileButtonRef.current)
			setIcon(newFileButtonRef.current, "file-plus");
		if (commentButtonRef.current)
			setIcon(commentButtonRef.current, "square-pen");
	}, []);

	const hidePopover = () => {
		popoverRef.hidePopover();
	};

	const handleSubmit = ({
		selectedColor,
		remove,
	}: {
		selectedColor?: string | null;
		remove?: boolean;
	}) => {
		if (comment.includes("-->")) {
			new Notice("Comment must not contain -->");
			return;
		}
		if (comment.includes("\n\n")) {
			new Notice("Comment must not contain empty lines");
			return;
		}
		if (remove) {
			onSave({ remove: true, comment: '' });
			return;
		}
		// combine color + comment
		const finalComment = comment.trim() + (selectedColor ? ` @${selectedColor}` : "");
		onSave({ comment: finalComment, remove });
		popoverRef.hidePopover();
	};

	return (
		<div
			className={cn(
				className,
				"rounded-lg border border-solid border-gray-200 bg-white p-0 shadow-lg"
			)}
		>
			<div
				className="flex justify-between bg-gray-50"
				style={{ borderBottom: "1px solid var(--background-modifier-border)" }}
			>
				<button
					type="button"
					onClick={() => handleSubmit({ remove: true })}
					className={cn(
						"flex !bg-transparent px-2 py-1 text-xs !shadow-none hover:bg-transparent hover:underline",
						showCommentForm ? "justify-around" : "justify-end",
					)}
					style={{ color: "var(--text-error)" }}
				>
					Remove
				</button>

				<div className="flex">
					<button
						type="button"
						onClick={() => {
							hidePopover();
							navigator.clipboard.writeText(highlightText);
							new Notice("Copied to clipboard");
						}}
						className="clickable-icon"
						ref={copyButtonRef}
						title="Copy to clipboard"
					>
						<span className="sr-only">Copy to clipboard</span>
					</button>
					<button
						type="button"
						onClick={() => {
							hidePopover();
							addNewFileFn();
						}}
						className="clickable-icon"
						ref={newFileButtonRef}
						title="Extract highlighted text to new file"
					>
						<span className="sr-only">Extract highlighted text to new file</span>
					</button>
					{!showCommentForm && (
						<button
							type="button"
							onClick={() => {
								setShowCommentForm(true);
								setTimeout(() => {
									if (inputRef.current) {
										inputRef.current.focus();
										const length = inputRef.current.value.length;
										inputRef.current.setSelectionRange(length, length);
									}
								});
							}}
							className="clickable-icon"
							ref={commentButtonRef}
							title="Add comment"
						>
							<span className="sr-only">Add comment</span>
						</button>
					)}
				</div>
				{showCommentForm && (
					<button
						type="button"
						onClick={hidePopover}
						className="clickable-icon"
						ref={closeButtonRef}
					>
						<span className="sr-only">Close</span>
					</button>
				)}
			</div>
			<div className="p-2">
				{showCommentForm && (
					<textarea
						ref={inputRef}
						value={comment}
						onChange={(e) => setComment(e.target.value)}
						className="mb-2 w-full resize-none rounded-none border-none p-0 !shadow-none"
						rows={5}
						placeholder="Add your comment..."
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSubmit({ selectedColor: initialColor });
							}
						}}
					/>
				)}
				<div className="flex items-center gap-x-2">
					<div className="flex flex-1 items-center gap-x-2">
						<ColorButton
							color={null}
							onClickHandler={() => handleSubmit({ selectedColor: null })}
						/>
						{colorOptions.map((c) => (
							<ColorButton
								key={c}
								color={c}
								onClickHandler={(col) => handleSubmit({ selectedColor: col })}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

const ColorButton = ({
	color,
	onClickHandler,
}: {
	color: string | null;
	onClickHandler: (color: string | null) => void;
}) => (
	<div
		onClick={() => onClickHandler(color)}
		style={{
			backgroundColor: color || "var(--text-highlight-bg)",
		}}
		className="button size-6 rounded-full"
	>
		<span className="sr-only">{color || "none"}</span>
	</div>
);

Popover.displayName = "Popover";
export default Popover;

/**
 * Show the popover at screen coords, for reading mode
 */
export function showCommentPopoverAtCoords(
  coords: { x: number; y: number },
  highlightText: string,
  options: {
    initialComment?: string;
    initialColor?: string;
    colorOptions?: string[];
    className?: string;
    onSave?: ({ comment, remove }: { comment?: string; remove?: boolean }) => void;
    addNewFileFn?: () => void;
  } = {}
) {
  const container = document.createElement("div");
  container.id = "omnidian-comment-popover-container";
  container.style.position = "absolute";
  container.style.left = `${coords.x}px`;
  container.style.top = `${coords.y}px`;
  container.style.zIndex = "9999";
  document.body.appendChild(container);

  const root = ReactDOM.createRoot(container);

  const popoverRef = {
    hidePopover: () => {
      root.unmount();
      container.remove();
    },
  };

  root.render(
    <Popover
      popoverRef={popoverRef}
      highlightText={highlightText}
      initialComment={options.initialComment || ""}
      initialColor={options.initialColor || ""}
      colorOptions={options.colorOptions || ["lightpink", "palegreen", "paleturquoise", "violet"]}
      className={options.className || ""}
	  onSave={options.onSave || (() => {})}
      addNewFileFn={options.addNewFileFn || (() => { /* no-op */ })}
    />
  );

  return container;
}
